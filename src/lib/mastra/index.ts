// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

/**
 * MINIMAL ROUTER AGENT - No external dependencies
 */
const simpleRouterAgent = new Agent({
  name: "Simple Router",
  instructions: "You are a helpful assistant for Smartlyte. Help users with their questions about digital skills, finance, or health.",
  model: openai("gpt-4o-mini"),
});

/**
 * Initialize minimal Mastra instance
 */
export const mastra = new Mastra({
  agents: {
    router: simpleRouterAgent,
  },
});

/**
 * Simple service for testing
 */
export const mastraService = {
  chat: async (userId: string, message: string, p0: any) => {
    try {
      const response = await simpleRouterAgent.generate([
        { role: "user", content: message }
      ]);
      
      return {
        success: true,
        agent: "router",
        message: response.text || "Hello! How can I help you today?",
      };
    } catch (error) {
      console.error("Chat error:", error);
      return {
        success: false,
        agent: "router",
        message: "I'm having trouble right now. Please try again.",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  getCurrentAgent: () => "router",
  resetConversation: () => ({ success: true }),
  getRoutingAnalytics: () => ({ router: 1 }),
};

// Default export for Mastra CLI
export default mastra;