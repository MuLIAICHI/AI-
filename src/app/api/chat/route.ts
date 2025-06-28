// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { mastraService } from '@/lib/mastra';
import { db } from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

// Request validation schema
const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long'),
  chatId: z.number().int().positive().optional(),
  agentId: z.enum(['router', 'digital-mentor', 'finance-guide', 'health-coach']).optional(),
  stream: z.boolean().default(true),
});

/**
 * POST /api/chat - Main chat endpoint
 * Handles user messages and routes them to appropriate Mastra agents
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user with Clerk
    const { userId } = auth();
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

    const { message, chatId, agentId, stream } = validation.data;

    // 3. Get or create chat session
    let currentChat;
    if (chatId) {
      // Get existing chat and verify ownership
      const [existingChat] = await db
        .select()
        .from(chats)
        .where(eq(chats.id, chatId))
        .limit(1);
        
      if (!existingChat || existingChat.userId !== userId) {
        return NextResponse.json({ 
          error: 'Chat not found',
          message: 'The requested chat session could not be found'
        }, { status: 404 });
      }
      currentChat = existingChat;
    } else {
      // Create new chat session
      const [newChat] = await db
        .insert(chats)
        .values({
          userId,
          pdfName: `Chat with Smartlyte AI`, // Will be updated with a better title later
          pdfUrl: '',
          fileKey: `chat_${userId}_${Date.now()}`,
          createdAt: new Date(),
        })
        .returning();
      currentChat = newChat;
    }

    // 4. Get recent conversation history for context
    const conversationHistory = await db
      .select({
        content: messages.content,
        role: messages.role,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.chatId, currentChat.id))
      .orderBy(desc(messages.createdAt))
      .limit(20); // Get last 20 messages for context

    // Reverse to get chronological order
    conversationHistory.reverse();

    // 5. Save user message to database
    const [userMessage] = await db
      .insert(messages)
      .values({
        chatId: currentChat.id,
        content: message,
        role: 'user',
        createdAt: new Date(),
      })
      .returning();

    // 6. Generate AI response using Mastra
    const mastraResponse = await mastraService.chat(userId, message, {
      chatId: currentChat.id,
      agentId,
      conversationHistory: conversationHistory.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      stream,
    });

    if (!mastraResponse.success) {
      // Handle Mastra service errors
      console.error('Mastra service error:', mastraResponse.error);
      
      // Save error response to maintain conversation flow
      await db.insert(messages).values({
        chatId: currentChat.id,
        content: mastraResponse.message || 'I encountered an error. Please try again.',
        role: 'assistant',
        createdAt: new Date(),
      });

      return NextResponse.json({
        error: 'AI service error',
        message: mastraResponse.message || 'I\'m having trouble right now. Please try again.',
        chatId: currentChat.id,
      }, { status: 500 });
    }

    // 7. Handle streaming vs non-streaming responses
    if (stream && mastraResponse.stream) {
      // Streaming response
      let fullResponse = '';
      const encoder = new TextEncoder();
      
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Send initial metadata
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'metadata',
              chatId: currentChat.id,
              agentId: mastraResponse.agent,
              userId: userMessage.id,
            })}\n\n`));

            // Process stream
            for await (const chunk of mastraResponse.stream) {
              const content = chunk.choices?.[0]?.delta?.content || 
                            chunk.delta?.content || 
                            chunk.content || '';
              
              if (content) {
                fullResponse += content;
                
                // Send content chunk to client
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'content',
                  content,
                  agentName: mastraResponse.agent,
                })}\n\n`));
              }
            }
            
            // Save complete response to database
            if (fullResponse.trim()) {
              await db.insert(messages).values({
                chatId: currentChat.id,
                content: fullResponse.trim(),
                role: 'assistant',
                createdAt: new Date(),
              });

              // Update chat title if it's a new chat
              if (!chatId && fullResponse.length > 10) {
                const chatTitle = `${fullResponse.substring(0, 50)}...`;
                await db
                  .update(chats)
                  .set({ pdfName: chatTitle })
                  .where(eq(chats.id, currentChat.id));
              }
            }
            
            // Send completion signal
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              chatId: currentChat.id,
              messageLength: fullResponse.length,
            })}\n\n`));
            
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
            
          } catch (error) {
            console.error('Streaming error:', error);
            
            // Send error and close stream
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: 'Stream processing failed',
            })}\n\n`));
            
            controller.close();
          }
        }
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
      
    } else {
      // Non-streaming response
      const aiResponse = mastraResponse.message || 'Hello! How can I help you today?';

      // Save assistant response to database
      const [assistantMessage] = await db
        .insert(messages)
        .values({
          chatId: currentChat.id,
          content: aiResponse,
          role: 'assistant',
          createdAt: new Date(),
        })
        .returning();

      // Update chat title if it's a new chat
      if (!chatId && aiResponse.length > 10) {
        const chatTitle = `${aiResponse.substring(0, 50)}...`;
        await db
          .update(chats)
          .set({ pdfName: chatTitle })
          .where(eq(chats.id, currentChat.id));
      }

      return NextResponse.json({
        success: true,
        response: aiResponse,
        chatId: currentChat.id,
        agentName: mastraResponse.agent,
        messageId: assistantMessage.id,
        routingInfo: mastraResponse.routingInfo || null,
      });
    }

  } catch (error) {
    console.error('Chat API error:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Something went wrong. Please try again.',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        undefined
    }, { status: 500 });
  }
}

/**
 * GET /api/chat - Get user's chat sessions
 * Returns list of user's recent chats
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Get URL parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    // Get user's chats with latest message info
    const userChats = await db
      .select({
        id: chats.id,
        title: chats.pdfName,
        createdAt: chats.createdAt,
      })
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(desc(chats.createdAt))
      .limit(limit)
      .offset(offset);

    // Get latest message for each chat
    const chatsWithMessages = await Promise.all(
      userChats.map(async (chat) => {
        const [latestMessage] = await db
          .select({
            content: messages.content,
            createdAt: messages.createdAt,
            role: messages.role,
          })
          .from(messages)
          .where(eq(messages.chatId, chat.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        return {
          ...chat,
          latestMessage: latestMessage?.content || null,
          lastMessageAt: latestMessage?.createdAt || chat.createdAt,
          lastMessageRole: latestMessage?.role || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      chats: chatsWithMessages,
      pagination: {
        limit,
        offset,
        hasMore: userChats.length === limit,
      },
    });

  } catch (error) {
    console.error('Get chats error:', error);
    return NextResponse.json({
      error: 'Failed to fetch chats',
      message: 'Could not retrieve your chat history'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/chat - Delete a chat session
 * Deletes a chat and all its messages
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Get chat ID from query params
    const { searchParams } = new URL(request.url);
    const chatIdParam = searchParams.get('chatId');
    
    if (!chatIdParam) {
      return NextResponse.json({
        error: 'Missing chat ID',
        message: 'Please specify which chat to delete'
      }, { status: 400 });
    }

    const chatId = parseInt(chatIdParam);
    if (isNaN(chatId)) {
      return NextResponse.json({
        error: 'Invalid chat ID',
        message: 'Chat ID must be a number'
      }, { status: 400 });
    }

    // Verify chat ownership
    const [chat] = await db
      .select()
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chat || chat.userId !== userId) {
      return NextResponse.json({
        error: 'Chat not found',
        message: 'The requested chat could not be found'
      }, { status: 404 });
    }

    // Delete messages first (foreign key constraint)
    await db
      .delete(messages)
      .where(eq(messages.chatId, chatId));

    // Delete chat
    await db
      .delete(chats)
      .where(eq(chats.id, chatId));

    return NextResponse.json({
      success: true,
      message: 'Chat deleted successfully',
      deletedChatId: chatId,
    });

  } catch (error) {
    console.error('Delete chat error:', error);
    return NextResponse.json({
      error: 'Failed to delete chat',
      message: 'Could not delete the chat session'
    }, { status: 500 });
  }
}