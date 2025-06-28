// src/app/api/agents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { mastraService } from '@/lib/mastra';
import { db } from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

// Validation schemas
const agentTestSchema = z.object({
  agentIds: z.array(z.enum(['router', 'digital-mentor', 'finance-guide', 'health-coach'])).optional(),
  includeResponse: z.boolean().optional().default(false),
});

/**
 * Agent information and capabilities
 */
const AGENT_DETAILS = {
  'router': {
    id: 'router',
    name: 'Smart Router',
    displayName: 'Intelligent Router',
    description: 'Analyzes your questions and connects you with the right learning specialist',
    emoji: '🤖',
    color: '#3B82F6', // blue-500
    expertise: [
      'Intent analysis and routing',
      'General assistance and guidance',
      'Learning path recommendations',
      'Multi-agent coordination'
    ],
    capabilities: [
      'Natural language understanding',
      'Context-aware routing',
      'Fallback assistance',
      'User onboarding'
    ],
    exampleQuestions: [
      "I need help with something but I'm not sure what",
      "Can you help me learn new skills?",
      "What can you teach me?",
      "I'm new here, where do I start?"
    ],
    personality: {
      tone: 'friendly and helpful',
      approach: 'guides users to the right specialist',
      strength: 'understanding diverse user needs'
    }
  },
  'digital-mentor': {
    id: 'digital-mentor',
    name: 'Digital Mentor',
    displayName: 'Digital Skills Expert',
    description: 'Your friendly guide to mastering technology and digital skills',
    emoji: '🖥️',
    color: '#8B5CF6', // purple-500
    expertise: [
      'Email setup and management',
      'Web browsing and internet safety',
      'Mobile apps and smartphone usage',
      'Password security and online safety',
      'Social media basics and privacy',
      'Online shopping and digital payments'
    ],
    capabilities: [
      'Step-by-step technology tutorials',
      'Security best practices',
      'Device troubleshooting',
      'Digital literacy education'
    ],
    exampleQuestions: [
      "How do I set up an email account?",
      "What's the safest way to shop online?",
      "How do I use WhatsApp or Facebook?",
      "Help me understand passwords and security"
    ],
    personality: {
      tone: 'patient and encouraging',
      approach: 'breaks down complex tech into simple steps',
      strength: 'making technology accessible for everyone'
    }
  },
  'finance-guide': {
    id: 'finance-guide',
    name: 'Finance Guide',
    displayName: 'Money Management Expert',
    description: 'Your trusted advisor for financial literacy and money management',
    emoji: '💰',
    color: '#10B981', // green-500
    expertise: [
      'Personal budgeting and expense tracking',
      'Banking services and online banking',
      'Understanding bills and statements',
      'Savings strategies and financial goals',
      'Basic investment and pension concepts',
      'Tax basics and HMRC interactions'
    ],
    capabilities: [
      'Budget planning and management',
      'Financial goal setting',
      'Banking guidance',
      'Money management education'
    ],
    exampleQuestions: [
      "How do I create a monthly budget?",
      "What's the best way to save money?",
      "Help me understand my bank statements",
      "How do I set up online banking safely?"
    ],
    personality: {
      tone: 'trustworthy and practical',
      approach: 'provides clear, actionable financial advice',
      strength: 'simplifying complex financial concepts'
    }
  },
  'health-coach': {
    id: 'health-coach',
    name: 'Health Coach',
    displayName: 'Digital Health Navigator',
    description: 'Your guide to navigating digital health resources and NHS services',
    emoji: '🏥',
    color: '#EF4444', // red-500
    expertise: [
      'NHS App setup and navigation',
      'Online appointment booking',
      'Finding reliable health information',
      'Telehealth and video consultations',
      'Digital health records management',
      'NHS services and support'
    ],
    capabilities: [
      'NHS digital services guidance',
      'Health information literacy',
      'Appointment management',
      'Digital health tool education'
    ],
    exampleQuestions: [
      "How do I book a doctor's appointment online?",
      "Help me set up the NHS App",
      "Where can I find reliable health information?",
      "How do I prepare for a video consultation?"
    ],
    personality: {
      tone: 'caring and supportive',
      approach: 'empowers users to manage their health digitally',
      strength: 'navigating health systems with confidence'
    }
  }
} as const;

/**
 * GET /api/agents - Get information about all available agents
 * Returns comprehensive details about each agent including capabilities and examples
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user (optional for agent info, but useful for personalization)
    const { userId } = auth();

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('includeStats') === 'true';
    const includeExamples = searchParams.get('includeExamples') !== 'false'; // default true
    const format = searchParams.get('format') || 'detailed'; // 'detailed' | 'minimal'

    // 3. Build base agent information
    const agents = Object.values(AGENT_DETAILS).map(agent => {
      const baseInfo = {
        id: agent.id,
        name: agent.name,
        displayName: agent.displayName,
        description: agent.description,
        emoji: agent.emoji,
        color: agent.color,
        status: 'active', // Could be dynamic based on health checks
      };

      if (format === 'minimal') {
        return baseInfo;
      }

      return {
        ...baseInfo,
        expertise: agent.expertise,
        capabilities: agent.capabilities,
        personality: agent.personality,
        ...(includeExamples && { exampleQuestions: agent.exampleQuestions }),
      };
    });

    // 4. Get usage statistics if requested and user is authenticated
    let agentStats = {};
    if (includeStats && userId) {
      try {
        // Get user's message counts by agent (approximate based on routing)
        const userMessageStats = await db
          .select({
            totalChats: sql<number>`count(distinct ${chats.id})`.as('totalChats'),
            totalMessages: sql<number>`count(${messages.id})`.as('totalMessages'),
          })
          .from(chats)
          .leftJoin(messages, eq(chats.id, messages.chatId))
          .where(eq(chats.userId, userId));

        agentStats = {
          userTotalChats: parseInt(userMessageStats[0]?.totalChats?.toString() || '0'),
          userTotalMessages: parseInt(userMessageStats[0]?.totalMessages?.toString() || '0'),
          // Note: We don't track which specific agent responded to each message
          // This could be enhanced by adding an agentId field to the messages table
        };
      } catch (error) {
        console.warn('Failed to get agent stats:', error);
        // Continue without stats rather than failing
      }
    }

    // 5. Add routing information
    const routingInfo = {
      defaultAgent: 'router',
      routingStrategy: 'intelligent',
      fallbackAgent: 'router',
      supportedLanguages: ['en', 'es', 'fr', 'de', 'it'], // Based on your language tool
      availableFeatures: [
        'intelligent-routing',
        'conversation-memory',
        'multi-language-support',
        'real-time-streaming',
        'agent-switching'
      ]
    };

    return NextResponse.json({
      success: true,
      agents,
      routing: routingInfo,
      ...(includeStats && { statistics: agentStats }),
      metadata: {
        totalAgents: agents.length,
        specialistAgents: agents.length - 1, // Exclude router
        requestedAt: new Date().toISOString(),
        format,
        includeStats,
        includeExamples,
      }
    });

  } catch (error) {
    console.error('Get agents error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to retrieve agent information',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        undefined
    }, { status: 500 });
  }
}

/**
 * POST /api/agents - Test agent connectivity and health
 * Tests whether agents are responding correctly
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please sign in to test agent connectivity' 
      }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const validation = agentTestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid test request',
        message: 'Please check your request format',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { agentIds, includeResponse } = validation.data;
    const testAgents = agentIds || ['router', 'digital-mentor', 'finance-guide', 'health-coach'];

    // 3. Test agent connectivity using mastraService
    const testResults = await Promise.all(
      testAgents.map(async (agentId) => {
        const agentInfo = AGENT_DETAILS[agentId];
        const startTime = Date.now();
        
        try {
          const testMessage = "This is a connectivity test. Please respond with a brief greeting.";
          const response = await mastraService.chat(userId, testMessage, {
            agentId: agentId,
            stream: false,
          });

          const responseTime = Date.now() - startTime;
          
          return {
            agentId,
            name: agentInfo.name,
            status: response.success ? 'healthy' : 'error',
            responseTime: `${responseTime}ms`,
            error: response.success ? null : response.error,
            ...(includeResponse && response.success && { 
              testResponse: response.message?.substring(0, 100) + '...' 
            }),
          };
        } catch (error) {
          const responseTime = Date.now() - startTime;
          return {
            agentId,
            name: agentInfo.name,
            status: 'error',
            responseTime: `${responseTime}ms`,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // 4. Calculate overall health
    const healthyAgents = testResults.filter(result => result.status === 'healthy').length;
    const totalAgents = testResults.length;
    const systemHealth = {
      status: healthyAgents === totalAgents ? 'healthy' : 
               healthyAgents > 0 ? 'degraded' : 'down',
      healthyAgents,
      totalAgents,
      healthPercentage: Math.round((healthyAgents / totalAgents) * 100),
    };

    return NextResponse.json({
      success: true,
      message: 'Agent connectivity test completed',
      systemHealth,
      agentResults: testResults,
      testMetadata: {
        testedAt: new Date().toISOString(),
        userId: userId.substring(0, 8) + '...', // Partial ID for privacy
        includeResponse,
      }
    });

  } catch (error) {
    console.error('Agent test error:', error);
    return NextResponse.json({
      error: 'Failed to test agents',
      message: 'Could not complete agent connectivity test'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/agents - Update agent preferences (future enhancement)
 * Could be used for user-specific agent preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    // This endpoint is reserved for future functionality
    // Could implement user preferences like:
    // - Preferred default agent
    // - Agent personality settings  
    // - Routing preferences
    
    return NextResponse.json({
      error: 'Not implemented',
      message: 'Agent preferences are not yet configurable',
      plannedFeatures: [
        'Set preferred default agent',
        'Customize agent personalities',
        'Configure routing preferences',
        'Set language preferences per agent'
      ]
    }, { status: 501 });

  } catch (error) {
    console.error('Agent preferences error:', error);
    return NextResponse.json({
      error: 'Failed to update preferences',
      message: 'Could not update agent preferences'
    }, { status: 500 });
  }
}