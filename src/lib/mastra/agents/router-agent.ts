// src/mastra/agents/router-agent.ts
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { languageTool, userProfileTool, assessmentTool } from "../tools";

/**
 * INTELLIGENT ROUTER SYSTEM PROMPT
 * This agent analyzes user intent and routes to appropriate specialists
 */
const INTELLIGENT_ROUTER_PROMPT = `You are the Intelligent Router for Smartlyte, an AI learning platform that helps people build digital, financial, and health skills.

Your primary responsibility is to analyze user messages and determine which specialist agent should handle their request.

AVAILABLE SPECIALIST AGENTS:

🖥️ DIGITAL MENTOR - Route here for:
- Email setup, management, troubleshooting
- Web browsing, internet safety, search skills
- Mobile apps, smartphone/tablet usage
- Password management, online account security
- Basic computer skills, file management
- Social media safety, digital communication
- Online shopping security, digital payments
- Technology troubleshooting, device setup

💰 FINANCE GUIDE - Route here for:
- Personal budgeting, expense tracking
- Banking services, online banking setup
- Understanding taxes, tax preparation
- Savings strategies, financial goals
- Understanding bills, statements, financial documents
- Basic investment concepts, retirement planning
- Debt management, credit understanding
- Financial planning, money management tools

🏥 HEALTH COACH - Route here for:
- NHS app setup and navigation
- Online appointment booking systems
- Finding reliable health information online
- Telehealth/video consultation preparation
- Digital health record management
- Health-related mobile apps and tools
- Online prescription services
- Healthcare provider communication tools

ROUTING INSTRUCTIONS:
When a user sends a message, you should:
1. Analyze their message for keywords and intent
2. Use the intelligentRoutingTool to get a routing recommendation
3. If confidence is high (>0.7), recommend routing to the specialist
4. If confidence is low (<0.7), ask clarifying questions
5. For general questions or onboarding, handle them yourself

RESPONSE FORMAT:
For routing decisions, respond with:
"I can help you with that! Based on your question about [topic], I'm connecting you with our [Specialist Name] who can provide expert guidance."

For clarification needed:
"I'd be happy to help! Could you tell me more about what you're looking for? Are you interested in technology skills, money management, or health resources?"

For general onboarding:
Handle the conversation yourself with helpful, welcoming responses.

Remember: You are both a router AND a helpful assistant. Provide value in every interaction.`;

/**
 * Enhanced routing tool with better decision logic
 */
const intelligentRoutingTool = createTool({
  id: "intelligent-routing-tool",
  description: "Analyzes user messages and routes to the most appropriate specialist agent",
  
  inputSchema: z.object({
    userMessage: z.string(),
    userId: z.string(),
    conversationHistory: z.array(z.string()).optional(),
  }),
  
  outputSchema: z.object({
    routeTo: z.enum(["digital_mentor", "finance_guide", "health_coach", "router", "clarification_needed"]),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    contextForAgent: z.string(),
    clarificationQuestion: z.string().optional(),
    userNotification: z.string().optional(),
  }),
  
  execute: async ({ context }) => {
    const { userMessage, userId, conversationHistory = [] } = context;
    
    const message = userMessage.toLowerCase();
    
    // Enhanced keyword matching with weighted scoring
    const digitalKeywords = [
      'email', 'browser', 'app', 'phone', 'computer', 'internet', 'wifi', 'password', 
      'login', 'technology', 'digital', 'website', 'smartphone', 'tablet', 'security',
      'facebook', 'whatsapp', 'social media', 'online safety', 'virus', 'malware',
      'download', 'install', 'google', 'search', 'chrome', 'safari', 'firefox'
    ];
    
    const financeKeywords = [
      'money', 'budget', 'bank', 'tax', 'save', 'spend', 'finance', 'payment', 
      'bill', 'income', 'debt', 'investment', 'pension', 'mortgage', 'loan',
      'credit', 'debit', 'online banking', 'paypal', 'direct debit', 'standing order',
      'savings account', 'current account', 'isa', 'financial planning'
    ];
    
    const healthKeywords = [
      'health', 'doctor', 'nhs', 'appointment', 'medical', 'medicine', 'hospital', 
      'clinic', 'telehealth', 'prescription', 'gp', 'surgery', 'consultant',
      'blood test', 'vaccination', 'health record', 'patient', 'symptoms',
      'nhs app', 'online health', 'video consultation', 'booking'
    ];
    
    // Calculate keyword scores
    const digitalScore = digitalKeywords.filter(kw => message.includes(kw)).length;
    const financeScore = financeKeywords.filter(kw => message.includes(kw)).length;
    const healthScore = healthKeywords.filter(kw => message.includes(kw)).length;
    
    // Determine routing with confidence
    let routeTo: "digital_mentor" | "finance_guide" | "health_coach" | "router" | "clarification_needed";
    let confidence: number;
    let reasoning: string;
    let userNotification: string | undefined;
    
    const maxScore = Math.max(digitalScore, financeScore, healthScore);
    
    if (maxScore === 0) {
      // No specific keywords found
      if (message.match(/help|start|begin|learn|new|hello|hi|welcome/)) {
        routeTo = "router";
        confidence = 0.9;
        reasoning = "General greeting or help request - handling onboarding";
        userNotification = undefined; // Handle in router
      } else {
        routeTo = "clarification_needed";
        confidence = 0.3;
        reasoning = "Unclear intent - need clarification";
        userNotification = "I'd be happy to help! Could you tell me more about what you're looking for?";
      }
    } else if (digitalScore === maxScore && digitalScore >= 2) {
      routeTo = "digital_mentor";
      confidence = Math.min(0.9, 0.6 + (digitalScore * 0.1));
      reasoning = `Strong digital technology context (${digitalScore} keywords matched)`;
      userNotification = "I'm connecting you with our Digital Mentor who specializes in technology skills!";
    } else if (financeScore === maxScore && financeScore >= 2) {
      routeTo = "finance_guide";
      confidence = Math.min(0.9, 0.6 + (financeScore * 0.1));
      reasoning = `Strong financial context (${financeScore} keywords matched)`;
      userNotification = "I'm connecting you with our Finance Guide who can help with money management!";
    } else if (healthScore === maxScore && healthScore >= 2) {
      routeTo = "health_coach";
      confidence = Math.min(0.9, 0.6 + (healthScore * 0.1));
      reasoning = `Strong health context (${healthScore} keywords matched)`;
      userNotification = "I'm connecting you with our Health Coach who specializes in digital health resources!";
    } else if (maxScore === 1) {
      // Single keyword match - lower confidence, ask for clarification
      routeTo = "clarification_needed";
      confidence = 0.5;
      reasoning = "Single keyword match - need clarification for better routing";
      userNotification = "I can help you with that! Could you provide a bit more detail about what specifically you'd like to learn?";
    } else {
      routeTo = "router";
      confidence = 0.6;
      reasoning = "Multiple weak signals - handling generally";
      userNotification = undefined; // Handle in router
    }
    
    // Generate context for target agent
    const contextForAgent = `User question: "${userMessage}"
Routing confidence: ${confidence}
Routing reasoning: ${reasoning}
Conversation history: ${conversationHistory.slice(-3).join(" | ") || "None"}`;

    // Generate clarification question if needed
    let clarificationQuestion: string | undefined;
    if (routeTo === "clarification_needed") {
      clarificationQuestion = userNotification;
    }
    
    return {
      routeTo,
      confidence,
      reasoning,
      contextForAgent,
      clarificationQuestion,
      userNotification,
    };
  },
});

/**
 * Intelligent Router Agent
 */
export const routerAgent = new Agent({
  name: "Smartlyte Intelligent Router",
  instructions: INTELLIGENT_ROUTER_PROMPT,
  model: openai("gpt-4o-mini"),
  
  // memory: new Memory({
  //   storage: new LibSQLStore({
  //     url: process.env.MASTRA_DB_URL || 'file:../mastra.db',
  //   }),
  //   options: {
  //     lastMessages: 8,
  //     semanticRecall: true,
  //     threads: {
  //       generateTitle: true,
  //     },
  //   },
  // }),
  
  tools: {
    languageTool,
    userProfileTool,
    intelligentRoutingTool,
    assessmentTool,
  },
});

/**
 * Router Service Class - Simplified to work with agent patterns
 */
export class SmartlyteRouterService {
  private conversationAgents: Map<string, string> = new Map();
  
  /**
   * Get routing decision using the router agent
   * This avoids direct tool execution outside of agent context
   */
  async getRoutingDecision(
    userMessage: string, 
    userId: string,
    conversationHistory: string[] = []
  ) {
    try {
      // Use the router agent to get routing decision
      // The agent will use its tools internally with proper context
      const response = await routerAgent.generate([
        {
          role: "user",
          content: `Analyze this message for routing: "${userMessage}". User ID: ${userId}. History: ${conversationHistory.join(", ")}`
        }
      ]);
      
      // Parse the response to extract routing information
      // Note: In a real implementation, you might want to use structured output
      // For now, we'll do keyword-based routing as fallback
      return this.parseRoutingFromResponse(response.text, userMessage, userId);
      
    } catch (error) {
      console.error("Routing decision failed:", error);
      
      // Fallback routing logic
      return this.getFallbackRouting(userMessage, userId);
    }
  }
  
  /**
   * Simplified keyword-based routing as fallback
   */
  private getFallbackRouting(userMessage: string, userId: string) {
    const message = userMessage.toLowerCase();
    
    if (message.includes('email') || message.includes('computer') || message.includes('technology')) {
      return {
        agent: "digital_mentor",
        confidence: 0.7,
        reasoning: "Fallback digital routing",
        contextForAgent: `User question: "${userMessage}"`,
      };
    } else if (message.includes('money') || message.includes('budget') || message.includes('bank')) {
      return {
        agent: "finance_guide",
        confidence: 0.7,
        reasoning: "Fallback finance routing",
        contextForAgent: `User question: "${userMessage}"`,
      };
    } else if (message.includes('health') || message.includes('nhs') || message.includes('doctor')) {
      return {
        agent: "health_coach",
        confidence: 0.7,
        reasoning: "Fallback health routing",
        contextForAgent: `User question: "${userMessage}"`,
      };
    } else {
      return {
        agent: "router",
        confidence: 0.6,
        reasoning: "Fallback general routing",
        contextForAgent: `User question: "${userMessage}"`,
      };
    }
  }
  
  /**
   * Parse routing information from agent response
   */
  private parseRoutingFromResponse(responseText: string, userMessage: string, userId: string) {
    const text = responseText.toLowerCase();
    
    // Look for routing indicators in the response
    if (text.includes('digital mentor') || text.includes('technology')) {
      return {
        agent: "digital_mentor",
        confidence: 0.8,
        reasoning: "Agent recommended digital mentor",
        contextForAgent: `User question: "${userMessage}"`,
        response: responseText,
      };
    } else if (text.includes('finance guide') || text.includes('money')) {
      return {
        agent: "finance_guide", 
        confidence: 0.8,
        reasoning: "Agent recommended finance guide",
        contextForAgent: `User question: "${userMessage}"`,
        response: responseText,
      };
    } else if (text.includes('health coach') || text.includes('health')) {
      return {
        agent: "health_coach",
        confidence: 0.8,
        reasoning: "Agent recommended health coach", 
        contextForAgent: `User question: "${userMessage}"`,
        response: responseText,
      };
    } else {
      return {
        agent: "router",
        confidence: 0.6,
        reasoning: "Agent handling generally",
        contextForAgent: `User question: "${userMessage}"`,
        response: responseText,
      };
    }
  }
  
  /**
   * Get the current agent for a user
   */
  getCurrentAgent(userId: string): string {
    return this.conversationAgents.get(userId) || "router";
  }
  
  /**
   * Manually set the current agent for a user
   */
  setCurrentAgent(userId: string, agentName: string): void {
    this.conversationAgents.set(userId, agentName);
  }
  
  /**
   * Clear agent assignment for a user (back to routing)
   */
  clearCurrentAgent(userId: string): void {
    this.conversationAgents.delete(userId);
  }
  
  /**
   * Get routing analytics
   */
  getRoutingStats(): { [key: string]: number } {
    const stats: { [key: string]: number } = {};
    Array.from(this.conversationAgents.values()).forEach(agent => {
      stats[agent] = (stats[agent] || 0) + 1;
    });
    return stats;
  }
}

// Export singleton router service
export const routerService = new SmartlyteRouterService();

// Export the routing tool for use in workflows
export { intelligentRoutingTool };