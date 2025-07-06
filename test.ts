// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { conversations, messages, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { mastraService } from '@/lib/mastra'; // ✅ Import Mastra service

// export const runtime = 'edge';

// ✅ FIXED: Request validation schema with correct agent IDs (hyphens)
const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long'),
  conversationId: z.string().uuid().nullish(), // ✅ FIXED: Use .nullish() to accept null, undefined, or string
  // ✅ FIXED: Changed underscores to hyphens to match frontend
  agentId: z.enum(['router', 'digital-mentor', 'finance-guide', 'health-coach']).nullish(), // ✅ FIXED: Also nullish for consistency
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
    console.log('📩 Received chat request:', { 
      messageLength: body?.message?.length || 0, 
      agentId: body?.agentId, 
      conversationId: body?.conversationId 
    });
    
    const validation = chatRequestSchema.safeParse(body);
    
    if (!validation.success) {
      console.error('❌ Validation failed:', validation.error.errors);
      return NextResponse.json({
        error: 'Invalid request',
        message: 'Please check your input and try again',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { message, conversationId, agentId, stream } = validation.data;
    
    // ✅ FIXED: Normalize null values to undefined for consistency
    const normalizedConversationId = conversationId || undefined;
    const normalizedAgentId = agentId || undefined;
    
    console.log('✅ Validation passed:', { 
      message: message.substring(0, 50) + '...', 
      agentId: normalizedAgentId, 
      conversationId: normalizedConversationId 
    });

    // 3. Ensure user exists in database (create if needed)
    await ensureUserExists(userId);

    // 4. Get or create conversation session
    let currentConversation;
    if (normalizedConversationId) { // ✅ Use normalized version
      // Get existing conversation and verify ownership
      const [existingConversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, normalizedConversationId))
        .limit(1);
        
      if (!existingConversation || existingConversation.userId !== userId) {
        return NextResponse.json({ 
          error: 'Conversation not found',
          message: 'The requested conversation could not be found'
        }, { status: 404 });
      }
      currentConversation = existingConversation;
      console.log('🔄 Using existing conversation:', currentConversation.id);
    } else {
      // Create new conversation session (conversationId is null, undefined, or empty)
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
      console.log('🆕 Created new conversation:', currentConversation.id);
    }

    // 5. Save user message to database
    const [userMessage] = await db
      .insert(messages)
      .values({
        conversationId: currentConversation.id,
        role: 'user',
        content: message,
        createdAt: new Date(),
      })
      .returning();

    console.log('💾 Saved user message:', userMessage.id);

    // 6. Get recent conversation history for Mastra context
    const recentMessages = await db
      .select({
        content: messages.content,
        role: messages.role,
      })
      .from(messages)
      .where(eq(messages.conversationId, currentConversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(10); // Get last 10 messages for context

    // Reverse to get chronological order (oldest first)
    const conversationHistory = recentMessages.reverse().map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    console.log('📜 Retrieved conversation history:', conversationHistory.length, 'messages');

    // 7. Generate response using Mastra agents
    let assistantResponse;
    let agentName;
    let responseAgentType;

    try {
      console.log('🤖 Calling Mastra with agent:', normalizedAgentId);
      
      // Call Mastra service with conversation context
      const mastraResponse = await mastraService.chat(userId, message, {
        agentId: normalizedAgentId,
        conversationHistory: conversationHistory,
        stream: false, // For now, use non-streaming
      });

      if (mastraResponse.success) {
        assistantResponse = mastraResponse.message || "I'm here to help! How can I assist you today?";
        agentName = mastraResponse.agent || getAgentName(normalizedAgentId);
        responseAgentType = normalizedAgentId || 'router';
        console.log('✅ Mastra response received from:', agentName);
      } else {
        throw new Error(mastraResponse.error || 'Mastra service failed');
      }
    } catch (error) {
      console.error('❌ Mastra error, using fallback:', error);
      
      // Fallback to placeholder response if Mastra fails
      assistantResponse = `Hello! I received your message: "${message}". I'm ${getAgentName(normalizedAgentId)} and I'm here to help you. (Mastra temporarily unavailable)`;
      agentName = getAgentName(normalizedAgentId);
      responseAgentType = normalizedAgentId || 'router';
    }

    // 8. Save assistant response to database
    // ✅ FIXED: Transform agent ID format for database (hyphens → underscores)
    const dbAgentType = transformAgentIdForDb(normalizedAgentId);
    
    const [assistantMessage] = await db
      .insert(messages)
      .values({
        conversationId: currentConversation.id,
        role: 'assistant',
        content: assistantResponse, // ✅ Use Mastra response
        agentType: dbAgentType,
        createdAt: new Date(),
      })
      .returning();

    console.log('🤖 Saved assistant message:', assistantMessage.id);

    // 9. Update conversation timestamp
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, currentConversation.id));

    // 10. Return success response
    return NextResponse.json({
      success: true,
      response: assistantResponse, // ✅ Use Mastra response
      agentName: agentName, // ✅ Use actual agent name from Mastra
      agentType: responseAgentType, // ✅ Use response agent type
      conversationId: currentConversation.id,
      messageId: assistantMessage.id,
    });

  } catch (error) {
    console.error('❌ Chat API error:', error);
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
 * Helper function to get friendly agent names
 */
function getAgentName(agentId?: string): string {
  const agentNames = {
    'router': 'Smart Router',
    'digital-mentor': 'Digital Mentor',
    'finance-guide': 'Finance Guide',
    'health-coach': 'Health Coach'
  };
  
  return agentNames[agentId as keyof typeof agentNames] || 'Smart Router';
}

/**
 * ✅ FIXED: Transform agent IDs from frontend format (hyphens) to database format (underscores)
 */
function transformAgentIdForDb(agentId?: string): 'router' | 'digital_mentor' | 'finance_guide' | 'health_coach' | undefined {
  if (!agentId) return undefined;
  
  const transformMap = {
    'router': 'router' as const,
    'digital-mentor': 'digital_mentor' as const,
    'finance-guide': 'finance_guide' as const,
    'health-coach': 'health_coach' as const,
  };
  
  return transformMap[agentId as keyof typeof transformMap];
}

/**
 * ✅ NEW: Ensure user exists in database (create if needed)
 * This fixes the foreign key constraint error
 */
async function ensureUserExists(userId: string): Promise<void> {
  try {
    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (existingUser) {
      console.log('👤 User already exists:', userId);
      return;
    }

    // Create user if they don't exist
    const [newUser] = await db
      .insert(users)
      .values({
        clerkId: userId,
        email: `user-${userId}@temp.com`, // Temporary email
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log('🆕 Created new user:', newUser.clerkId);
  } catch (error) {
    console.error('❌ Error ensuring user exists:', error);
    throw new Error('Failed to create or verify user');
  }
}