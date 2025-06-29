// src/app/api/chat/route.ts
// ✅ FIXED: Complete Mastra Integration with Multi-Agent System
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { mastraService, getAgentById } from '@/lib/mastra';
import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'nodejs';

// Request validation schema - Updated for UUID support
const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long'),
  conversationId: z.string().uuid().optional(),
  agentId: z.enum(['router', 'digital-mentor', 'finance-guide', 'health-coach']).optional(),
  stream: z.boolean().default(true),
});

/**
 * POST /api/chat - Main chat endpoint
 * Handles user messages and routes them to appropriate Mastra agents
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user with Clerk - FIXED AUTH PATTERN
    const authResult = await auth();
    const userId = authResult?.userId;
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please sign in to continue' 
      }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const validation = chatRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid request',
        message: 'Please check your input and try again',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { message, conversationId, agentId, stream } = validation.data;

    // 3. Get or create conversation session - FIXED SCHEMA
    let currentConversation;
    if (conversationId) {
      // Get existing conversation and verify ownership
      const [existingConversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
        
      if (!existingConversation || existingConversation.userId !== userId) {
        return NextResponse.json({ 
          error: 'Conversation not found',
          message: 'The requested conversation session could not be found'
        }, { status: 404 });
      }
      currentConversation = existingConversation;
    } else {
      // Create new conversation session - FIXED SCHEMA
      const [newConversation] = await db
        .insert(conversations)
        .values({
          userId,
          title: `Chat with Smartlyte AI`,
          summary: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      currentConversation = newConversation;
    }

    // 4. Get recent conversation history for context - FIXED FIELD NAMES
    const conversationHistory = await db
      .select({
        content: messages.content,
        role: messages.role,
        createdAt: messages.createdAt,
        agentType: messages.agentType,
      })
      .from(messages)
      .where(eq(messages.conversationId, currentConversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(20);

    // Reverse to get chronological order
    conversationHistory.reverse();

    // 5. Save user message to database - FIXED SCHEMA
    await db.insert(messages).values({
      conversationId: currentConversation.id,
      content: message,
      role: 'user',
      createdAt: new Date(),
    });

    // 6. Prepare context for Mastra agents
    const context = {
      userId,
      conversationId: currentConversation.id,
      conversationHistory: conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
        agentType: msg.agentType,
      })),
    };

    // 7. Handle streaming vs non-streaming responses
    if (stream) {
      return handleStreamingResponse(message, context, agentId, currentConversation);
    } else {
      return handleNonStreamingResponse(message, context, agentId, currentConversation);
    }

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to process your message',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        undefined
    }, { status: 500 });
  }
}

/**
 * Handle streaming AI response - FIXED BASED ON ACTUAL MASTRA IMPLEMENTATION
 */
async function handleStreamingResponse(
  message: string, 
  context: any, 
  agentId: string | undefined,
  currentConversation: any
) {
  try {
    // Get AI response from Mastra service
    const aiResponse = await mastraService.chat(context.userId, message, {
      chatId: currentConversation.id, // Using chatId parameter as in your service
      agentId,
      stream: true,
      conversationHistory: context.conversationHistory,
    });

    if (!aiResponse.success) {
      throw new Error(aiResponse.error || 'Failed to get AI response');
    }

    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';
          const agentName = aiResponse.agent || 'Smartlyte AI';

          // Send initial metadata
          const metadata = {
            type: 'metadata',
            conversationId: currentConversation.id,
            agentName: agentName,
            routingInfo: aiResponse.routingInfo,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));

          // Handle streaming response based on actual Mastra API format
          if (aiResponse.stream && aiResponse.stream.textStream) {
            // ✅ FIXED: Use textStream directly (documented Mastra way)
            for await (const chunk of aiResponse.stream.textStream) {
              if (chunk && typeof chunk === 'string') {
                fullResponse += chunk;
                
                const data = {
                  type: 'content',
                  content: chunk,
                  agentName: agentName,
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
              }
            }
          } else if (aiResponse.stream && typeof aiResponse.stream.textStream?.[Symbol.asyncIterator] === 'function') {
            // ✅ FIXED: Fallback - treat stream.textStream as text chunks if available
            for await (const chunk of aiResponse.stream.textStream) {
              if (chunk && typeof chunk === 'string') {
                fullResponse += chunk;
                
                const data = {
                  type: 'content',
                  content: chunk,
                  agentName: agentName,
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
              }
            }
          } else {
            // Non-streaming fallback
            fullResponse = aiResponse.message || '';
            
            const data = {
              type: 'content', 
              content: fullResponse,
              agentName: agentName,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          }

          // Save assistant message to database
          if (fullResponse.trim()) {
            await db.insert(messages).values({
              conversationId: currentConversation.id,
              content: fullResponse.trim(),
              role: 'assistant',
              agentType: mapAgentNameToType(agentName),
              createdAt: new Date(),
            });
          }

          // Send completion signal
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

        } catch (error) {
          console.error('Streaming error:', error);
          const errorData = {
            type: 'error',
            error: 'Failed to process response',
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });

  } catch (error) {
    console.error('Streaming setup error:', error);
    return NextResponse.json({
      error: 'Failed to setup streaming response',
      message: 'Could not establish streaming connection'
    }, { status: 500 });
  }
}

/**
 * Handle non-streaming AI response - FIXED BASED ON ACTUAL MASTRA RESPONSE
 */
async function handleNonStreamingResponse(
  message: string,
  context: any,
  agentId: string | undefined,
  currentConversation: any
) {
  try {
    // Get AI response from Mastra service
    const aiResponse = await mastraService.chat(context.userId, message, {
      chatId: currentConversation.id, // Using chatId parameter as in your service
      agentId,
      stream: false,
      conversationHistory: context.conversationHistory,
    });

    if (!aiResponse.success) {
      throw new Error(aiResponse.error || 'Failed to get AI response');
    }

    // Save assistant message to database - FIXED SCHEMA
    await db.insert(messages).values({
      conversationId: currentConversation.id,
      content: aiResponse.message || '',
      role: 'assistant',
      agentType: mapAgentNameToType(aiResponse.agent),
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: aiResponse.message,
      conversationId: currentConversation.id,
      agentName: aiResponse.agent || 'Smartlyte AI',
      agentType: mapAgentNameToType(aiResponse.agent),
      routingInfo: aiResponse.routingInfo,
    });

  } catch (error) {
    console.error('Non-streaming response error:', error);
    return NextResponse.json({
      error: 'Failed to process message',
      message: 'Could not generate AI response'
    }, { status: 500 });
  }
}

/**
 * Helper function to map agent names to agent types
 */
function mapAgentNameToType(agentName: string): 'router' | 'digital_mentor' | 'finance_guide' | 'health_coach' {
  const mapping: Record<string, 'router' | 'digital_mentor' | 'finance_guide' | 'health_coach'> = {
    'Intelligent Router': 'router',
    'Smartlyte Intelligent Router': 'router',
    'Digital Mentor': 'digital_mentor',
    'Finance Guide': 'finance_guide',
    'Health Coach': 'health_coach',
  };
  
  return mapping[agentName] || 'router';
}

/**
 * GET /api/chat - Get user's conversation list (lightweight version)
 * Returns basic conversation information
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user - FIXED AUTH PATTERN
    const authResult = await auth();
    const userId = authResult?.userId;
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please sign in to view conversations' 
      }, { status: 401 });
    }

    // 2. Get recent conversations - FIXED SCHEMA
    const recentConversations = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        summary: conversations.summary,
      })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(20);

    return NextResponse.json({
      success: true,
      conversations: recentConversations,
      metadata: {
        count: recentConversations.length,
        requestedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json({
      error: 'Failed to retrieve conversations',
      message: 'Could not load conversation history'
    }, { status: 500 });
  }
}