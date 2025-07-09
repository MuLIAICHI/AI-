// src/lib/mastra/agents/router-agent.ts
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { languageTool, userProfileTool, assessmentTool } from "../tools";

/**
 * 🎯 NEW: ONBOARDING SYSTEM PROMPT
 * Used when user needs onboarding (onboardingCompleted: false)
 */
const ONBOARDING_SYSTEM_PROMPT = `You are the welcoming guide for Smartlyte, an AI learning platform that helps people build digital skills, manage money better, and navigate health resources.

Your role is to provide a warm, patient, and encouraging onboarding experience for new users.

ONBOARDING FLOW (Complete these steps in order):

🌟 STEP 1: WARM WELCOME
- Greet the user warmly and personally
- Introduce yourself as their AI learning guide
- Briefly explain what Smartlyte offers:
  🖥️ Digital Skills - Email, internet safety, using apps and devices
  💰 Financial Skills - Budgeting, banking, saving money, understanding bills
  🏥 Health Resources - NHS apps, online appointments, finding health info

🌍 STEP 2: LANGUAGE PREFERENCE
- Ask for their preferred language in a friendly way
- Supported languages: English, Spanish, French, German, Italian, Chinese, Arabic, Hindi
- Use the languageTool to detect language from their messages
- Make it clear this is to help them learn more effectively

👋 STEP 3: PERSONAL CONNECTION (OPTIONAL)
- Ask for their first name in a warm way
- Make it clear this is completely optional
- Explain it helps personalize their learning experience
- Use the userProfileTool to save their preferences

🎯 STEP 4: LEARNING AREA SELECTION
- Help them choose their main learning focus:
  🖥️ Digital Skills - If they want help with technology, computers, phones, internet
  💰 Financial Skills - If they want help with money, budgeting, banking, saving
  🏥 Health Resources - If they want help with health apps, online appointments, NHS services
- Ask what interests them most right now
- It's okay if they're not sure - help them explore

📊 STEP 5: QUICK SKILL CHECK (OPTIONAL)
- Based on their chosen area, ask about their current comfort level
- Are they a complete beginner, have some experience, or fairly experienced?
- Use the assessmentTool if needed
- Keep it conversational, not like a test

🎉 STEP 6: COMPLETION & WELCOME
- Congratulate them on completing setup
- Summarize their preferences
- Introduce them to their chosen specialist or offer to start with general guidance
- Add "ONBOARDING_COMPLETE" in your response to signal completion
- Express excitement about their learning journey

TONE AND APPROACH:
- Warm, friendly, and encouraging
- Patient and supportive
- Use simple language (some users have low digital literacy)
- Celebrate small wins
- Respect their choices and privacy
- Don't rush through steps
- Ask one main question at a time
- Be genuinely helpful and caring

REMEMBER: You're their first experience with Smartlyte - make it positive and welcoming!`;

/**
 * ✅ ENHANCED: INTELLIGENT ROUTER SYSTEM PROMPT
 * Used when user has completed onboarding (onboardingCompleted: true)
 */
const INTELLIGENT_ROUTER_PROMPT = `You are the Intelligent Router for Smartlyte, an AI learning platform that helps people build digital, financial, and health skills.

Your primary responsibility is to analyze user messages and determine which specialist agent should handle their request, OR handle general conversations yourself.

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
- Using video calls, messaging apps

💰 FINANCE GUIDE - Route here for:
- Personal budgeting, expense tracking
- Banking services, online banking setup
- Understanding taxes, tax preparation
- Savings strategies, financial goals
- Understanding bills, statements, financial documents
- Basic investment concepts, retirement planning
- Debt management, credit understanding
- Financial planning, money management tools
- Benefits and government financial support

🏥 HEALTH COACH - Route here for:
- NHS app setup and navigation
- Online appointment booking systems
- Finding reliable health information online
- Telehealth/video consultation preparation
- Digital health record management
- Health-related mobile apps and tools
- Online prescription services
- Healthcare provider communication tools
- Understanding health websites and resources

ROUTING INSTRUCTIONS:
When a user sends a message, you should:
1. Analyze their message for keywords and intent
2. Use the intelligentRoutingTool to get a routing recommendation if available
3. If confidence is high (>0.7), recommend routing to the specialist
4. If confidence is low (<0.7) or it's a general question, handle it yourself
5. For follow-up questions or clarifications, provide helpful responses

RESPONSE FORMATS:

For routing to specialists:
"I can help you with that! Based on your question about [topic], I'm connecting you with our [Specialist Name] who specializes in [area]. They'll be able to give you expert guidance on [specific topic]."

For general assistance (you handle):
Provide helpful, encouraging responses while staying within your knowledge areas.

For clarification needed:
"I'd be happy to help! Could you tell me a bit more about what you're looking for? Are you interested in technology skills, money management, or health resources?"

USER CONTEXT AWARENESS:
- Use their name if provided
- Reference their previous learning areas or interests
- Be encouraging about their learning progress
- Maintain a supportive, patient tone

Remember: You are both a router AND a helpful learning assistant. Make every interaction positive and educational.`;

/**
 * 🎯 NEW: Intelligent Routing Tool (Enhanced)
 * Analyzes user messages and provides routing recommendations
 */
const intelligentRoutingTool = createTool({
  id: "intelligent-routing-tool",
  description: "Analyzes user messages to determine optimal agent routing",
  inputSchema: z.object({
    userMessage: z.string().describe("The user's message to analyze"),
    conversationHistory: z.array(z.string()).optional().describe("Recent conversation context"),
    userProfile: z.object({
      preferredSubject: z.enum(["digital", "finance", "health"]).optional(),
      skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      name: z.string().optional(),
    }).optional().describe("User's profile information"),
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
    const { userMessage, conversationHistory = [], userProfile } = context;
    
    // Simple keyword-based routing logic
    const message = userMessage.toLowerCase();
    
    // Digital skills keywords
    const digitalKeywords = [
      'email', 'computer', 'phone', 'mobile', 'app', 'internet', 'wifi', 'password',
      'website', 'browser', 'smartphone', 'tablet', 'laptop', 'digital', 'technology',
      'social media', 'facebook', 'whatsapp', 'video call', 'zoom', 'security',
      'online shopping', 'download', 'install', 'login', 'account', 'device'
    ];
    
    // Finance keywords
    const financeKeywords = [
      'money', 'budget', 'bank', 'banking', 'save', 'saving', 'spend', 'spending',
      'bill', 'bills', 'payment', 'card', 'credit', 'debit', 'loan', 'debt',
      'tax', 'taxes', 'pension', 'benefits', 'universal credit', 'investment',
      'mortgage', 'insurance', 'financial', 'finance', 'cost', 'expensive', 'cheap'
    ];
    
    // Health keywords
    const healthKeywords = [
      'health', 'nhs', 'doctor', 'appointment', 'hospital', 'medical', 'medicine',
      'prescription', 'gp', 'clinic', 'health app', 'patient', 'symptoms',
      'treatment', 'therapy', 'mental health', 'wellness', 'illness', 'disease',
      'vaccine', 'vaccination', 'telehealth', 'online consultation'
    ];
    
    // Count keyword matches
    const digitalScore = digitalKeywords.filter(keyword => message.includes(keyword)).length;
    const financeScore = financeKeywords.filter(keyword => message.includes(keyword)).length;
    const healthScore = healthKeywords.filter(keyword => message.includes(keyword)).length;
    
    const maxScore = Math.max(digitalScore, financeScore, healthScore);
    
    let routeTo: "digital_mentor" | "finance_guide" | "health_coach" | "router" | "clarification_needed";
    let confidence: number;
    let reasoning: string;
    let userNotification: string | undefined;
    
    // Determine routing based on keyword analysis
    if (maxScore >= 2) {
      // Strong keyword match
      if (digitalScore === maxScore) {
        routeTo = "digital_mentor";
        confidence = 0.85;
        reasoning = "Strong digital skills keywords detected";
        userNotification = "I can see you're asking about technology. Let me connect you with our Digital Mentor!";
      } else if (financeScore === maxScore) {
        routeTo = "finance_guide";
        confidence = 0.85;
        reasoning = "Strong finance keywords detected";
        userNotification = "I can see you're asking about money matters. Let me connect you with our Finance Guide!";
      } else {
        routeTo = "health_coach";
        confidence = 0.85;
        reasoning = "Strong health keywords detected";
        userNotification = "I can see you're asking about health resources. Let me connect you with our Health Coach!";
      }
    } else if (maxScore === 1) {
      // Single keyword match - ask for clarification
      routeTo = "clarification_needed";
      confidence = 0.5;
      reasoning = "Single keyword match - need clarification for better routing";
      userNotification = "I can help you with that! Could you provide a bit more detail about what specifically you'd like to learn?";
    } else {
      // No clear keywords - handle generally
      routeTo = "router";
      confidence = 0.6;
      reasoning = "No specific keywords - handling generally";
      userNotification = undefined;
    }
    
    // Generate context for target agent
    const contextForAgent = `User question: "${userMessage}"
Routing confidence: ${confidence}
Routing reasoning: ${reasoning}
User profile: ${JSON.stringify(userProfile)}
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

// Extend NodeJS global type to include onboardingProgress
declare global {
  // eslint-disable-next-line no-var
  var onboardingProgress: {
    [userId: string]: {
      currentStep: "welcome" | "language" | "name" | "subject" | "assessment" | "complete";
      progress: {
        language?: string;
        name?: string;
        subject?: "digital" | "finance" | "health";
        skillLevel?: "beginner" | "intermediate" | "advanced";
      };
    };
  };
}

/**
 * 🎯 NEW: Onboarding Progress Tool
 * Tracks and manages onboarding step completion
 */
const onboardingProgressTool = createTool({
  id: "onboarding-progress-tool",
  description: "Tracks user progress through onboarding steps",
  inputSchema: z.object({
    action: z.enum(["get", "update", "complete"]),
    userId: z.string(),
    step: z.enum(["welcome", "language", "name", "subject", "assessment", "complete"]).optional(),
    data: z.object({
      language: z.string().optional(),
      name: z.string().optional(),
      subject: z.enum(["digital", "finance", "health"]).optional(),
      skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    }).optional(),
  }),
  outputSchema: z.object({
    currentStep: z.enum(["welcome", "language", "name", "subject", "assessment", "complete"]),
    progress: z.object({
      language: z.string().optional(),
      name: z.string().optional(),
      subject: z.enum(["digital", "finance", "health"]).optional(),
      skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    }),
    nextStep: z.string(),
    isComplete: z.boolean(),
  }),
  execute: async ({ context }) => {
    const { action, userId, step, data } = context;
    
    // In a real implementation, this would connect to your database
    // For now, we'll use a simple in-memory store
    if (!global.onboardingProgress) {
      global.onboardingProgress = {};
    }
    
    if (!global.onboardingProgress[userId]) {
      global.onboardingProgress[userId] = {
        currentStep: "welcome",
        progress: {},
      };
    }
    
    const userProgress = global.onboardingProgress[userId];
    
    if (action === "update" && step && data) {
      userProgress.progress = { ...userProgress.progress, ...data };
      userProgress.currentStep = step;
    }
    
    // Determine next step
    let nextStep = "Ask for their preferred language";
    let isComplete = false;
    
    if (userProgress.currentStep === "welcome") {
      nextStep = "Ask for their preferred language";
    } else if (userProgress.currentStep === "language") {
      nextStep = "Ask for their name (optional)";
    } else if (userProgress.currentStep === "name") {
      nextStep = "Help them choose a learning area";
    } else if (userProgress.currentStep === "subject") {
      nextStep = "Offer a quick skill assessment";
    } else if (userProgress.currentStep === "assessment") {
      nextStep = "Complete onboarding and welcome them";
      isComplete = true;
    }
    
    return {
      currentStep: userProgress.currentStep,
      progress: userProgress.progress,
      nextStep,
      isComplete,
    };
  },
});

/**
 * ✅ ENHANCED: Intelligent Router Agent with Onboarding Support
 */
export const routerAgent = new Agent({
  name: "Smartlyte Intelligent Router",
  instructions: INTELLIGENT_ROUTER_PROMPT, // Default to normal routing
  model: openai("gpt-4o-mini"),
  
  tools: {
    languageTool,
    userProfileTool,
    intelligentRoutingTool,
    assessmentTool,
    onboardingProgressTool, // 🎯 NEW: Onboarding progress tracking
  },
});

/**
 * 🎯 NEW: Create Onboarding Router Agent
 * Separate agent instance for onboarding mode
 */
export const onboardingRouterAgent = new Agent({
  name: "Smartlyte Onboarding Guide",
  instructions: ONBOARDING_SYSTEM_PROMPT,
  model: openai("gpt-4o-mini"),
  
  tools: {
    languageTool,
    userProfileTool,
    assessmentTool,
    onboardingProgressTool,
  },
});

/**
 * 🎯 NEW: Router Service Class with Onboarding Support
 */
export class SmartlyteRouterService {
  private conversationAgents: Map<string, string> = new Map();
  
  /**
   * 🎯 NEW: Get appropriate router based on onboarding status
   */
  async getRouter(needsOnboarding: boolean): Promise<Agent> {
    return needsOnboarding ? onboardingRouterAgent : routerAgent;
  }
  
  /**
   * 🎯 NEW: Handle onboarding conversation
   */
  async handleOnboardingConversation(
    userMessage: string,
    userId: string,
    conversationHistory: string[] = []
  ) {
    try {
      const router = await this.getRouter(true);
      
      // Create context-aware prompt for onboarding
      const prompt = `User ID: ${userId}
User message: "${userMessage}"
Conversation history: ${conversationHistory.slice(-3).join(" | ") || "This is their first message"}

Please guide them through the onboarding process step by step.`;

      const response = await router.generate([
        { role: "user", content: prompt }
      ]);

      if (!response?.text) {
        throw new Error('No response from onboarding router');
      }

      // Check if onboarding was completed
      const isCompleted = this.detectOnboardingCompletion(response.text);

      return {
        agent: "router",
        confidence: 1.0,
        reasoning: "Onboarding guidance provided",
        contextForAgent: `Onboarding conversation with user ${userId}`,
        response: response.text,
        onboardingCompleted: isCompleted,
      };

    } catch (error) {
      console.error('Error in onboarding conversation:', error);
      return {
        agent: "router",
        confidence: 0.5,
        reasoning: "Onboarding error - using fallback",
        contextForAgent: `Error in onboarding for user ${userId}`,
        response: "Welcome to Smartlyte! I'm here to help you learn digital skills, manage money, and navigate health resources. What would you like to explore first?",
        onboardingCompleted: false,
      };
    }
  }

  /**
   * Get routing decision using the router agent
   */
  async getRoutingDecision(
    userMessage: string, 
    userId: string,
    conversationHistory: string[] = [],
    needsOnboarding: boolean = false
  ) {
    try {
      // 🎯 NEW: Use onboarding flow if needed
      if (needsOnboarding) {
        return await this.handleOnboardingConversation(userMessage, userId, conversationHistory);
      }

      // Use normal routing for completed users
      const router = await this.getRouter(false);
      
      const response = await router.generate([
        {
          role: "user",
          content: `Analyze this message for routing: "${userMessage}". User ID: ${userId}. Previous context: ${conversationHistory.slice(-2).join(" | ") || "None"}`
        }
      ]);

      if (!response?.text) {
        throw new Error('No response from router');
      }

      const responseText = response.text;

      // Simple routing logic based on response content
      if (responseText.toLowerCase().includes("digital mentor")) {
        return {
          agent: "digital_mentor",
          confidence: 0.8,
          reasoning: "Agent recommended digital mentor",
          contextForAgent: `User question: "${userMessage}"`,
          response: responseText,
        };
      } else if (responseText.toLowerCase().includes("finance guide")) {
        return {
          agent: "finance_guide",
          confidence: 0.8,
          reasoning: "Agent recommended finance guide",
          contextForAgent: `User question: "${userMessage}"`,
          response: responseText,
        };
      } else if (responseText.toLowerCase().includes("health coach")) {
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
    } catch (error) {
      console.error('Error in routing decision:', error);
      return {
        agent: "router",
        confidence: 0.5,
        reasoning: "Error in routing - using fallback",
        contextForAgent: `Error routing message: "${userMessage}"`,
        response: "I'm here to help! Could you tell me more about what you'd like to learn?",
      };
    }
  }
  
  /**
   * 🎯 NEW: Detect onboarding completion
   */
  private detectOnboardingCompletion(response: string): boolean {
    const completionSignals = [
      'ONBOARDING_COMPLETE',
      'onboarding complete',
      'setup complete',
      'ready to start learning',
      'let\'s begin your learning journey',
      'welcome to your learning adventure',
      'you\'re all set',
    ];
    
    const lowerResponse = response.toLowerCase();
    return completionSignals.some(signal => lowerResponse.includes(signal.toLowerCase()));
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