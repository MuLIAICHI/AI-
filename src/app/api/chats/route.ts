// src/app/api/chats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema'; // ✅ Fixed: Use NEW schema
import { eq, desc, asc, and, or, like, gte, lte, sql, inArray, count } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

// Validation schemas - Updated for UUID support
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
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'messageCount']).optional().default('updatedAt'),
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
  conversationIds: z.array(z.string().uuid()).min(1, 'At least one conversation ID required').max(50, 'Too many conversations to delete at once'), // ✅ Fixed: UUID array
  confirm: z.boolean().refine(val => val === true, 'Confirmation required for bulk delete'),
});

/**
 * GET /api/chats - List user's conversations with filtering and search
 * Returns paginated list of user's conversation sessions with optional previews and statistics
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authResult = await auth(); // ✅ Fixed: await auth() properly
    const userId = authResult?.userId; // ✅ Fixed: extract userId from auth result
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please sign in to view your conversations' 
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
    let whereConditions = [eq(conversations.userId, userId)]; // ✅ Fixed: use conversations table

    // Search functionality
    if (search) {
      whereConditions.push(
        or(
          like(conversations.title, `%${search}%`), // ✅ Fixed: use title field
          like(conversations.summary, `%${search}%`) // ✅ Fixed: search in summary too
        )!
      );
    }

    // Date range filtering
    if (dateFrom) {
      whereConditions.push(gte(conversations.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      whereConditions.push(lte(conversations.createdAt, new Date(dateTo)));
    }

    const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    // 4. Build ORDER BY clause
    let orderByClause;
    switch (sortBy) {
      case 'title':
        orderByClause = sortOrder === 'desc' ? desc(conversations.title) : asc(conversations.title); // ✅ Fixed
        break;
      case 'updatedAt':
        orderByClause = sortOrder === 'desc' ? desc(conversations.updatedAt) : asc(conversations.updatedAt); // ✅ Fixed
        break;
      case 'createdAt':
        orderByClause = sortOrder === 'desc' ? desc(conversations.createdAt) : asc(conversations.createdAt); // ✅ Fixed
        break;
      default:
        orderByClause = sortOrder === 'desc' ? desc(conversations.updatedAt) : asc(conversations.updatedAt); // ✅ Fixed
        break;
    }

    // 5. Get base conversation list
    let baseConversations = await db
      .select({
        id: conversations.id,
        title: conversations.title, // ✅ Fixed: use title field
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        summary: conversations.summary,
      })
      .from(conversations) // ✅ Fixed: use conversations table
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // 6. Filter by message count if requested
    if (hasMessages !== undefined) {
      const conversationIds = baseConversations.map(conv => conv.id);
      if (conversationIds.length > 0) {
        const conversationsWithMessageCounts = await db
          .select({
            conversationId: messages.conversationId, // ✅ Fixed: use conversationId
            messageCount: count(messages.id)
          })
          .from(messages)
          .where(inArray(messages.conversationId, conversationIds)) // ✅ Fixed: use conversationId
          .groupBy(messages.conversationId);

        const conversationMessageMap = new Map(
          conversationsWithMessageCounts.map(item => [item.conversationId, item.messageCount])
        );

        baseConversations = baseConversations.filter(conversation => {
          const messageCount = conversationMessageMap.get(conversation.id) || 0;
          return hasMessages ? messageCount > 0 : messageCount === 0;
        });
      }
    }

    // 7. Get total count for pagination (before limit/offset)
    const [totalCount] = await db
      .select({ count: count(conversations.id) })
      .from(conversations) // ✅ Fixed: use conversations table
      .where(whereClause);

    const total = totalCount?.count || 0;

    // 8. Enhance conversations with additional data
    const enhancedConversations = await Promise.all(
      baseConversations.map(async (conversation) => {
        const result: any = {
          id: conversation.id,
          title: conversation.title,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          summary: conversation.summary,
        };

        // Add message preview if requested
        if (includePreview) {
          const [latestMessage] = await db
            .select({
              content: messages.content,
              role: messages.role,
              createdAt: messages.createdAt,
              agentType: messages.agentType, // ✅ New: include agent type
            })
            .from(messages)
            .where(eq(messages.conversationId, conversation.id)) // ✅ Fixed: use conversationId
            .orderBy(desc(messages.createdAt))
            .limit(1);

          result.latestMessage = latestMessage ? {
            content: latestMessage.content.length > 100 
              ? latestMessage.content.substring(0, 100) + '...'
              : latestMessage.content,
            role: latestMessage.role,
            createdAt: latestMessage.createdAt,
            agentType: latestMessage.agentType,
          } : null;
        }

        // Add statistics if requested
        if (includeStats) {
          const [stats] = await db
            .select({
              totalMessages: count(messages.id),
              userMessages: sql<number>`count(case when ${messages.role} = 'user' then 1 end)`.as('userMessages'),
              assistantMessages: sql<number>`count(case when ${messages.role} = 'assistant' then 1 end)`.as('assistantMessages'),
            })
            .from(messages)
            .where(eq(messages.conversationId, conversation.id)); // ✅ Fixed: use conversationId

          result.statistics = {
            totalMessages: stats?.totalMessages || 0,
            userMessages: stats?.userMessages || 0,
            assistantMessages: stats?.assistantMessages || 0,
          };
        }

        return result;
      })
    );

    // 9. Sort by messageCount if requested (needs to be done after getting stats)
    if (sortBy === 'messageCount' && includeStats) {
      enhancedConversations.sort((a, b) => {
        const aCount = a.statistics?.totalMessages || 0;
        const bCount = b.statistics?.totalMessages || 0;
        return sortOrder === 'desc' ? bCount - aCount : aCount - bCount;
      });
    }

    // 10. Get user's overall conversation statistics
    let userStats = {};
    if (includeStats) {
      const [overallStats] = await db
        .select({
          totalConversations: sql<number>`count(distinct ${conversations.id})`.as('totalConversations'),
          totalMessages: sql<number>`count(${messages.id})`.as('totalMessages'),
          oldestConversation: sql<Date>`min(${conversations.createdAt})`.as('oldestConversation'),
          newestConversation: sql<Date>`max(${conversations.createdAt})`.as('newestConversation'),
        })
        .from(conversations) // ✅ Fixed: use conversations table
        .leftJoin(messages, eq(conversations.id, messages.conversationId)) // ✅ Fixed: use conversationId
        .where(eq(conversations.userId, userId));

      userStats = {
        totalConversations: overallStats?.totalConversations || 0,
        totalMessages: overallStats?.totalMessages || 0,
        oldestConversation: overallStats?.oldestConversation,
        newestConversation: overallStats?.newestConversation,
      };
    }

    return NextResponse.json({
      success: true,
      conversations: enhancedConversations, // ✅ Fixed: renamed from 'chats'
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
    console.error('Get conversations error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to retrieve conversation list',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        undefined
    }, { status: 500 });
  }
}

/**
 * DELETE /api/chats - Bulk delete multiple conversations
 * Allows deleting multiple conversation sessions at once
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authResult = await auth(); // ✅ Fixed: await auth() properly
    const userId = authResult?.userId; // ✅ Fixed: extract userId from auth result
    
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

    const { conversationIds } = validation.data; // ✅ Fixed: renamed from chatIds

    // 3. Verify all conversations belong to the user
    const existingConversations = await db
      .select({
        id: conversations.id,
        title: conversations.title, // ✅ Fixed: use title field
        userId: conversations.userId,
      })
      .from(conversations) // ✅ Fixed: use conversations table
      .where(and(
        inArray(conversations.id, conversationIds), // ✅ Fixed: UUID array
        eq(conversations.userId, userId)
      ));

    if (existingConversations.length !== conversationIds.length) {
      const foundIds = existingConversations.map(conv => conv.id);
      const missingIds = conversationIds.filter(id => !foundIds.includes(id));
      
      return NextResponse.json({
        error: 'Some conversations not found',
        message: 'One or more conversations could not be found or do not belong to you',
        details: { missingConversationIds: missingIds }
      }, { status: 404 });
    }

    // 4. Get message counts before deletion (for confirmation)
    const messageCounts = await db
      .select({
        conversationId: messages.conversationId, // ✅ Fixed: use conversationId
        count: count(messages.id)
      })
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds)) // ✅ Fixed: use conversationId
      .groupBy(messages.conversationId);

    const totalMessagesDeleted = messageCounts.reduce(
      (sum, item) => sum + item.count, 
      0
    );

    // 5. Delete messages first (foreign key constraint)
    await db
      .delete(messages)
      .where(inArray(messages.conversationId, conversationIds)); // ✅ Fixed: use conversationId

    // 6. Delete conversations
    await db
      .delete(conversations) // ✅ Fixed: use conversations table
      .where(and(
        inArray(conversations.id, conversationIds), // ✅ Fixed: UUID array
        eq(conversations.userId, userId)
      ));

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${conversationIds.length} conversation(s)`,
      deletedConversations: existingConversations.map(conv => ({ // ✅ Fixed: renamed
        id: conv.id,
        title: conv.title,
      })),
      statistics: {
        conversationsDeleted: conversationIds.length,
        messagesDeleted: totalMessagesDeleted,
      }
    });

  } catch (error) {
    console.error('Bulk delete conversations error:', error);
    return NextResponse.json({
      error: 'Failed to delete conversations',
      message: 'Could not delete the requested conversation sessions'
    }, { status: 500 });
  }
}

/**
 * POST /api/chats - Create a new conversation (alternative to main chat endpoint)
 * For cases where you want to create an empty conversation first
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authResult = await auth(); // ✅ Fixed: await auth() properly
    const userId = authResult?.userId; // ✅ Fixed: extract userId from auth result
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please sign in to create conversations' 
      }, { status: 401 });
    }

    // 2. Parse and validate request body
    const createSchema = z.object({
      title: z.string().min(1, 'Title is required').max(200, 'Title too long').default('New Conversation'),
      summary: z.string().max(500, 'Summary too long').optional(),
    });

    const body = await request.json().catch(() => ({}));
    const validation = createSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid conversation data',
        message: 'Please check your input',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { title, summary } = validation.data;

    // 3. Create new conversation
    const [newConversation] = await db
      .insert(conversations) // ✅ Fixed: use conversations table
      .values({
        userId,
        title,
        summary,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Conversation created successfully',
      conversation: { // ✅ Fixed: renamed from 'chat'
        id: newConversation.id,
        title: newConversation.title,
        summary: newConversation.summary,
        createdAt: newConversation.createdAt,
        updatedAt: newConversation.updatedAt,
      }
    });

  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json({
      error: 'Failed to create conversation',
      message: 'Could not create new conversation session'
    }, { status: 500 });
  }
}