// src/app/api/chats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { eq, desc, asc, and, or, like, gte, lte, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

// Validation schemas
const chatsQuerySchema = z.object({
  // Pagination
  limit: z.string().optional().transform(val => {
    if (!val) return 20;
    const num = parseInt(val);
    return isNaN(num) ? 20 : Math.min(Math.max(num, 1), 100);
  }),
  offset: z.string().optional().transform(val => {
    if (!val) return 0;
    const num = parseInt(val);
    return isNaN(num) ? 0 : Math.max(num, 0);
  }),
  
  // Sorting
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'messageCount']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  
  // Search and filtering
  search: z.string().max(200).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  hasMessages: z.enum(['true', 'false']).optional().transform(val => 
    val === 'true' ? true : val === 'false' ? false : undefined
  ),
  
  // Include options
  includePreview: z.enum(['true', 'false']).optional().default('true').transform(val => val === 'true'),
  includeStats: z.enum(['true', 'false']).optional().default('false').transform(val => val === 'true'),
});

const bulkDeleteSchema = z.object({
  chatIds: z.array(z.number().int().positive()).min(1, 'At least one chat ID required').max(50, 'Too many chats to delete at once'),
  confirm: z.boolean().refine(val => val === true, 'Confirmation required for bulk delete'),
});

/**
 * GET /api/chats - List user's chats with filtering and search
 * Returns paginated list of user's chat sessions with optional previews and statistics
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please sign in to view your chats' 
      }, { status: 401 });
    }

    // 2. Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryValidation = chatsQuerySchema.safeParse({
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
      search: searchParams.get('search'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      hasMessages: searchParams.get('hasMessages'),
      includePreview: searchParams.get('includePreview'),
      includeStats: searchParams.get('includeStats'),
    });

    if (!queryValidation.success) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        message: 'Please check your query parameters',
        details: queryValidation.error.errors
      }, { status: 400 });
    }

    const {
      limit,
      offset,
      sortBy,
      sortOrder,
      search,
      dateFrom,
      dateTo,
      hasMessages,
      includePreview,
      includeStats
    } = queryValidation.data;

    // 3. Build WHERE conditions
    let whereConditions = [eq(chats.userId, userId)];

    // Search functionality
    if (search) {
      whereConditions.push(
        or(
          like(chats.pdfName, `%${search}%`),
          like(chats.fileKey, `%${search}%`)
        )!
      );
    }

    // Date range filtering
    if (dateFrom) {
      whereConditions.push(gte(chats.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      whereConditions.push(lte(chats.createdAt, new Date(dateTo)));
    }

    const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    // 4. Build ORDER BY clause
    let orderByClause;
    switch (sortBy) {
      case 'title':
        orderByClause = sortOrder === 'desc' ? desc(chats.pdfName) : asc(chats.pdfName);
        break;
      case 'updatedAt':
        // We'll use createdAt as a proxy for updatedAt since we don't have an updatedAt field
        orderByClause = sortOrder === 'desc' ? desc(chats.createdAt) : asc(chats.createdAt);
        break;
      case 'createdAt':
      default:
        orderByClause = sortOrder === 'desc' ? desc(chats.createdAt) : asc(chats.createdAt);
        break;
    }

    // 5. Get base chat list
    let baseChats = await db
      .select({
        id: chats.id,
        title: chats.pdfName,
        createdAt: chats.createdAt,
        fileKey: chats.fileKey,
      })
      .from(chats)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // 6. Filter by message count if requested
    if (hasMessages !== undefined) {
      const chatIds = baseChats.map(chat => chat.id);
      if (chatIds.length > 0) {
        const chatsWithMessageCounts = await db
          .select({
            chatId: messages.chatId,
            messageCount: sql<number>`count(${messages.id})`.as('messageCount')
          })
          .from(messages)
          .where(inArray(messages.chatId, chatIds))
          .groupBy(messages.chatId);

        const chatMessageMap = new Map(
          chatsWithMessageCounts.map(item => [item.chatId, parseInt(item.messageCount.toString())])
        );

        baseChats = baseChats.filter(chat => {
          const messageCount = chatMessageMap.get(chat.id) || 0;
          return hasMessages ? messageCount > 0 : messageCount === 0;
        });
      }
    }

    // 7. Get total count for pagination (before limit/offset)
    const [totalCount] = await db
      .select({ count: sql<number>`count(*)`.as('count') })
      .from(chats)
      .where(whereClause);

    const total = parseInt(totalCount?.count?.toString() || '0');

    // 8. Enhance chats with additional data
    const enhancedChats = await Promise.all(
      baseChats.map(async (chat) => {
        const result: any = {
          id: chat.id,
          title: chat.title,
          createdAt: chat.createdAt,
          fileKey: chat.fileKey,
        };

        // Add message preview if requested
        if (includePreview) {
          const [latestMessage] = await db
            .select({
              content: messages.content,
              role: messages.role,
              createdAt: messages.createdAt,
            })
            .from(messages)
            .where(eq(messages.chatId, chat.id))
            .orderBy(desc(messages.createdAt))
            .limit(1);

          result.latestMessage = latestMessage ? {
            content: latestMessage.content.length > 100 
              ? `${latestMessage.content.substring(0, 100)}...` 
              : latestMessage.content,
            role: latestMessage.role,
            createdAt: latestMessage.createdAt,
          } : null;

          result.lastMessageAt = latestMessage?.createdAt || chat.createdAt;
        }

        // Add statistics if requested
        if (includeStats) {
          const [stats] = await db
            .select({
              totalMessages: sql<number>`count(${messages.id})`.as('totalMessages'),
              userMessages: sql<number>`sum(case when ${messages.role} = 'user' then 1 else 0 end)`.as('userMessages'),
              assistantMessages: sql<number>`sum(case when ${messages.role} = 'assistant' then 1 else 0 end)`.as('assistantMessages'),
            })
            .from(messages)
            .where(eq(messages.chatId, chat.id));

          result.statistics = {
            totalMessages: parseInt(stats?.totalMessages?.toString() || '0'),
            userMessages: parseInt(stats?.userMessages?.toString() || '0'),
            assistantMessages: parseInt(stats?.assistantMessages?.toString() || '0'),
          };
        }

        return result;
      })
    );

    // 9. Sort by messageCount if requested (needs to be done after getting stats)
    if (sortBy === 'messageCount' && includeStats) {
      enhancedChats.sort((a, b) => {
        const aCount = a.statistics?.totalMessages || 0;
        const bCount = b.statistics?.totalMessages || 0;
        return sortOrder === 'desc' ? bCount - aCount : aCount - bCount;
      });
    }

    // 10. Get user's overall chat statistics
    let userStats = {};
    if (includeStats) {
      const [overallStats] = await db
        .select({
          totalChats: sql<number>`count(distinct ${chats.id})`.as('totalChats'),
          totalMessages: sql<number>`count(${messages.id})`.as('totalMessages'),
          oldestChat: sql<Date>`min(${chats.createdAt})`.as('oldestChat'),
          newestChat: sql<Date>`max(${chats.createdAt})`.as('newestChat'),
        })
        .from(chats)
        .leftJoin(messages, eq(chats.id, messages.chatId))
        .where(eq(chats.userId, userId));

      userStats = {
        totalChats: parseInt(overallStats?.totalChats?.toString() || '0'),
        totalMessages: parseInt(overallStats?.totalMessages?.toString() || '0'),
        oldestChat: overallStats?.oldestChat,
        newestChat: overallStats?.newestChat,
      };
    }

    return NextResponse.json({
      success: true,
      chats: enhancedChats,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        search,
        dateFrom,
        dateTo,
        hasMessages,
        sortBy,
        sortOrder,
      },
      ...(includeStats && { userStatistics: userStats }),
      metadata: {
        requestedAt: new Date().toISOString(),
        includePreview,
        includeStats,
      }
    });

  } catch (error) {
    console.error('Get chats error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to retrieve chat list',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        undefined
    }, { status: 500 });
  }
}

/**
 * DELETE /api/chats - Bulk delete multiple chats
 * Allows deleting multiple chat sessions at once
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const validation = bulkDeleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid delete request',
        message: 'Please check your request data',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { chatIds } = validation.data;

    // 3. Verify all chats belong to the user
    const existingChats = await db
      .select({
        id: chats.id,
        title: chats.pdfName,
        userId: chats.userId,
      })
      .from(chats)
      .where(and(
        inArray(chats.id, chatIds),
        eq(chats.userId, userId)
      ));

    if (existingChats.length !== chatIds.length) {
      const foundIds = existingChats.map(chat => chat.id);
      const missingIds = chatIds.filter(id => !foundIds.includes(id));
      
      return NextResponse.json({
        error: 'Some chats not found',
        message: 'One or more chats could not be found or do not belong to you',
        details: { missingChatIds: missingIds }
      }, { status: 404 });
    }

    // 4. Get message counts before deletion (for confirmation)
    const messageCounts = await db
      .select({
        chatId: messages.chatId,
        count: sql<number>`count(${messages.id})`.as('count')
      })
      .from(messages)
      .where(inArray(messages.chatId, chatIds))
      .groupBy(messages.chatId);

    const totalMessagesDeleted = messageCounts.reduce(
      (sum, item) => sum + parseInt(item.count.toString()), 
      0
    );

    // 5. Delete messages first (foreign key constraint)
    await db
      .delete(messages)
      .where(inArray(messages.chatId, chatIds));

    // 6. Delete chats
    await db
      .delete(chats)
      .where(and(
        inArray(chats.id, chatIds),
        eq(chats.userId, userId)
      ));

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${chatIds.length} chat(s)`,
      deletedChats: existingChats.map(chat => ({
        id: chat.id,
        title: chat.title,
      })),
      statistics: {
        chatsDeleted: chatIds.length,
        messagesDeleted: totalMessagesDeleted,
      }
    });

  } catch (error) {
    console.error('Bulk delete chats error:', error);
    return NextResponse.json({
      error: 'Failed to delete chats',
      message: 'Could not delete the requested chat sessions'
    }, { status: 500 });
  }
}

/**
 * POST /api/chats - Create a new chat (alternative to main chat endpoint)
 * For cases where you want to create an empty chat first
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // 2. Parse request body (optional)
    const createChatSchema = z.object({
      title: z.string().min(1).max(200).optional().default('New Chat'),
    });

    const body = await request.json().catch(() => ({}));
    const validation = createChatSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid chat data',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { title } = validation.data;

    // 3. Create new chat
    const [newChat] = await db
      .insert(chats)
      .values({
        userId,
        pdfName: title,
        pdfUrl: '',
        fileKey: `chat_${userId}_${Date.now()}`,
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Chat created successfully',
      chat: {
        id: newChat.id,
        title: newChat.pdfName,
        createdAt: newChat.createdAt,
        fileKey: newChat.fileKey,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Create chat error:', error);
    return NextResponse.json({
      error: 'Failed to create chat',
      message: 'Could not create new chat session'
    }, { status: 500 });
  }
}