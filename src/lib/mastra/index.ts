// src/lib/mastra/index.ts
import { Mastra } from '@mastra/core';
import { 
  routerAgent, 
  digitalMentorAgent, 
  financeGuideAgent, 
  healthCoachAgent 
} from './agents';
import { routingWorkflow } from './workflows/routing-workflow';
import { AGENT_TYPES, type AgentType } from './config';

/**
 * COMPLETE MASTRA INSTANCE WITH ALL AGENTS
 * This replaces the simple setup with your full multi-agent system
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
  },
  // Enable telemetry for production monitoring
  telemetry: {
    enabled: process.env.NODE_ENV === 'production',
    serviceName: 'smartlyte-ai-agents',
    version: '1.0.0',
  },
});

/**
 * Helper function to get agent by ID with proper typing
 */
export function getAgentById(agentId: string) {
  const agentMap = {
    'router': mastra.agents.router,
    'digital-mentor': mastra.agents.digitalMentor,
    'finance-guide': mastra.agents.financeGuide,
    'health-coach': mastra.agents.healthCoach,
  } as const;
  
  return agentMap[agentId as keyof typeof agentMap];
}

/**
 * Helper function to map frontend agent IDs to Mastra agent keys
 */
export function mapAgentIdToMastraKey(agentId: string): keyof typeof mastra.agents {
  const mapping = {
    'router': 'router',
    'digital-mentor': 'digitalMentor',
    'finance-guide': 'financeGuide', 
    'health-coach': 'healthCoach',
  } as const;
  
  return mapping[agentId as keyof typeof mapping] || 'router';
}

/**
 * Enhanced Mastra service with intelligent routing and full agent system
 */
export const mastraService = {
  /**
   * Main chat function with intelligent routing
   */
  chat: async (userId: string, message: string, options: {
    chatId?: number;
    agentId?: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string; }>;
    stream?: boolean;
  } = {}) => {
    try {
      const { agentId, conversationHistory = [], stream = false } = options;
      
      let targetAgent;
      let routingInfo = null;

      if (agentId && agentId !== 'router') {
        // Direct agent specified
        const mastraKey = mapAgentIdToMastraKey(agentId);
        targetAgent = mastra.agents[mastraKey];
      } else {
        // Use intelligent routing workflow
        try {
          const routingResult = await mastra.workflows.intelligentRouting.run({
            userId,
            userMessage: message,
            conversationHistory: conversationHistory.map(m => m.content),
          });
          
          routingInfo = routingResult;
          const routedAgentId = routingResult.routeTo;
          
          // Map routing result to actual agent
          const agentMapping = {
            'router': 'router',
            'digital_mentor': 'digitalMentor',
            'finance_guide': 'financeGuide',
            'health_coach': 'healthCoach',
          } as const;
          
          const mappedKey = agentMapping[routedAgentId as keyof typeof agentMapping] || 'router';
          targetAgent = mastra.agents[mappedKey];
          
        } catch (routingError) {
          console.warn('Routing workflow failed, falling back to router:', routingError);
          targetAgent = mastra.agents.router;
        }
      }

      // Prepare conversation context
      const messages = [
        ...conversationHistory,
        { role: 'user' as const, content: message }
      ];

      // Generate response
      const response = await targetAgent.generate({
        messages,
        stream,
      });

      if (stream) {
        // Return streaming response
        return {
          success: true,
          agent: targetAgent.name,
          stream: response,
          routingInfo,
        };
      } else {
        // Return text response
        const responseText = response.choices?.[0]?.message?.content || response.text || "I'm here to help! How can I assist you today?";
        
        return {
          success: true,
          agent: targetAgent.name,
          message: responseText,
          routingInfo,
        };
      }

    } catch (error) {
      console.error("Mastra chat error:", error);
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
  getCurrentAgent: (agentId?: string) => {
    if (!agentId) return "router";
    
    const mastraKey = mapAgentIdToMastraKey(agentId);
    const agent = mastra.agents[mastraKey];
    return agent?.name || "router";
  },

  /**
   * Reset conversation (useful for new chat sessions)
   */
  resetConversation: async (userId: string) => {
    try {
      // Clear any cached conversation state if needed
      // This could involve clearing memory or resetting context
      return { success: true, message: "Conversation reset successfully" };
    } catch (error) {
      console.error("Reset conversation error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Reset failed" };
    }
  },

  /**
   * Get routing analytics (useful for monitoring which agents are used)
   */
  getRoutingAnalytics: () => {
    // This could be enhanced to track actual usage statistics
    return {
      router: 1,
      digitalMentor: 0, 
      financeGuide: 0,
      healthCoach: 0,
    };
  },

  /**
   * Test agent connectivity
   */
  testAgents: async () => {
    const results = {
      router: false,
      digitalMentor: false,
      financeGuide: false,
      healthCoach: false,
    };

    try {
      // Test each agent with a simple message
      const testMessage = "Hello, this is a connectivity test.";
      
      for (const [key, agent] of Object.entries(mastra.agents)) {
        try {
          const response = await agent.generate({
            messages: [{ role: 'user', content: testMessage }],
            stream: false,
          });
          
          results[key as keyof typeof results] = !!response;
        } catch (error) {
          console.warn(`Agent ${key} test failed:`, error);
          results[key as keyof typeof results] = false;
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
        results,
      };
    }
  },

  /**
   * Get agent capabilities and information
   */
  getAgentInfo: (agentId: string) => {
    const agentInfo = {
      'router': {
        name: 'Intelligent Router',
        description: 'Routes users to the most appropriate learning specialist',
        specialties: ['Intent analysis', 'User routing', 'General assistance'],
        emoji: '🤖'
      },
      'digital-mentor': {
        name: 'Digital Mentor',
        description: 'Helps with digital skills and technology literacy',
        specialties: ['Email', 'Web browsing', 'Mobile apps', 'Online security'],
        emoji: '🖥️'
      },
      'finance-guide': {
        name: 'Finance Guide',
        description: 'Provides financial literacy education and guidance',
        specialties: ['Budgeting', 'Banking', 'Taxes', 'Savings'],
        emoji: '💰'
      },
      'health-coach': {
        name: 'Health Coach',
        description: 'Assists with digital health resources and navigation',
        specialties: ['NHS app', 'Online appointments', 'Health research', 'Telehealth'],
        emoji: '🏥'
      }
    };

    return agentInfo[agentId as keyof typeof agentInfo] || agentInfo['router'];
  }
};

/**
 * Export agent type definitions for use in API routes
 */
export { AGENT_TYPES, type AgentType };

/**
 * Export specific agents for direct access if needed
 */
export {
  routerAgent,
  digitalMentorAgent, 
  financeGuideAgent,
  healthCoachAgent
};

/**
 * Export routing workflow for advanced use cases
 */
export { routingWorkflow };

/**
 * Default export for Mastra CLI compatibility
 */
export default mastra;