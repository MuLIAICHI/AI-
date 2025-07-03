// src/app/api/chat/[chatId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { z } from 'zod';

// export const runtime = 'edge';

// Validation schemas
const chatIdParamSchema = z.object({
  chatId: z.string().uuid('Invalid conversation ID format')
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
 * GET /api/chat/[chatId] - Get specific conversation with messages
 * Returns conversation details and message history for the specified conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please sign in to view conversations' 
      }, { status: 401 });
    }

    // 2. Validate conversation ID parameter
    const paramValidation = chatIdParamSchema.safeParse(params);
    if (!paramValidation.success) {
      return NextResponse.json({
        error: 'Invalid conversation ID',
        message: 'Conversation ID must be a valid UUID format',
        details: paramValidation.error.errors
      }, { status: 400 });
    }

    const conversationId = paramValidation.data.chatId;

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
        title: conversations.title,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        userId: conversations.userId,
      })
      .from(conversations)
      .where(and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      ))
      .limit(1);

    if (!conversation) {
      return NextResponse.json({
        error: 'Conversation not found',
        message: 'The requested conversation could not be found or you do not have access to it'
      }, { status: 404 });
    }

    // 5. Get messages with pagination
    const orderColumn = order === 'desc' ? desc(messages.createdAt) : asc(messages.createdAt);
    
    const conversationMessages = await db
      .select({
        id: messages.id,
        content: messages.content,
        role: messages.role,
        agentType: messages.agentType,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(orderColumn)
      .limit(limit)
      .offset(offset);

    // 6. Get total message count
    const [messageCountResult] = await db
      .select({ 
        count: sql<number>`count(*)`.as('count') 
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    const totalMessages = parseInt(messageCountResult?.count?.toString() || '0');

    // 7. Transform messages for response
    const transformedMessages = conversationMessages.map(msg => ({
      id: msg.id,
      content: msg.content,
      role: msg.role,
      agentType: msg.agentType || null,
      timestamp: msg.createdAt.toISOString(),
      createdAt: msg.createdAt.toISOString(), // For compatibility
      characterCount: msg.content.length,
    }));

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt?.toISOString() || conversation.createdAt.toISOString(),
        messageCount: totalMessages,
      },
      messages: transformedMessages,
      pagination: {
        limit,
        offset,
        total: totalMessages,
        hasMore: offset + limit < totalMessages,
        nextOffset: offset + limit < totalMessages ? offset + limit : null,
      },
      statistics: {
        totalCharacters: transformedMessages.reduce((sum, msg) => sum + msg.characterCount, 0),
        averageMessageLength: transformedMessages.length > 0 ? 
          Math.round(transformedMessages.reduce((sum, msg) => sum + msg.characterCount, 0) / transformedMessages.length) 
          : 0,
      },
      metadata: {
        requestedAt: new Date().toISOString(),
        order,
        userId: userId, // For debugging/analytics
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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // 2. Validate conversation ID
    const paramValidation = chatIdParamSchema.safeParse(params);
    if (!paramValidation.success) {
      return NextResponse.json({
        error: 'Invalid conversation ID',
        details: paramValidation.error.errors
      }, { status: 400 });
    }

    const conversationId = paramValidation.data.chatId;

    // 3. Parse and validate request body
    const updateSchema = z.object({
      title: z.string().min(1, 'Title cannot be empty').max(200, 'Title too long').optional(),
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

    const { title } = validation.data;

    // 4. Verify conversation ownership
    const [existingConversation] = await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.id, conversationId),
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
    const updateData: any = { updatedAt: new Date() };
    if (title !== undefined) {
      updateData.title = title;
    }

    if (Object.keys(updateData).length === 1) { // Only updatedAt
      return NextResponse.json({
        error: 'No updates provided',
        message: 'Please provide data to update'
      }, { status: 400 });
    }

    const [updatedConversation] = await db
      .update(conversations)
      .set(updateData)
      .where(eq(conversations.id, conversationId))
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Conversation updated successfully',
      conversation: {
        id: updatedConversation.id,
        title: updatedConversation.title,
        createdAt: updatedConversation.createdAt.toISOString(),
        updatedAt: updatedConversation.updatedAt?.toISOString(),
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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // 2. Validate conversation ID
    const paramValidation = chatIdParamSchema.safeParse(params);
    if (!paramValidation.success) {
      return NextResponse.json({
        error: 'Invalid conversation ID',
        details: paramValidation.error.errors
      }, { status: 400 });
    }

    const conversationId = paramValidation.data.chatId;

    // 3. Verify conversation ownership
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.id, conversationId),
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
      .select({ 
        count: sql<number>`count(*)`.as('count') 
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    const deletedMessageCount = parseInt(messageCount?.count?.toString() || '0');

    // 5. Delete messages first (foreign key constraint)
    await db
      .delete(messages)
      .where(eq(messages.conversationId, conversationId));

    // 6. Delete conversation
    await db
      .delete(conversations)
      .where(eq(conversations.id, conversationId));

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully',
      deletedConversation: {
        id: conversation.id,
        title: conversation.title,
        messagesDeleted: deletedMessageCount,
      }
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    return NextResponse.json({
      error: 'Failed to delete conversation',
      message: 'Could not delete the conversation'
    }, { status: 500 });
  }
}