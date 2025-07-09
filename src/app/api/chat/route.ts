// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { conversations, messages, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { mastraService } from '@/lib/mastra';
import { UserService } from '@/services/user-service';

// ✅ FIXED: Request validation schema with correct agent IDs (hyphens)
const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long'),
  conversationId: z.string().uuid().nullish(),
  agentId: z.enum(['router', 'digital-mentor', 'finance-guide', 'health-coach']).nullish(),
  stream: z.boolean().default(true),
});

/**
 * POST /api/chat - Enhanced chat endpoint with onboarding detection
 * Handles user messages and routes them to appropriate Mastra agents
 * Now includes comprehensive onboarding flow for new users
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

    // 3. 🎯 NEW: Enhanced user management with onboarding detection
    const userWithPreferences = await UserService.getUserWithPreferences(userId);
    
    if (!userWithPreferences) {
      // Create new user with comprehensive setup
      console.log('🆕 Creating new user with full onboarding setup');
      
      // Get basic user info from Clerk (if available)
      // For now, we'll use minimal data and let onboarding fill the rest
      await UserService.createUser({
        clerkId: userId,
        email: `user-${userId}@temp.com`, // Will be updated with real email from Clerk
        onboardingCompleted: false, // 🎯 KEY: Mark as needing onboarding
      });
      
      console.log('✅ New user created, onboarding required');
    }

    // 4. 🎯 NEW: Check onboarding status and determine flow
    const user = await UserService.getUserWithPreferences(userId);
    const needsOnboarding = !user?.onboardingCompleted;
    
    console.log(`🎯 User onboarding status: ${needsOnboarding ? 'NEEDS ONBOARDING' : 'COMPLETED'}`);

    // 5. Get or create conversation session
    let currentConversation;
    if (normalizedConversationId) {
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
      // Create new conversation session
      const conversationTitle = needsOnboarding 
        ? 'Welcome to Smartlyte - Getting Started'
        : `Chat with Smartlyte AI`;
        
      const [newConversation] = await db
        .insert(conversations)
        .values({
          userId,
          title: conversationTitle,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      currentConversation = newConversation;
      console.log('🆕 Created new conversation:', currentConversation.id);
    }

    // 6. Save user message to database
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

    // 7. Get recent conversation history for context
    const recentMessages = await db
      .select({
        content: messages.content,
        role: messages.role,
      })
      .from(messages)
      .where(eq(messages.conversationId, currentConversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(10);

    const conversationHistory = recentMessages.reverse().map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    console.log('📜 Retrieved conversation history:', conversationHistory.length, 'messages');

    // 8. 🎯 NEW: Enhanced Mastra call with onboarding context
    let assistantResponse;
    let agentName;
    let responseAgentType;
    let onboardingCompleted = false;

    try {
      console.log('🤖 Calling Mastra with enhanced context');
      
      // 🎯 NEW: Pass onboarding context to Mastra service
      const mastraResponse = await mastraService.chat(userId, message, {
        agentId: normalizedAgentId,
        conversationHistory: conversationHistory,
        stream: false,
        // 🎯 NEW: Pass user context for onboarding
        userContext: {
          needsOnboarding,
          isFirstMessage: conversationHistory.length <= 1,
          userPreferences: user?.preferences
            ? {
                language: user.preferences.language ?? undefined,
                theme: user.preferences.theme ?? undefined,
              }
            : undefined,
          userName: user?.firstName ?? undefined,
        },
      });

      if (mastraResponse.success) {
        assistantResponse = mastraResponse.message || "I'm here to help! How can I assist you today?";
        agentName = mastraResponse.agent || getAgentName(normalizedAgentId);
        responseAgentType = normalizedAgentId || 'router';
        
        // 🎯 NEW: Check if onboarding was completed during this interaction
        onboardingCompleted = mastraResponse.onboardingCompleted || false;
        
        console.log('✅ Mastra response received from:', agentName);
        if (onboardingCompleted) {
          console.log('🎉 Onboarding completed during this interaction!');
        }
      } else {
        throw new Error(mastraResponse.error || 'Mastra service failed');
      }
    } catch (error) {
      console.error('❌ Mastra error, using fallback:', error);
      
      // 🎯 ENHANCED: Better fallback messaging based on onboarding status
      if (needsOnboarding) {
        assistantResponse = `Welcome to Smartlyte! I'm your AI learning guide, here to help you build digital skills, manage money better, and navigate health resources. Let's start by getting to know you better - what would you like to learn about today?`;
      } else {
        assistantResponse = `Hello${user?.firstName ? ` ${user.firstName}` : ''}! I received your message: "${message}". I'm ${getAgentName(normalizedAgentId)} and I'm here to help you. (Temporarily using backup system)`;
      }
      
      agentName = getAgentName(normalizedAgentId);
      responseAgentType = normalizedAgentId || 'router';
    }

    // 9. 🎯 NEW: Update user onboarding status if completed
    if (onboardingCompleted && needsOnboarding) {
      try {
        await UserService.completeOnboarding(userId);
        console.log('✅ Marked user onboarding as completed');
      } catch (error) {
        console.error('❌ Error updating onboarding status:', error);
        // Don't fail the request if this update fails
      }
    }

    // 10. Save assistant response to database
    const dbAgentType = transformAgentIdForDb(normalizedAgentId);
    
    const [assistantMessage] = await db
      .insert(messages)
      .values({
        conversationId: currentConversation.id,
        role: 'assistant',
        content: assistantResponse,
        agentType: dbAgentType,
        createdAt: new Date(),
      })
      .returning();

    console.log('🤖 Saved assistant message:', assistantMessage.id);

    // 11. Update conversation timestamp
    await db
      .update(conversations)
      .set({ 
        updatedAt: new Date(),
        // 🎯 NEW: Update title if onboarding was completed
        ...(onboardingCompleted && { title: 'Chat with Smartlyte AI' })
      })
      .where(eq(conversations.id, currentConversation.id));

    // 12. 🎯 ENHANCED: Return response with onboarding context
    return NextResponse.json({
      success: true,
      response: assistantResponse,
      agentName: agentName,
      agentType: responseAgentType,
      conversationId: currentConversation.id,
      messageId: assistantMessage.id,
      // 🎯 NEW: Include onboarding context in response
      userContext: {
        needsOnboarding: needsOnboarding && !onboardingCompleted,
        onboardingCompleted,
        isFirstTimeUser: !user?.onboardingCompleted && conversationHistory.length <= 1,
        userName: user?.firstName,
      },
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
 * Transform agent IDs from frontend format (hyphens) to database format (underscores)
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