// src/app/api/chat/[chatId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema'; // ✅ Fixed: Use NEW schema
import { eq, and, desc, asc, count, sql } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

// Validation schemas - Updated for UUID support
const chatIdParamSchema = z.object({
  chatId: z.string().uuid('Chat ID must be a valid UUID') // ✅ Fixed: UUID instead of number
});

const messagesQuerySchema = z.object({
  limit: z.string().optional().transform(val => {
    if (!val) return 100;
    const num = parseInt(val);
    return isNaN(num) ? 100 : Math.min(Math.max(num, 1), 500);
  }),
  offset: z.string().optional().transform(val => {
    if (!val) return 0;
    const num = parseInt(val);
    return isNaN(num) ? 0 : Math.max(num, 0);
  }),
  order: z.enum(['asc', 'desc']).optional().default('asc')
});

/**
 * GET /api/chat/[chatId] - Get specific chat with messages
 * Returns chat details and message history for the specified conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    // 1. Authenticate user
    const authResult = await auth(); // ✅ Fixed: await auth() properly
    const userId = authResult?.userId; // ✅ Fixed: extract userId from auth result
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please sign in to view chats' 
      }, { status: 401 });
    }

    // 2. Validate chat ID parameter
    const paramValidation = chatIdParamSchema.safeParse(params);
    if (!paramValidation.success) {
      return NextResponse.json({
        error: 'Invalid chat ID',
        message: 'Chat ID must be a valid UUID',
        details: paramValidation.error.errors
      }, { status: 400 });
    }

    const chatId = paramValidation.data.chatId; // ✅ Fixed: UUID string, not number

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryValidation = messagesQuerySchema.safeParse({
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      order: searchParams.get('order')
    });

    if (!queryValidation.success) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        message: 'Please check your query parameters',
        details: queryValidation.error.errors
      }, { status: 400 });
    }

    const { limit, offset, order } = queryValidation.data;

    // 4. Get conversation and verify ownership
    const [conversation] = await db
      .select({
        id: conversations.id,
        title: conversations.title, // ✅ Fixed: use title field
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        userId: conversations.userId,
        summary: conversations.summary,
      })
      .from(conversations) // ✅ Fixed: use conversations table
      .where(and(
        eq(conversations.id, chatId), // ✅ Fixed: UUID comparison
        eq(conversations.userId, userId)
      ))
      .limit(1);

    if (!conversation) {
      return NextResponse.json({
        error: 'Chat not found',
        message: 'The requested chat session could not be found or you do not have access to it'
      }, { status: 404 });
    }

    // 5. Get messages for this conversation
    const chatMessages = await db
      .select({
        id: messages.id,
        content: messages.content,
        role: messages.role,
        createdAt: messages.createdAt,
        agentType: messages.agentType, // ✅ New: include agent type
      })
      .from(messages)
      .where(eq(messages.conversationId, chatId)) // ✅ Fixed: use conversationId
      .orderBy(order === 'desc' ? desc(messages.createdAt) : asc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    // 6. Get total message count for pagination
    const [messageCount] = await db
      .select({ count: count(messages.id) })
      .from(messages)
      .where(eq(messages.conversationId, chatId)); // ✅ Fixed: use conversationId

    // 7. Get agent usage statistics for this conversation
    const agentStats = await db
      .select({
        role: messages.role,
        agentType: messages.agentType,
        count: count(messages.id)
      })
      .from(messages)
      .where(eq(messages.conversationId, chatId)) // ✅ Fixed: use conversationId
      .groupBy(messages.role, messages.agentType);

    const stats = {
      totalMessages: messageCount?.count || 0,
      userMessages: agentStats
        .filter(s => s.role === 'user')
        .reduce((sum, s) => sum + s.count, 0),
      assistantMessages: agentStats
        .filter(s => s.role === 'assistant')
        .reduce((sum, s) => sum + s.count, 0),
      agentBreakdown: agentStats
        .filter(s => s.role === 'assistant' && s.agentType)
        .reduce((acc, s) => {
          acc[s.agentType!] = s.count;
          return acc;
        }, {} as Record<string, number>)
    };

    // 8. Transform messages to include helpful metadata
    const transformedMessages = chatMessages.map(message => ({
      id: message.id,
      content: message.content,
      role: message.role,
      createdAt: message.createdAt,
      agentType: message.agentType,
      // Add word count for analytics
      wordCount: message.content.split(/\s+/).length,
      // Add character count
      characterCount: message.content.length,
    }));

    return NextResponse.json({
      success: true,
      conversation: { // ✅ Fixed: renamed from 'chat' to 'conversation'
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        summary: conversation.summary,
      },
      messages: transformedMessages,
      pagination: {
        limit,
        offset,
        total: stats.totalMessages,
        hasMore: offset + limit < stats.totalMessages,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(stats.totalMessages / limit),
      },
      statistics: {
        ...stats,
        averageMessageLength: stats.totalMessages > 0 
          ? Math.round(transformedMessages.reduce((sum, msg) => sum + msg.characterCount, 0) / transformedMessages.length)
          : 0,
      },
      metadata: {
        requestedAt: new Date().toISOString(),
        order,
        userId: userId.substring(0, 8) + '...', // Partial for privacy
      }
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to retrieve conversation history',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        undefined
    }, { status: 500 });
  }
}

/**
 * PATCH /api/chat/[chatId] - Update conversation details
 * Allows updating conversation title and other metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    // 1. Authenticate user
    const authResult = await auth(); // ✅ Fixed: await auth() properly
    const userId = authResult?.userId; // ✅ Fixed: extract userId from auth result
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // 2. Validate chat ID
    const paramValidation = chatIdParamSchema.safeParse(params);
    if (!paramValidation.success) {
      return NextResponse.json({
        error: 'Invalid chat ID',
        details: paramValidation.error.errors
      }, { status: 400 });
    }

    const chatId = paramValidation.data.chatId; // ✅ Fixed: UUID string

    // 3. Parse and validate request body
    const updateSchema = z.object({
      title: z.string().min(1, 'Title cannot be empty').max(200, 'Title too long').optional(),
      summary: z.string().max(500, 'Summary too long').optional(),
    });

    const body = await request.json();
    const validation = updateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid update data',
        message: 'Please check your input',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { title, summary } = validation.data;

    // 4. Verify conversation ownership
    const [existingConversation] = await db
      .select()
      .from(conversations) // ✅ Fixed: use conversations table
      .where(and(
        eq(conversations.id, chatId), // ✅ Fixed: UUID comparison
        eq(conversations.userId, userId)
      ))
      .limit(1);

    if (!existingConversation) {
      return NextResponse.json({
        error: 'Conversation not found',
        message: 'The requested conversation could not be found'
      }, { status: 404 });
    }

    // 5. Update conversation
    const updateData: any = {
      updatedAt: new Date(), // Always update timestamp
    };
    
    if (title !== undefined) {
      updateData.title = title;
    }
    if (summary !== undefined) {
      updateData.summary = summary;
    }

    if (Object.keys(updateData).length === 1) { // Only updatedAt
      return NextResponse.json({
        error: 'No updates provided',
        message: 'Please provide data to update'
      }, { status: 400 });
    }

    const [updatedConversation] = await db
      .update(conversations) // ✅ Fixed: use conversations table
      .set(updateData)
      .where(eq(conversations.id, chatId)) // ✅ Fixed: UUID comparison
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Conversation updated successfully',
      conversation: { // ✅ Fixed: renamed from 'chat'
        id: updatedConversation.id,
        title: updatedConversation.title,
        summary: updatedConversation.summary,
        createdAt: updatedConversation.createdAt,
        updatedAt: updatedConversation.updatedAt,
      }
    });

  } catch (error) {
    console.error('Update conversation error:', error);
    return NextResponse.json({
      error: 'Failed to update conversation',
      message: 'Could not update conversation details'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/chat/[chatId] - Delete specific conversation
 * Removes conversation and all associated messages
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    // 1. Authenticate user
    const authResult = await auth(); // ✅ Fixed: await auth() properly
    const userId = authResult?.userId; // ✅ Fixed: extract userId from auth result
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // 2. Validate chat ID
    const paramValidation = chatIdParamSchema.safeParse(params);
    if (!paramValidation.success) {
      return NextResponse.json({
        error: 'Invalid chat ID',
        details: paramValidation.error.errors
      }, { status: 400 });
    }

    const chatId = paramValidation.data.chatId; // ✅ Fixed: UUID string

    // 3. Verify conversation ownership
    const [conversation] = await db
      .select()
      .from(conversations) // ✅ Fixed: use conversations table
      .where(and(
        eq(conversations.id, chatId), // ✅ Fixed: UUID comparison
        eq(conversations.userId, userId)
      ))
      .limit(1);

    if (!conversation) {
      return NextResponse.json({
        error: 'Conversation not found',
        message: 'The requested conversation could not be found'
      }, { status: 404 });
    }

    // 4. Get message count before deletion (for confirmation)
    const [messageCount] = await db
      .select({ count: count(messages.id) })
      .from(messages)
      .where(eq(messages.conversationId, chatId)); // ✅ Fixed: use conversationId

    const deletedMessageCount = messageCount?.count || 0;

    // 5. Delete messages first (foreign key constraint)
    await db
      .delete(messages)
      .where(eq(messages.conversationId, chatId)); // ✅ Fixed: use conversationId

    // 6. Delete conversation
    await db
      .delete(conversations) // ✅ Fixed: use conversations table
      .where(eq(conversations.id, chatId)); // ✅ Fixed: UUID comparison

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully',
      deletedConversation: { // ✅ Fixed: renamed from 'deletedChat'
        id: chatId,
        title: conversation.title,
        messagesDeleted: deletedMessageCount,
      }
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    return NextResponse.json({
      error: 'Failed to delete conversation',
      message: 'Could not delete the conversation session'
    }, { status: 500 });
  }
}

/**
 * POST /api/chat/[chatId] - Add message to existing conversation
 * Alternative endpoint for adding messages to specific conversations
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    // For now, redirect to main chat endpoint
    // This could be implemented for specific use cases
    return NextResponse.json({
      error: 'Use main chat endpoint',
      message: 'Please use /api/chat for sending messages',
      suggestion: 'Include conversationId in the request body when calling /api/chat'
    }, { status: 302 });

  } catch (error) {
    console.error('Post to conversation error:', error);
    return NextResponse.json({
      error: 'Not implemented',
      message: 'This endpoint is not yet implemented'
    }, { status: 501 });
  }
}