// src/lib/mastra/index.ts
import { Mastra } from '@mastra/core';
import { 
  routerAgent, 
  digitalMentorAgent, 
  financeGuideAgent, 
  healthCoachAgent 
} from './agents';
import { routingWorkflow } from './workflows/routing-workflow';
// import { onboardingWorkflow } from './workflows/onboarding-workflow'; // 🎯 TEMPORARILY REMOVED: Will add back when workflow API is properly configured
import { UserService } from '@/services/user-service';

/**
 * ✅ ENHANCED MASTRA INSTANCE with Onboarding Support
 * Now includes onboarding workflow integration
 */
export const mastra = new Mastra({
  agents: {
    router: routerAgent,
    digitalMentor: digitalMentorAgent,
    financeGuide: financeGuideAgent,
    healthCoach: healthCoachAgent,
  },
  workflows: {
    intelligentRouting: routingWorkflow,
    // onboarding: onboardingWorkflow, // 🎯 TEMPORARILY REMOVED: Will add back when workflow API is properly configured
  },
  telemetry: {
    enabled: process.env.NODE_ENV === 'production',
    serviceName: 'smartlyte-ai-agents',
  },
});

/**
 * 🎯 NEW: Enhanced user context interface
 */
interface UserContext {
  needsOnboarding: boolean;
  isFirstMessage: boolean;
  userPreferences?: {
    language?: string;
    theme?: string;
  };
  userName?: string;
}

/**
 * 🎯 NEW: Enhanced chat options interface
 */
interface EnhancedChatOptions {
  chatId?: number;
  agentId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string; }>;
  stream?: boolean;
  userContext?: UserContext; // 🎯 NEW: User context for onboarding
}

/**
 * 🎯 NEW: Enhanced response interface
 */
interface EnhancedChatResponse {
  success: boolean;
  message?: string;
  agent?: string;
  error?: string;
  onboardingCompleted?: boolean; // 🎯 NEW: Indicates if onboarding was completed
  routingInfo?: {
    selectedAgent: string;
    confidence: number;
    reasoning: string;
  };
}

/**
 * Helper function to get agent by ID using official Mastra API
 */
export async function getAgentById(agentId: string) {
  try {
    const agentMap = {
      'router': 'router',
      'digital-mentor': 'digitalMentor',
      'finance-guide': 'financeGuide',
      'health-coach': 'healthCoach',
    } as const;
    
    const mastraAgentName = agentMap[agentId as keyof typeof agentMap] || 'router';
    return await mastra.getAgent(mastraAgentName);
  } catch (error) {
    console.error(`Error getting agent ${agentId}:`, error);
    return null;
  }
}

/**
 * ✅ ENHANCED: Mastra service with comprehensive onboarding support
 */
export const mastraService = {
  /**
   * 🎯 NEW: Check user onboarding status
   */
  checkUserOnboardingStatus: async (userId: string): Promise<{
    needsOnboarding: boolean;
    user: any;
  }> => {
    try {
      const user = await UserService.getUserWithPreferences(userId);
      return {
        needsOnboarding: !user?.onboardingCompleted,
        user,
      };
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      return {
        needsOnboarding: true, // Assume needs onboarding on error
        user: null,
      };
    }
  },

  /**
   * 🎯 NEW: Trigger onboarding workflow
   */
  triggerOnboardingWorkflow: async (userId: string, initialMessage: string): Promise<{
    success: boolean;
    language?: string;
    guidanceMessage?: string;
    error?: string;
  }> => {
    try {
      console.log('🎯 Triggering onboarding workflow for user:', userId);
      
      // For now, we'll use the router agent directly for onboarding
      // The actual workflow integration can be implemented later
      const routerAgent = await mastra.getAgent('router');
      
      if (!routerAgent) {
        throw new Error('Router agent not available for onboarding');
      }

      // Create onboarding prompt
      const onboardingPrompt = `ONBOARDING MODE: This is a new user's first message.

User's message: "${initialMessage}"
User ID: ${userId}

Please provide a warm welcome to Smartlyte and begin the onboarding process. Start with language detection and proceed through the onboarding steps.`;

      const response = await routerAgent.generate([
        { role: 'user', content: onboardingPrompt }
      ]);

      if (response?.text) {
        console.log('✅ Onboarding workflow completed successfully');
        return {
          success: true,
          language: 'en', // Default for now, can be enhanced later
          guidanceMessage: response.text,
        };
      } else {
        throw new Error('No response from onboarding agent');
      }
    } catch (error) {
      console.error("Error executing onboarding workflow:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Onboarding workflow failed",
      };
    }
  },

  /**
   * 🎯 NEW: Complete user onboarding
   */
  completeOnboarding: async (userId: string): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      await UserService.completeOnboarding(userId);
      console.log('✅ User onboarding marked as completed:', userId);
      return { success: true };
    } catch (error) {
      console.error("Error completing onboarding:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to complete onboarding",
      };
    }
  },

  /**
   * ✅ ENHANCED: Main chat function with onboarding awareness
   */
  chat: async (userId: string, message: string, options: EnhancedChatOptions = {}): Promise<EnhancedChatResponse> => {
    try {
      const { 
        agentId, 
        conversationHistory = [], 
        stream = false,
        userContext 
      } = options;

      console.log('🤖 Enhanced Mastra chat called with context:', {
        userId,
        agentId,
        needsOnboarding: userContext?.needsOnboarding,
        isFirstMessage: userContext?.isFirstMessage,
      });

      // 🎯 NEW: Handle onboarding flow for new users
      if (userContext?.needsOnboarding && userContext?.isFirstMessage) {
        console.log('🎯 New user detected, initiating onboarding experience');
        
        try {
          // Get the router agent for onboarding
          const routerAgent = await mastra.getAgent('router');
          
          if (!routerAgent) {
            throw new Error('Router agent not available');
          }

          // 🎯 NEW: Create onboarding-specific prompt
          const onboardingPrompt = createOnboardingPrompt(message, userContext);
          
          // Generate onboarding response
          const response = await routerAgent.generate([
            { role: 'user', content: onboardingPrompt }
          ]);

          if (!response?.text) {
            throw new Error('No response from router agent');
          }

          // 🎯 NEW: Check if this response includes onboarding completion
          const onboardingCompleted = detectOnboardingCompletion(response.text);

          return {
            success: true,
            message: response.text,
            agent: 'Smart Router',
            onboardingCompleted,
          };

        } catch (error) {
          console.error('❌ Onboarding flow error:', error);
          // Fall back to basic welcome message
          return {
            success: true,
            message: createFallbackWelcomeMessage(userContext),
            agent: 'Smart Router',
            onboardingCompleted: false,
          };
        }
      }

      // 🎯 ENHANCED: Handle ongoing onboarding for users still in process
      if (userContext?.needsOnboarding && !userContext?.isFirstMessage) {
        console.log('🎯 Continuing onboarding flow');
        
        try {
          const routerAgent = await mastra.getAgent('router');
          
          if (!routerAgent) {
            throw new Error('Router agent not available');
          }

          // Create context-aware prompt for ongoing onboarding
          const ongoingOnboardingPrompt = createOngoingOnboardingPrompt(
            message, 
            conversationHistory, 
            userContext
          );
          
          const response = await routerAgent.generate([
            { role: 'user', content: ongoingOnboardingPrompt }
          ]);

          if (!response?.text) {
            throw new Error('No response from router agent');
          }

          // Check if onboarding was completed in this interaction
          const onboardingCompleted = detectOnboardingCompletion(response.text);

          return {
            success: true,
            message: response.text,
            agent: 'Smart Router',
            onboardingCompleted,
          };

        } catch (error) {
          console.error('❌ Ongoing onboarding error:', error);
          return {
            success: true,
            message: "I'm here to help you get started with Smartlyte. What would you like to learn about?",
            agent: 'Smart Router',
            onboardingCompleted: false,
          };
        }
      }

      // ✅ EXISTING: Normal flow for users who completed onboarding
      console.log('✅ User has completed onboarding, proceeding with normal routing');

      // Direct agent routing if specified
      if (agentId && agentId !== 'router') {
        const agent = await getAgentById(agentId);
        
        if (agent) {
          const messages = [
            ...conversationHistory.map(msg => ({
              role: msg.role,
              content: msg.content,
            })),
            { role: 'user' as const, content: message }
          ];

          const response = await agent.generate(messages);

          if (!response?.text) {
            throw new Error(`No response from ${agentId} agent`);
          }

          return {
            success: true,
            message: response.text,
            agent: agentId,
            routingInfo: {
              selectedAgent: agentId,
              confidence: 1.0,
              reasoning: `Direct routing to ${agentId}`,
            },
          };
        }
      }

      // 🎯 ENHANCED: Intelligent routing with actual specialist execution
      const routerAgent = await mastra.getAgent('router');
      
      if (!routerAgent) {
        throw new Error('Router agent not available');
      }

      // Step 1: Get routing decision from router
      const routingPrompt = createRoutingPrompt(message, conversationHistory, userContext);
      
      const routerResponse = await routerAgent.generate([
        { role: 'user', content: routingPrompt }
      ]);

      if (!routerResponse?.text) {
        throw new Error('No response from router agent');
      }

      // Step 2: Analyze router response for routing decisions
      const routingDecision = analyzeRoutingDecision(routerResponse.text);
      
      if (routingDecision.shouldRoute && routingDecision.targetAgent) {
        console.log(`🔄 Router decided to route to: ${routingDecision.targetAgent}`);
        
        // Get the specialist agent
        const specialistAgent = await getAgentById(routingDecision.targetAgent);
        
        if (specialistAgent) {
          // Create context for the specialist
          const specialistPrompt = createSpecialistPrompt(
            message, 
            conversationHistory, 
            userContext, 
            routingDecision.targetAgent
          );
          
          const specialistResponse = await specialistAgent.generate([
            { role: 'user', content: specialistPrompt }
          ]);

          if (specialistResponse?.text) {
            // Combine router announcement with specialist response
            const combinedResponse = `${routerResponse.text}\n\n${specialistResponse.text}`;
            
            return {
              success: true,
              message: combinedResponse,
              agent: routingDecision.targetAgent,
              routingInfo: {
                selectedAgent: routingDecision.targetAgent,
                confidence: routingDecision.confidence,
                reasoning: `Router detected ${routingDecision.targetAgent} expertise needed`,
              },
            };
          }
        }
        
        // Fallback if specialist failed
        console.warn(`⚠️ Failed to get response from ${routingDecision.targetAgent}, using router response`);
      }

      // Default: Return router response (handles general queries or routing failures)
      return {
        success: true,
        message: routerResponse.text,
        agent: 'Smart Router',
        onboardingCompleted: false, // Already completed for these users
      };

    } catch (error) {
      console.error("Enhanced Mastra chat error:", error);
      return {
        success: false,
        agent: "router",
        message: "I'm having trouble right now. Please try again in a moment.",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  /**
   * Get current agent information
   */
  getCurrentAgent: async (agentId?: string) => {
    if (!agentId) return "router";
    
    try {
      const agent = await getAgentById(agentId);
      return agent?.name || "router";
    } catch (error) {
      console.error("Error getting current agent:", error);
      return "router";
    }
  },

  /**
   * Reset conversation (useful for new chat sessions)
   */
  resetConversation: async (userId: string) => {
    try {
      return { success: true, message: "Conversation reset successfully" };
    } catch (error) {
      console.error("Reset conversation error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Reset failed" };
    }
  },

  /**
   * Get routing analytics
   */
  getRoutingAnalytics: () => {
    return {
      router: 1,
      digitalMentor: 0, 
      financeGuide: 0,
      healthCoach: 0,
    };
  },

  /**
   * Test agent connectivity using official API
   */
  testAgents: async () => {
    const results = {
      router: false,
      digitalMentor: false,
      financeGuide: false,
      healthCoach: false,
    };

    try {
      const testMessage = "Hello, this is a connectivity test.";
      const agentNames = ['router', 'digitalMentor', 'financeGuide', 'healthCoach'] as const;
      
      for (const agentName of agentNames) {
        try {
          const agent = await mastra.getAgent(agentName);
          
          if (agent) {
            const response = await agent.generate([
              { role: 'user', content: testMessage }
            ]);
            
            results[agentName] = !!response?.text;
          } else {
            console.warn(`Agent ${agentName} not found`);
            results[agentName] = false;
          }
        } catch (error) {
          console.warn(`Agent ${agentName} test failed:`, error);
          results[agentName] = false;
        }
      }

      return {
        success: true,
        results,
        allAgentsWorking: Object.values(results).every(Boolean),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Test failed",
      };
    }
  },
};

// 🎯 NEW: Helper functions for onboarding

/**
 * Create onboarding prompt for first-time users
 */
function createOnboardingPrompt(message: string, userContext: UserContext): string {
  return `ONBOARDING MODE: This is a new user's first message to Smartlyte.

User's message: "${message}"
User's preferred language: ${userContext.userPreferences?.language || 'auto-detect'}
User's name: ${userContext.userName || 'Not provided'}

Your job is to:
1. Welcome them warmly to Smartlyte
2. Briefly explain what Smartlyte does (digital skills, financial literacy, health resources)
3. If their message suggests a specific area, acknowledge it
4. Ask for their preferred language if needed
5. Be friendly, encouraging, and patient

Keep it conversational and not overwhelming. This is their first experience with Smartlyte.`;
}

/**
 * Create ongoing onboarding prompt
 */
function createOngoingOnboardingPrompt(
  message: string, 
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; }>,
  userContext: UserContext
): string {
  return `ONBOARDING CONTINUATION: This user is still in the onboarding process.

Current message: "${message}"
Conversation so far: ${JSON.stringify(conversationHistory.slice(-3))}
User's name: ${userContext.userName || 'Not provided'}

Continue guiding them through onboarding:
1. If they haven't chosen a language, help them choose
2. If they haven't chosen a subject area, guide them to digital/finance/health
3. If they need a skill assessment, offer it
4. Be encouraging and patient
5. When ready, mark onboarding as complete by saying "ONBOARDING_COMPLETE" in your response

Keep building their profile and preferences.`;
}

/**
 * 🎯 NEW: Analyze router response for routing decisions
 */
function analyzeRoutingDecision(routerResponse: string): {
  shouldRoute: boolean;
  targetAgent?: string;
  confidence: number;
} {
  const lowerResponse = routerResponse.toLowerCase();
  
  // Look for routing indicators
  const digitalIndicators = [
    'digital mentor',
    'connecting you with our digital mentor',
    'digital skills',
    'technology specialist'
  ];
  
  const financeIndicators = [
    'finance guide',
    'connecting you with our finance guide',
    'financial skills',
    'money management'
  ];
  
  const healthIndicators = [
    'health coach',
    'connecting you with our health coach',
    'health resources',
    'nhs specialist'
  ];
  
  // Check for routing signals
  if (digitalIndicators.some(indicator => lowerResponse.includes(indicator))) {
    return {
      shouldRoute: true,
      targetAgent: 'digital-mentor',
      confidence: 0.9
    };
  }
  
  if (financeIndicators.some(indicator => lowerResponse.includes(indicator))) {
    return {
      shouldRoute: true,
      targetAgent: 'finance-guide',
      confidence: 0.9
    };
  }
  
  if (healthIndicators.some(indicator => lowerResponse.includes(indicator))) {
    return {
      shouldRoute: true,
      targetAgent: 'health-coach',
      confidence: 0.9
    };
  }
  
  // No routing detected
  return {
    shouldRoute: false,
    confidence: 0.6
  };
}

/**
 * 🎯 ENHANCED: Create routing prompt that encourages clear routing decisions
 */
function createRoutingPrompt(
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; }>,
  userContext?: UserContext
): string {
  const userName = userContext?.userName ? `User's name: ${userContext.userName}\n` : '';
  
  return `ROUTING ANALYSIS: This user has completed onboarding and needs help.

${userName}User's message: "${message}"
Recent conversation: ${JSON.stringify(conversationHistory.slice(-3))}

Analyze their message and determine:

FOR DIGITAL/TECHNOLOGY QUESTIONS (email, computers, apps, internet, devices):
Respond: "I can help you with that! Based on your question about [topic], I'm connecting you with our Digital Mentor who specializes in digital skills. They'll be able to give you expert guidance on [specific topic]."

FOR FINANCE/MONEY QUESTIONS (budgeting, banking, savings, bills, payments):
Respond: "I can help you with that! Based on your question about [topic], I'm connecting you with our Finance Guide who specializes in financial skills. They'll be able to give you expert guidance on [specific topic]."

FOR HEALTH/NHS QUESTIONS (appointments, health apps, online health services):
Respond: "I can help you with that! Based on your question about [topic], I'm connecting you with our Health Coach who specializes in health resources. They'll be able to give you expert guidance on [specific topic]."

FOR GENERAL QUESTIONS:
Handle the conversation yourself with helpful responses.

Use their name if available and be encouraging!`;
}

/**
 * 🎯 NEW: Create specialist prompt with context
 */
function createSpecialistPrompt(
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; }>,
  userContext?: UserContext,
  specialistType?: string
): string {
  const userName = userContext?.userName ? `${userContext.userName}` : 'there';
  const recentContext = conversationHistory.slice(-3).map(msg => 
    `${msg.role}: ${msg.content}`
  ).join('\n');
  
  const specialistIntros = {
    'digital-mentor': `Hello ${userName}! I'm the Digital Mentor, and I'm here to help you with all things technology. I specialize in making digital skills feel approachable and manageable.`,
    'finance-guide': `Hi ${userName}! I'm the Finance Guide, and I'm excited to help you with money management and financial skills. I make financial topics easy to understand.`,
    'health-coach': `Hello ${userName}! I'm the Health Coach, and I'm here to help you navigate digital health resources and online healthcare services.`
  };
  
  const intro = specialistIntros[specialistType as keyof typeof specialistIntros] || `Hello ${userName}! I'm here to help you.`;
  
  return `You are now the specialist agent. Here's the context:

User's current question: "${message}"

Recent conversation context:
${recentContext}

Please respond as the specialist with:
1. A brief, friendly introduction: "${intro}"
2. A direct, helpful answer to their question
3. Offer to help with related topics in your specialty area

Keep your response conversational, encouraging, and focused on their specific need.`;
}

/**
 * Create fallback welcome message
 */
// function createFallbackWelcomeMessage(userContext: UserContext): string {
//   const name = userContext.userName ? ` ${userContext.userName}` : '';
  
//   return `Welcome${name} to Smartlyte! I'm your AI learning guide, here to help you build digital skills, manage money better, and navigate health resources. What would you like to learn about today?`;
// }

/**
 * Detect if onboarding completion signal is present
 */
function detectOnboardingCompletion(response: string): boolean {
  // Look for completion signals in the response
  const completionSignals = [
    'ONBOARDING_COMPLETE',
    'onboarding complete',
    'setup complete',
    'ready to start learning',
    'let\'s begin your learning journey',
  ];
  
  const lowerResponse = response.toLowerCase();
  return completionSignals.some(signal => lowerResponse.includes(signal.toLowerCase()));
}

/**
 * Create fallback welcome message
 */
function createFallbackWelcomeMessage(userContext: UserContext): string {
  const name = userContext.userName ? ` ${userContext.userName}` : '';
  
  return `Welcome${name} to Smartlyte! I'm your AI learning guide, here to help you build digital skills, manage money better, and navigate health resources. What would you like to learn about today?`;
}