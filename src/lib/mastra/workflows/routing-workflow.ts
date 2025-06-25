// src/mastra/workflows/routing-workflow.ts
import { createWorkflow, createStep } from '@mastra/core/workflows/vNext';
import { z } from 'zod';
import { intelligentRoutingTool } from '../agents/router-agent';
import { userProfileTool, assessmentTool } from '../tools';

/**
 * Advanced routing workflow for complex routing decisions
 * Handles multi-step routing, user profiling, and context analysis
 */
export const routingWorkflow = createWorkflow({
  id: 'intelligent-routing-process',
  description: 'Advanced routing workflow that analyzes user context and provides intelligent agent routing',
  inputSchema: z.object({
    userId: z.string(),
    userMessage: z.string(),
    conversationHistory: z.array(z.string()).optional(),
    routingContext: z.object({
      previousAgent: z.string().optional(),
      sessionLength: z.number().optional(),
      userFrustrationLevel: z.enum(["low", "medium", "high"]).optional(),
    }).optional(),
  }),
  outputSchema: z.object({
    routeTo: z.enum(["digital_mentor", "finance_guide", "health_coach", "router"]),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    contextForAgent: z.string(),
    recommendations: z.array(z.string()).optional(),
    shouldNotifyUser: z.boolean(),
    userNotification: z.string().optional(),
  }),
});

// Step 1: Analyze user profile and context
routingWorkflow
  .then(createStep({
    id: "analyze-user-context",
    inputSchema: z.object({
      userId: z.string(),
      userMessage: z.string(),
      conversationHistory: z.array(z.string()).optional(),
      routingContext: z.object({
        previousAgent: z.string().optional(),
        sessionLength: z.number().optional(),
        userFrustrationLevel: z.enum(["low", "medium", "high"]).optional(),
      }).optional(),
    }),
    outputSchema: z.object({
      userId: z.string(),
      userMessage: z.string(),
      conversationHistory: z.array(z.string()),
      userProfile: z.object({
        skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        selectedSubject: z.enum(["digital", "finance", "health"]).optional(),
        preferredLanguage: z.string().optional(),
        name: z.string().optional(),
      }),
      contextualFactors: z.object({
        isReturningUser: z.boolean(),
        hasCompletedAssessment: z.boolean(),
        sessionLength: z.number(),
        previousAgent: z.string().optional(),
        userFrustrationLevel: z.enum(["low", "medium", "high"]),
      }),
    }),
    execute: async ({ inputData, runtimeContext }) => {
      const { userId, userMessage, conversationHistory = [], routingContext = {} } = inputData;
      
      // Get user profile
      const profileResult = await userProfileTool.execute({
        context: { action: "get", userId },
        runtimeContext
      });
      
      // Check if user has completed assessments
      let hasCompletedAssessment = false;
      try {
        const assessmentResult = await assessmentTool.execute({
          context: { 
            action: "getResults", 
            userId, 
            subjectArea: profileResult.profile.selectedSubject || "digital" 
          },
          runtimeContext
        });
        hasCompletedAssessment = assessmentResult.success;
      } catch (error) {
        // Assessment not completed or error
        hasCompletedAssessment = false;
      }
      
      // Analyze contextual factors
      const contextualFactors = {
        isReturningUser: conversationHistory.length > 0,
        hasCompletedAssessment,
        sessionLength: routingContext.sessionLength || conversationHistory.length,
        previousAgent: routingContext.previousAgent,
        userFrustrationLevel: routingContext.userFrustrationLevel || "low",
      };
      
      return {
        userId,
        userMessage,
        conversationHistory,
        userProfile: profileResult.profile,
        contextualFactors,
      };
    }
  }))
  
  // Step 2: Get initial routing recommendation
  .then(createStep({
    id: "get-routing-recommendation",
    inputSchema: z.object({
      userId: z.string(),
      userMessage: z.string(),
      conversationHistory: z.array(z.string()),
      userProfile: z.object({
        skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        selectedSubject: z.enum(["digital", "finance", "health"]).optional(),
        preferredLanguage: z.string().optional(),
        name: z.string().optional(),
      }),
      contextualFactors: z.object({
        isReturningUser: z.boolean(),
        hasCompletedAssessment: z.boolean(),
        sessionLength: z.number(),
        previousAgent: z.string().optional(),
        userFrustrationLevel: z.enum(["low", "medium", "high"]),
      }),
    }),
    outputSchema: z.object({
      userId: z.string(),
      userMessage: z.string(),
      userProfile: z.object({
        skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        selectedSubject: z.enum(["digital", "finance", "health"]).optional(),
        preferredLanguage: z.string().optional(),
        name: z.string().optional(),
      }),
      contextualFactors: z.object({
        isReturningUser: z.boolean(),
        hasCompletedAssessment: z.boolean(),
        sessionLength: z.number(),
        previousAgent: z.string().optional(),
        userFrustrationLevel: z.enum(["low", "medium", "high"]),
      }),
      initialRouting: z.object({
        routeTo: z.enum(["digital_mentor", "finance_guide", "health_coach", "router", "clarification_needed"]),
        confidence: z.number().min(0).max(1),
        reasoning: z.string(),
        contextForAgent: z.string(),
        clarificationQuestion: z.string().optional(),
      }),
    }),
    execute: async ({ inputData, runtimeContext }) => {
      // Use the intelligent routing tool
      const routingResult = await intelligentRoutingTool.execute({
        context: {
          userMessage: inputData.userMessage,
          userId: inputData.userId,
          conversationHistory: inputData.conversationHistory,
          userProfile: inputData.userProfile,
        },
        runtimeContext
      });
      
      return {
        ...inputData,
        initialRouting: routingResult,
      };
    }
  }))
  
  // Step 3: Apply advanced routing logic and adjustments
  .then(createStep({
    id: "apply-advanced-routing-logic",
    inputSchema: z.object({
      userId: z.string(),
      userMessage: z.string(),
      userProfile: z.object({
        skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        selectedSubject: z.enum(["digital", "finance", "health"]).optional(),
        preferredLanguage: z.string().optional(),
        name: z.string().optional(),
      }),
      contextualFactors: z.object({
        isReturningUser: z.boolean(),
        hasCompletedAssessment: z.boolean(),
        sessionLength: z.number(),
        previousAgent: z.string().optional(),
        userFrustrationLevel: z.enum(["low", "medium", "high"]),
      }),
      initialRouting: z.object({
        routeTo: z.enum(["digital_mentor", "finance_guide", "health_coach", "router", "clarification_needed"]),
        confidence: z.number().min(0).max(1),
        reasoning: z.string(),
        contextForAgent: z.string(),
        clarificationQuestion: z.string().optional(),
      }),
    }),
    outputSchema: z.object({
      routeTo: z.enum(["digital_mentor", "finance_guide", "health_coach", "router"]),
      confidence: z.number().min(0).max(1),
      reasoning: z.string(),
      contextForAgent: z.string(),
      recommendations: z.array(z.string()),
      shouldNotifyUser: z.boolean(),
      userNotification: z.string().optional(),
    }),
    execute: async ({ inputData }) => {
      const { userProfile, contextualFactors, initialRouting, userMessage } = inputData;
      
      let finalRouting = { ...initialRouting };
      let recommendations: string[] = [];
      let shouldNotifyUser = false;
      let userNotification: string | undefined;
      
      // Advanced routing adjustments based on context
      
      // 1. Handle frustrated users - route to router for more personal attention
      if (contextualFactors.userFrustrationLevel === "high") {
        finalRouting.routeTo = "router";
        finalRouting.confidence = Math.max(0.8, finalRouting.confidence);
        finalRouting.reasoning = "User frustration detected - routing to general assistant for personalized help";
        shouldNotifyUser = true;
        userNotification = "I can see you might be having some difficulties. Let me personally help you work through this.";
      }
      
      // 2. New users without assessment - prioritize onboarding
      else if (!contextualFactors.hasCompletedAssessment && !contextualFactors.isReturningUser) {
        if (finalRouting.routeTo !== "router" && finalRouting.confidence < 0.8) {
          finalRouting.routeTo = "router";
          finalRouting.reasoning = "New user without assessment - prioritizing onboarding";
          recommendations.push("Consider taking a skill assessment to get personalized recommendations");
        }
      }
      
      // 3. Subject mismatch detection - if user has a preferred subject but routing suggests different
      else if (userProfile.selectedSubject && finalRouting.routeTo !== "router") {
        const subjectToAgent = {
          digital: "digital_mentor",
          finance: "finance_guide", 
          health: "health_coach"
        };
        
        const preferredAgent = subjectToAgent[userProfile.selectedSubject];
        
        if (preferredAgent !== finalRouting.routeTo && finalRouting.confidence < 0.9) {
          // Check if this might be a cross-domain question
          if (finalRouting.confidence > 0.6) {
            shouldNotifyUser = true;
            userNotification = `I notice this might be about ${finalRouting.routeTo.replace('_', ' ')}, but you're usually interested in ${userProfile.selectedSubject}. I'll connect you with the right specialist.`;
          }
        }
      }
      
      // 4. Agent switching detection - if user was with a different agent recently
      else if (contextualFactors.previousAgent && 
               contextualFactors.previousAgent !== finalRouting.routeTo && 
               finalRouting.routeTo !== "router") {
        shouldNotifyUser = true;
        userNotification = `I'm connecting you with our ${finalRouting.routeTo.replace('_', ' ')} for this question.`;
      }
      
      // 5. Handle clarification needed
      if (initialRouting.routeTo === "clarification_needed") {
        finalRouting.routeTo = "router";
        finalRouting.reasoning = "Unclear intent - router will ask clarifying questions";
        shouldNotifyUser = false; // Router will handle the clarification
      }
      
      // Generate recommendations based on routing and context
      if (finalRouting.routeTo === "router" && contextualFactors.hasCompletedAssessment) {
        recommendations.push("You can always ask me to connect you directly with a specialist");
      }
      
      if (!contextualFactors.hasCompletedAssessment && contextualFactors.sessionLength > 3) {
        recommendations.push("Taking a quick skill assessment could help me provide better assistance");
      }
      
      // Enhance context for agent with additional information
      const enhancedContext = `${finalRouting.contextForAgent}
      
Additional Context:
- User frustration level: ${contextualFactors.userFrustrationLevel}
- Session length: ${contextualFactors.sessionLength} messages
- Has completed assessment: ${contextualFactors.hasCompletedAssessment}
- Previous agent: ${contextualFactors.previousAgent || "none"}
- Routing confidence: ${finalRouting.confidence}`;
      
      return {
        routeTo: finalRouting.routeTo,
        confidence: finalRouting.confidence,
        reasoning: finalRouting.reasoning,
        contextForAgent: enhancedContext,
        recommendations,
        shouldNotifyUser,
        userNotification,
      };
    }
  }))
  .commit();

export default routingWorkflow;