// src/app/api/chat/[chatId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

// Validation schemas
const chatIdParamSchema = z.object({
  chatId: z.string().regex(/^\d+$/, 'Chat ID must be a number')
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
 * Returns chat details and message history for the specified chat
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    // 1. Authenticate user
    const { userId } = auth();
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
        message: 'Chat ID must be a valid number',
        details: paramValidation.error.errors
      }, { status: 400 });
    }

    const chatId = parseInt(paramValidation.data.chatId);

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

    // 4. Get chat and verify ownership
    const [chat] = await db
      .select({
        id: chats.id,
        title: chats.pdfName,
        createdAt: chats.createdAt,
        userId: chats.userId,
        fileKey: chats.fileKey,
      })
      .from(chats)
      .where(and(
        eq(chats.id, chatId),
        eq(chats.userId, userId)
      ))
      .limit(1);

    if (!chat) {
      return NextResponse.json({
        error: 'Chat not found',
        message: 'The requested chat session could not be found or you do not have access to it'
      }, { status: 404 });
    }

    // 5. Get messages for this chat
    const chatMessages = await db
      .select({
        id: messages.id,
        content: messages.content,
        role: messages.role,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(order === 'desc' ? desc(messages.createdAt) : asc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    // 6. Get total message count for pagination
    const [messageCount] = await db
      .select({ count: messages.id })
      .from(messages)
      .where(eq(messages.chatId, chatId));

    // 7. Get agent usage statistics for this chat
    const agentStats = await db
      .select({
        role: messages.role,
        count: messages.id
      })
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .groupBy(messages.role);

    const stats = {
      totalMessages: parseInt(messageCount?.count?.toString() || '0'),
      userMessages: agentStats.find(s => s.role === 'user')?.count || 0,
      assistantMessages: agentStats.find(s => s.role === 'assistant')?.count || 0,
    };

    // 8. Transform messages to include helpful metadata
    const transformedMessages = chatMessages.map(message => ({
      id: message.id,
      content: message.content,
      role: message.role,
      createdAt: message.createdAt,
      // Add word count for analytics
      wordCount: message.content.split(/\s+/).length,
      // Add character count
      characterCount: message.content.length,
    }));

    return NextResponse.json({
      success: true,
      chat: {
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        fileKey: chat.fileKey,
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
        userId: userId, // For debugging/analytics
      }
    });

  } catch (error) {
    console.error('Get chat error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to retrieve chat history',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        undefined
    }, { status: 500 });
  }
}

/**
 * PATCH /api/chat/[chatId] - Update chat details
 * Allows updating chat title and other metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    // 1. Authenticate user
    const { userId } = auth();
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

    const chatId = parseInt(paramValidation.data.chatId);

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

    // 4. Verify chat ownership
    const [existingChat] = await db
      .select()
      .from(chats)
      .where(and(
        eq(chats.id, chatId),
        eq(chats.userId, userId)
      ))
      .limit(1);

    if (!existingChat) {
      return NextResponse.json({
        error: 'Chat not found',
        message: 'The requested chat could not be found'
      }, { status: 404 });
    }

    // 5. Update chat
    const updateData: any = {};
    if (title !== undefined) {
      updateData.pdfName = title;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        error: 'No updates provided',
        message: 'Please provide data to update'
      }, { status: 400 });
    }

    const [updatedChat] = await db
      .update(chats)
      .set(updateData)
      .where(eq(chats.id, chatId))
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Chat updated successfully',
      chat: {
        id: updatedChat.id,
        title: updatedChat.pdfName,
        createdAt: updatedChat.createdAt,
      }
    });

  } catch (error) {
    console.error('Update chat error:', error);
    return NextResponse.json({
      error: 'Failed to update chat',
      message: 'Could not update chat details'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/chat/[chatId] - Delete specific chat
 * Removes chat and all associated messages
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    // 1. Authenticate user
    const { userId } = auth();
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

    const chatId = parseInt(paramValidation.data.chatId);

    // 3. Verify chat ownership
    const [chat] = await db
      .select()
      .from(chats)
      .where(and(
        eq(chats.id, chatId),
        eq(chats.userId, userId)
      ))
      .limit(1);

    if (!chat) {
      return NextResponse.json({
        error: 'Chat not found',
        message: 'The requested chat could not be found'
      }, { status: 404 });
    }

    // 4. Get message count before deletion (for confirmation)
    const [messageCount] = await db
      .select({ count: messages.id })
      .from(messages)
      .where(eq(messages.chatId, chatId));

    const deletedMessageCount = parseInt(messageCount?.count?.toString() || '0');

    // 5. Delete messages first (foreign key constraint)
    await db
      .delete(messages)
      .where(eq(messages.chatId, chatId));

    // 6. Delete chat
    await db
      .delete(chats)
      .where(eq(chats.id, chatId));

    return NextResponse.json({
      success: true,
      message: 'Chat deleted successfully',
      deletedChat: {
        id: chatId,
        title: chat.pdfName,
        messagesDeleted: deletedMessageCount,
      }
    });

  } catch (error) {
    console.error('Delete chat error:', error);
    return NextResponse.json({
      error: 'Failed to delete chat',
      message: 'Could not delete the chat session'
    }, { status: 500 });
  }
}

/**
 * POST /api/chat/[chatId] - Add message to existing chat
 * Alternative endpoint for adding messages to specific chats
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
      suggestion: 'Include chatId in the request body when calling /api/chat'
    }, { status: 302 });

  } catch (error) {
    console.error('Post to chat error:', error);
    return NextResponse.json({
      error: 'Not implemented',
      message: 'This endpoint is not yet implemented'
    }, { status: 501 });
  }
}