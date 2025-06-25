// src/mastra/workflows/learning-workflow.ts
import { createWorkflow, createStep } from '@mastra/core/workflows/vNext';
import { z } from 'zod';
import { learningModuleTool, userProfileTool } from '../tools';

// Create the learning workflow
export const learningWorkflow = createWorkflow({
  id: 'learning-module-process',
  description: 'Manages the learning module experience for users',
  inputSchema: z.object({
    userId: z.string(),
    action: z.enum(["explore", "start", "complete"]),
    subjectArea: z.enum(["digital", "finance", "health"]).optional(),
    moduleId: z.string().optional(),
  }),
  outputSchema: z.object({
    userId: z.string(),
    success: z.boolean(),
    message: z.string().optional(),
    modules: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      subjectArea: z.enum(["digital", "finance", "health"]),
      skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
      estimatedTimeMinutes: z.number(),
    })).optional(),
    module: z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      subjectArea: z.enum(["digital", "finance", "health"]),
      skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
      content: z.string(),
      estimatedTimeMinutes: z.number(),
    }).optional(),
    progress: z.object({
      completedModules: z.array(z.string()),
      currentModule: z.string().optional(),
      completionPercentage: z.number(),
    }).optional(),
  }),
});

// First step: Get user profile to determine skill level
learningWorkflow
  .then(createStep({
    id: "get-user-profile",
    inputSchema: z.object({
      userId: z.string(),
      action: z.enum(["explore", "start", "complete"]),
      subjectArea: z.enum(["digital", "finance", "health"]).optional(),
      moduleId: z.string().optional(),
    }),
    outputSchema: z.object({
      userId: z.string(),
      action: z.enum(["explore", "start", "complete"]),
      subjectArea: z.enum(["digital", "finance", "health"]).optional(),
      skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
      moduleId: z.string().optional(),
    }),
    execute: async ({ inputData, runtimeContext }) => {
      // Get user profile to determine skill level
      const profileResult = await userProfileTool.execute({
        context: {
          action: "get",
          userId: inputData.userId,
        },
        runtimeContext
      });
      
      return {
        userId: inputData.userId,
        action: inputData.action,
        subjectArea: inputData.subjectArea || profileResult.profile.selectedSubject,
        skillLevel: profileResult.profile.skillLevel || "beginner",
        moduleId: inputData.moduleId,
      };
    }
  }))
  
  
  // Second step: Perform the learning action
  .then(createStep({
    id: "perform-learning-action",
    inputSchema: z.object({
      userId: z.string(),
      action: z.enum(["explore", "start", "complete"]),
      subjectArea: z.enum(["digital", "finance", "health"]).optional(),
      skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
      moduleId: z.string().optional(),
    }),
    outputSchema: z.object({
      userId: z.string(),
      success: z.boolean(),
      message: z.string().optional(),
      modules: z.array(z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        subjectArea: z.enum(["digital", "finance", "health"]),
        skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
        estimatedTimeMinutes: z.number(),
      })).optional(),
      module: z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        subjectArea: z.enum(["digital", "finance", "health"]),
        skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
        content: z.string(),
        estimatedTimeMinutes: z.number(),
        quizQuestions: z.array(z.object({
          id: z.string(),
          question: z.string(),
          options: z.array(z.string()),
          correctOptionIndex: z.number(),
        })).optional(),
      }).optional(),
      progress: z.object({
        completedModules: z.array(z.string()),
        currentModule: z.string().optional(),
        completionPercentage: z.number(),
      }).optional(),
    }),
    execute: async ({ inputData, runtimeContext }) => {
      const { userId, action, subjectArea, skillLevel, moduleId } = inputData;
      
      // Perform the appropriate action based on the input
      if (action === "explore") {
        // Get modules suitable for the user's skill level and subject area
        const result = await learningModuleTool.execute({
          context: {
            action: "getModules",
            userId,
            subjectArea,
            skillLevel,
          },
          runtimeContext
        });
        
        return {
          userId,
          success: result.success,
          message: result.message,
          modules: result.modules,
        };
      } else if (action === "start" && moduleId) {
        // Start a specific module
        const result = await learningModuleTool.execute({
          context: {
            action: "startModule",
            userId,
            moduleId,
          },
          runtimeContext
        });
        
        // Additionally get the module content
        const moduleResult = await learningModuleTool.execute({
          context: {
            action: "getModule",
            userId,
            moduleId,
          },
          runtimeContext
        });
        
        return {
          userId,
          success: result.success && moduleResult.success,
          message: result.message,
          module: moduleResult.module,
          progress: result.progress,
        };
      } else if (action === "complete" && moduleId) {
        // Complete a specific module
        const result = await learningModuleTool.execute({
          context: {
            action: "completeModule",
            userId,
            moduleId,
          },
          runtimeContext
        });
        
        return {
          userId,
          success: result.success,
          message: result.message,
          progress: result.progress,
        };
      }
      
      // Handle invalid action or missing moduleId
      return {
        userId,
        success: false,
        message: "Invalid action or missing moduleId",
      };
    }
  }))
  .commit();

export default learningWorkflow;