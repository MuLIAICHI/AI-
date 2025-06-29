// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

// Request validation schema
const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long'),
  conversationId: z.string().uuid().optional(), // Changed from chatId to conversationId
  agentId: z.enum(['router', 'digital_mentor', 'finance_guide', 'health_coach']).optional(),
  stream: z.boolean().default(true),
});

/**
 * POST /api/chat - Main chat endpoint
 * Handles user messages and routes them to appropriate Mastra agents
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user with Clerk
    const { userId } = await auth();
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

    // 3. Get or create conversation session
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
          message: 'The requested conversation could not be found'
        }, { status: 404 });
      }
      currentConversation = existingConversation;
    } else {
      // Create new conversation session
      const [newConversation] = await db
        .insert(conversations)
        .values({
          userId,
          title: `Chat with Smartlyte AI`, // Will be updated with a better title later
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      currentConversation = newConversation;
    }

    // 4. Get recent conversation history for context
    const conversationHistory = await db
      .select({
        content: messages.content,
        role: messages.role,
        agentType: messages.agentType,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, currentConversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(20); // Get last 20 messages for context

    // Reverse to get chronological order
    conversationHistory.reverse();

    // 5. Add user message to database
    const userMessage = await db
      .insert(messages)
      .values({
        conversationId: currentConversation.id,
        role: 'user',
        content: message,
        createdAt: new Date(),
      })
      .returning();

    // 6. For now, return a simple response (you can integrate Mastra later)
    const agentResponse = `Thank you for your message: "${message}". This is a placeholder response from the ${agentId || 'router'} agent. Mastra integration coming soon!`;

    // 7. Add assistant message to database
    const assistantMessage = await db
      .insert(messages)
      .values({
        conversationId: currentConversation.id,
        role: 'assistant',
        content: agentResponse,
        agentType: agentId || 'router',
        createdAt: new Date(),
      })
      .returning();

    // 8. Update conversation timestamp
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, currentConversation.id));

    // 9. Return response (non-streaming for now)
    return NextResponse.json({
      success: true,
      conversationId: currentConversation.id,
      response: agentResponse,
      agentName: agentId || 'Smart Router',
      agentType: agentId || 'router',
      message: 'Message sent successfully'
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to process your message',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        undefined
    }, { status: 500 });
  }
}