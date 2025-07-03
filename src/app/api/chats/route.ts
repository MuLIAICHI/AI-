// src/app/api/chats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema';
import { eq, desc, asc, and, or, like, gte, lte, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';

// export const runtime = 'edge';

// ✅ FIXED: Validation schema with proper null handling
const conversationsQuerySchema = z.object({
  // Pagination
  limit: z.string().nullish().transform(val => {
    if (!val) return 20;
    const num = parseInt(val);
    return isNaN(num) ? 20 : Math.min(Math.max(num, 1), 100);
  }),
  offset: z.string().nullish().transform(val => {
    if (!val) return 0;
    const num = parseInt(val);
    return isNaN(num) ? 0 : Math.max(num, 0);
  }),
  
  // Sorting
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'messageCount']).nullish().default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).nullish().default('desc'),
  
  // Search and filtering
  search: z.string().max(200).nullish(),
  dateFrom: z.string().datetime().nullish(),
  dateTo: z.string().datetime().nullish(),
  hasMessages: z.enum(['true', 'false']).nullish().transform(val => 
    val === 'true' ? true : val === 'false' ? false : undefined
  ),
  
  // Include options
  includePreview: z.enum(['true', 'false']).nullish().default('true').transform(val => val === 'true'),
  includeStats: z.enum(['true', 'false']).nullish().default('false').transform(val => val === 'true'),
});

/**
 * GET /api/chats - List user's conversations with filtering and search
 * Returns paginated list of user's conversation sessions with optional previews and statistics
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please sign in to view your conversations' 
      }, { status: 401 });
    }

    // 2. Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryValidation = conversationsQuerySchema.safeParse({
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
      limit, offset, sortBy, sortOrder, search, 
      dateFrom, dateTo, hasMessages, includePreview, includeStats 
    } = queryValidation.data;

    // 3. Build where conditions
    const whereConditions = [eq(conversations.userId, userId)];

    // Search filter
    if (search) {
      whereConditions.push(
        like(conversations.title, `%${search}%`)
      );
    }

    // Date range filters
    if (dateFrom) {
      whereConditions.push(gte(conversations.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      whereConditions.push(lte(conversations.createdAt, new Date(dateTo)));
    }

    // 4. Get total count for pagination
    const [totalCountResult] = await db
      .select({ 
        count: sql<number>`count(*)`.as('count') 
      })
      .from(conversations)
      .where(and(...whereConditions));

    const totalConversations = parseInt(totalCountResult?.count?.toString() || '0');

    // 5. Get conversations with message counts
    let orderColumn;
    switch (sortBy) {
      case 'createdAt':
        orderColumn = sortOrder === 'desc' ? desc(conversations.createdAt) : asc(conversations.createdAt);
        break;
      case 'updatedAt':
        orderColumn = sortOrder === 'desc' ? desc(conversations.updatedAt) : asc(conversations.updatedAt);
        break;
      case 'title':
        orderColumn = sortOrder === 'desc' ? desc(conversations.title) : asc(conversations.title);
        break;
      default:
        orderColumn = desc(conversations.updatedAt);
    }

    const userConversations = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        messageCount: sql<number>`count(${messages.id})`.as('message_count'),
      })
      .from(conversations)
      .leftJoin(messages, eq(messages.conversationId, conversations.id))
      .where(and(...whereConditions))
      .groupBy(conversations.id, conversations.title, conversations.createdAt, conversations.updatedAt)
      .orderBy(orderColumn)
      .limit(limit)
      .offset(offset);

    // 6. Get message previews if requested
    let conversationPreviews: Record<string, any> = {};
    if (includePreview && userConversations.length > 0) {
      const conversationIds = userConversations.map(conv => conv.id);
      
      // Get the latest message for each conversation
      const latestMessages = await db
        .select({
          conversationId: messages.conversationId,
          content: messages.content,
          role: messages.role,
          agentType: messages.agentType,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(inArray(messages.conversationId, conversationIds))
        .orderBy(desc(messages.createdAt));

      // Group by conversation ID and take the first (most recent) message
      conversationPreviews = latestMessages.reduce((acc, msg) => {
        if (!acc[msg.conversationId]) {
          acc[msg.conversationId] = {
            lastMessage: {
              content: msg.content.slice(0, 150) + (msg.content.length > 150 ? '...' : ''),
              role: msg.role,
              agentType: msg.agentType,
              timestamp: msg.createdAt.toISOString(),
            }
          };
        }
        return acc;
      }, {} as Record<string, any>);
    }

    // 7. Transform response to match expected format
    const transformedConversations = userConversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt?.toISOString() || conv.createdAt.toISOString(),
      messageCount: parseInt(conv.messageCount.toString()),
      // Add preview data if available
      ...(includePreview && conversationPreviews[conv.id] ? conversationPreviews[conv.id] : {}),
    }));

    return NextResponse.json({
      success: true,
      conversations: transformedConversations,
      pagination: {
        limit,
        offset,
        total: totalConversations,
        hasMore: offset + limit < totalConversations,
        nextOffset: offset + limit < totalConversations ? offset + limit : null,
      },
      filters: {
        search,
        dateFrom,
        dateTo,
        hasMessages,
        sortBy,
        sortOrder,
      },
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
      message: 'Failed to retrieve conversations',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        undefined
    }, { status: 500 });
  }
}

/**
 * POST /api/chats - Create a new conversation
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // 2. Parse request body (optional)
    const createConversationSchema = z.object({
      title: z.string().min(1).max(200).optional().default('New Conversation'),
    });

    const body = await request.json().catch(() => ({}));
    const validation = createConversationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid conversation data',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { title } = validation.data;

    // 3. Create new conversation
    const [newConversation] = await db
      .insert(conversations)
      .values({
        userId,
        title,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Conversation created successfully',
      conversation: {
        id: newConversation.id,
        title: newConversation.title,
        createdAt: newConversation.createdAt.toISOString(),
        updatedAt: newConversation.updatedAt?.toISOString(),
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json({
      error: 'Failed to create conversation',
      message: 'Could not create new conversation session'
    }, { status: 500 });
  }
}