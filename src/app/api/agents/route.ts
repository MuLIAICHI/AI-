// src/app/api/agents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { mastraService } from '@/lib/mastra';
import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema'; // ✅ Fixed: Use NEW schema
import { eq, desc, count, sql, and } from 'drizzle-orm'; // ✅ Added 'and' for combining conditions
import { z } from 'zod';

export const runtime = 'edge';

// Request validation schemas
const healthCheckSchema = z.object({
  testMessage: z.string().default('Hello, this is a test message'),
  includeStats: z.boolean().default(true),
});

// ==========================================
// AGENT CONFIGURATION DATA
// ==========================================

const AGENT_CONFIGS = {
  'router': {
    id: 'router',
    name: 'Smart Router',
    displayName: 'Intelligent Assistant',
    description: 'I analyze your questions and connect you with the right specialist',
    emoji: '🤖',
    color: '#3B82F6', // blue-500
    expertise: [
      'Intent analysis and routing',
      'General assistance and guidance',
      'Learning path recommendations',
      'Multi-specialist coordination'
    ],
    capabilities: [
      'Smart routing to specialists',
      'General conversation handling',
      'User intent understanding',
      'Contextual assistance'
    ],
    exampleQuestions: [
      "I need help with technology",
      "Can you help me with money management?",
      "I want to learn about digital health",
      "What can Smartlyte help me with?"
    ],
    personality: {
      tone: 'friendly and intelligent',
      approach: 'analyzes needs and routes efficiently',
      strength: 'understanding user intent and providing appropriate guidance'
    }
  },
  'digital-mentor': {
    id: 'digital-mentor',
    name: 'Digital Mentor',
    displayName: 'Technology Learning Guide',
    description: 'Your patient guide to mastering essential digital skills',
    emoji: '🖥️',
    color: '#8B5CF6', // purple-500
    expertise: [
      'Email setup and management',
      'Web browsing and internet safety',
      'Mobile apps and smartphone usage',
      'Password management and security',
      'Social media safety and etiquette',
      'Online shopping and digital payments'
    ],
    capabilities: [
      'Step-by-step tech tutorials',
      'Safety and security guidance',
      'Device troubleshooting',
      'Digital literacy education'
    ],
    exampleQuestions: [
      "How do I set up email on my phone?",
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
    const authResult = await auth(); // ✅ Fixed: await the auth() promise
    const userId = authResult?.userId; // ✅ Fixed: extract userId from auth result

    // 2. Get query parameters
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('stats') === 'true';
    const agentId = searchParams.get('agentId');

    // 3. If specific agent requested, return just that agent
    if (agentId && agentId in AGENT_CONFIGS) {
      const agent = AGENT_CONFIGS[agentId as keyof typeof AGENT_CONFIGS];
      
      let stats = null;
      if (includeStats && userId) {
        // Get user-specific stats for this agent
        stats = await getUserAgentStats(userId, agentId);
      }

      return NextResponse.json({
        success: true,
        agent: {
          ...agent,
          stats
        }
      });
    }

    // 4. Return all agents with optional stats
    const agentsWithStats = await Promise.all(
      Object.values(AGENT_CONFIGS).map(async (agent) => {
        let stats = null;
        if (includeStats && userId) {
          stats = await getUserAgentStats(userId, agent.id);
        }
        
        return {
          ...agent,
          stats
        };
      })
    );

    // 5. Get overall platform statistics if requested
    let platformStats = null;
    if (includeStats) {
      platformStats = await getPlatformStats(userId || undefined); // ✅ Fixed: handle null vs undefined
    }

    return NextResponse.json({
      success: true,
      agents: agentsWithStats,
      platformStats,
      totalAgents: Object.keys(AGENT_CONFIGS).length
    });

  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch agent information',
      message: 'Please try again later'
    }, { status: 500 });
  }
}

/**
 * POST /api/agents - Test agent connectivity and health
 * Useful for debugging and ensuring all agents are working properly
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const authResult = await auth(); // ✅ Fixed: await the auth() promise
    const userId = authResult?.userId; // ✅ Fixed: extract userId from auth result
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        message: 'Please sign in to test agents'
      }, { status: 401 });
    }

    // 2. Parse and validate request
    const body = await request.json();
    const validation = healthCheckSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors
      }, { status: 400 });
    }

    const { testMessage, includeStats } = validation.data;

    // 3. Test all agents with the mastraService
    const agentTests = await mastraService.testAgents(); // ✅ Fixed: no parameters

    // 4. Get usage statistics if requested
    let stats = null;
    if (includeStats) {
      stats = await getPlatformStats(userId);
    }

    // 5. Return comprehensive health check results
    return NextResponse.json({
      success: true,
      message: 'Agent health check completed',
      healthCheck: {
        timestamp: new Date().toISOString(),
        testMessage,
        ...agentTests
      },
      stats,
      recommendations: generateHealthRecommendations(agentTests)
    });

  } catch (error) {
    console.error('Error testing agents:', error);
    return NextResponse.json({
      success: false,
      error: 'Agent health check failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get user-specific statistics for an agent
 */
async function getUserAgentStats(userId: string, agentId: string) {
  try {
    // Get user's conversations using NEW schema
    const userConversations = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.userId, userId));

    if (userConversations.length === 0) {
      return {
        totalMessages: 0,
        totalConversations: 0,
        lastUsed: null,
        avgMessagesPerChat: 0
      };
    }

    const conversationIds = userConversations.map(conv => conv.id);

    // Count messages for this agent (if agentType field exists)
    const [messageStats] = await db
      .select({
        totalMessages: count(messages.id),
      })
      .from(messages)
      .where(
        and(
          sql`${messages.conversationId} IN (${sql.join(conversationIds, sql`, `)})`, // ✅ Fixed: use conversationId
          sql`${messages.agentType} = ${agentId} OR ${messages.agentType} IS NULL`
        )
      );

    // Get last message date for this agent
    const [lastMessage] = await db
      .select({
        createdAt: messages.createdAt
      })
      .from(messages)
      .where(
        and(
          sql`${messages.conversationId} IN (${sql.join(conversationIds, sql`, `)})`, // ✅ Fixed: use conversationId
          sql`${messages.agentType} = ${agentId} OR ${messages.agentType} IS NULL`
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);

    return {
      totalMessages: messageStats?.totalMessages || 0,
      totalConversations: userConversations.length,
      lastUsed: lastMessage?.createdAt || null,
      avgMessagesPerChat: userConversations.length > 0 
        ? Math.round((messageStats?.totalMessages || 0) / userConversations.length) 
        : 0
    };

  } catch (error) {
    console.error('Error getting user agent stats:', error);
    return {
      totalMessages: 0,
      totalConversations: 0,
      lastUsed: null,
      avgMessagesPerChat: 0
    };
  }
}

/**
 * Get platform-wide statistics
 */
async function getPlatformStats(userId?: string) {
  try {
    // Get total platform stats using NEW schema
    const [platformStats] = await db
      .select({
        totalConversations: count(conversations.id),
        totalMessages: count(messages.id),
      })
      .from(conversations)
      .leftJoin(messages, eq(messages.conversationId, conversations.id)); // ✅ Fixed: use conversationId

    // Get user-specific stats if userId provided
    let userStats = null;
    if (userId) {
      const [userStatsResult] = await db
        .select({
          userConversations: count(conversations.id),
        })
        .from(conversations)
        .where(eq(conversations.userId, userId));

      userStats = {
        totalConversations: userStatsResult?.userConversations || 0,
        joinDate: new Date(), // This would come from user table in real implementation
      };
    }

    return {
      platform: {
        totalConversations: platformStats?.totalConversations || 0,
        totalMessages: platformStats?.totalMessages || 0,
      },
      user: userStats
    };

  } catch (error) {
    console.error('Error getting platform stats:', error);
    return {
      platform: {
        totalConversations: 0,
        totalMessages: 0,
      },
      user: null
    };
  }
}

/**
 * Generate health recommendations based on test results
 */
function generateHealthRecommendations(testResults: any) {
  const recommendations = [];

  if (!testResults.allAgentsWorking) {
    recommendations.push({
      type: 'warning',
      message: 'Some agents failed health checks. Check your Mastra configuration.',
      action: 'Review environment variables and agent setup'
    });
  }

  if (testResults.success && testResults.allAgentsWorking) {
    recommendations.push({
      type: 'success',
      message: 'All agents are working properly!',
      action: 'Your Smartlyte AI system is ready for users'
    });
  }

  return recommendations;
}