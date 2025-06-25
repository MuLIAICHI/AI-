// src/mastra/workflows/assessment-workflow.ts
import { createWorkflow, createStep } from '@mastra/core/workflows/vNext';
import { z } from 'zod';
import { assessmentTool, userProfileTool } from '../tools';

// Create our assessment workflow
export const assessmentWorkflow = createWorkflow({
  id: 'skill-assessment-process',
  description: 'Evaluates user skills in their chosen subject area',
  inputSchema: z.object({
    userId: z.string(),
    subjectArea: z.enum(["digital", "finance", "health"]),
    responses: z.array(z.object({
      questionId: z.string(),
      canPerform: z.boolean(),
      confidenceLevel: z.number().min(1).max(5),
    })).optional(),
  }),
  outputSchema: z.object({
    userId: z.string(),
    subjectArea: z.enum(["digital", "finance", "health"]),
    skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
    recommendations: z.array(z.string()),
    nextSteps: z.array(z.string()),
  }),
});

// First step: Determine what action to take based on input
assessmentWorkflow
  .then(createStep({
    id: "determine-action",
    inputSchema: z.object({
      userId: z.string(),
      subjectArea: z.enum(["digital", "finance", "health"]),
      responses: z.array(z.object({
        questionId: z.string(),
        canPerform: z.boolean(),
        confidenceLevel: z.number().min(1).max(5),
      })).optional(),
    }),
    outputSchema: z.object({
      action: z.enum(["getQuestions", "submitResponses"]),
      userId: z.string(),
      subjectArea: z.enum(["digital", "finance", "health"]),
      responses: z.array(z.object({
        questionId: z.string(),
        canPerform: z.boolean(),
        confidenceLevel: z.number().min(1).max(5),
      })).optional(),
    }),
    execute: async ({ inputData }) => {
      const hasResponses = Array.isArray(inputData.responses) && inputData.responses.length > 0;
      
      return {
        action: hasResponses ? "submitResponses" as const : "getQuestions" as const,
        userId: inputData.userId,
        subjectArea: inputData.subjectArea,
        responses: inputData.responses,
      };
    }
  }))
  
  // Second step: Call the assessment tool based on the action
  .then(createStep({
    id: "call-assessment-tool",
    inputSchema: z.object({
      action: z.enum(["getQuestions", "submitResponses"]),
      userId: z.string(),
      subjectArea: z.enum(["digital", "finance", "health"]),
      responses: z.array(z.object({
        questionId: z.string(),
        canPerform: z.boolean(),
        confidenceLevel: z.number().min(1).max(5),
      })).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string().optional(),
      questions: z.array(z.object({
        id: z.string(),
        question: z.string(),
        confidenceQuestion: z.string(),
      })).optional(),
      result: z.object({
        skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
        recommendations: z.array(z.string()),
        nextSteps: z.array(z.string()),
      }).optional(),
      userId: z.string(),
      subjectArea: z.enum(["digital", "finance", "health"]),
      action: z.enum(["getQuestions", "submitResponses"]),
    }),
    execute: async ({ inputData, runtimeContext }) => {
      // Execute the appropriate action with the assessment tool
      let result;
      
      if (inputData.action === "getQuestions") {
        result = await assessmentTool.execute({
          context: {
            action: "getQuestions",
            userId: inputData.userId,
            subjectArea: inputData.subjectArea,
          },
          runtimeContext
        });
      } else {
        result = await assessmentTool.execute({
          context: {
            action: "submitResponses",
            userId: inputData.userId,
            subjectArea: inputData.subjectArea,
            responses: inputData.responses || [],
          },
          runtimeContext
        });
      }
      
      // Return the result plus the original input data we need to preserve
      return {
        ...result,
        userId: inputData.userId,
        subjectArea: inputData.subjectArea,
        action: inputData.action,
      };
    }
  }))
  
  // Third step: Update user profile with skill level (if we have a result)
  .then(createStep({
    id: "update-profile",
    inputSchema: z.object({
      success: z.boolean(),
      message: z.string().optional(),
      questions: z.array(z.object({
        id: z.string(),
        question: z.string(),
        confidenceQuestion: z.string(),
      })).optional(),
      result: z.object({
        skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
        recommendations: z.array(z.string()),
        nextSteps: z.array(z.string()),
      }).optional(),
      userId: z.string(),
      subjectArea: z.enum(["digital", "finance", "health"]),
      action: z.enum(["getQuestions", "submitResponses"]),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string().optional(),
      questions: z.array(z.object({
        id: z.string(),
        question: z.string(),
        confidenceQuestion: z.string(),
      })).optional(),
      result: z.object({
        skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
        recommendations: z.array(z.string()),
        nextSteps: z.array(z.string()),
      }).optional(),
      userId: z.string(),
      subjectArea: z.enum(["digital", "finance", "health"]),
      profileUpdated: z.boolean(),
    }),
    execute: async ({ inputData, runtimeContext }) => {
      // Only update profile if we have assessment results (i.e., if it was a submission)
      let profileUpdated = false;
      
      if (inputData.result && inputData.action === "submitResponses") {
        // Update the user profile with the skill level
        const profileResult = await userProfileTool.execute({
          context: {
            action: "update" as const,
            userId: inputData.userId,
            profileData: {
              skillLevel: inputData.result.skillLevel,
              selectedSubject: inputData.subjectArea,
            }
          },
          runtimeContext
        });
        
        profileUpdated = profileResult.success;
      }
      
      // Return all the data plus the profile update status
      return {
        ...inputData,
        profileUpdated,
      };
    }
  }))
  
  // Final step: Format output for consistent response
  .then(createStep({
    id: "format-output",
    inputSchema: z.object({
      success: z.boolean(),
      message: z.string().optional(),
      questions: z.array(z.object({
        id: z.string(),
        question: z.string(),
        confidenceQuestion: z.string(),
      })).optional(),
      result: z.object({
        skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
        recommendations: z.array(z.string()),
        nextSteps: z.array(z.string()),
      }).optional(),
      userId: z.string(),
      subjectArea: z.enum(["digital", "finance", "health"]),
      profileUpdated: z.boolean(),
    }),
    outputSchema: z.object({
      userId: z.string(),
      subjectArea: z.enum(["digital", "finance", "health"]),
      skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
      recommendations: z.array(z.string()),
      nextSteps: z.array(z.string()),
    }),
    execute: async ({ inputData }) => {
      // For submissions, use the result data
      if (inputData.result) {
        return {
          userId: inputData.userId,
          subjectArea: inputData.subjectArea,
          skillLevel: inputData.result.skillLevel,
          recommendations: inputData.result.recommendations,
          nextSteps: inputData.result.nextSteps,
        };
      }
      
      // For question retrieval (no assessment yet), return default values
      return {
        userId: inputData.userId,
        subjectArea: inputData.subjectArea,
        skillLevel: "beginner" as const,
        recommendations: [
          "Complete the assessment to get personalized recommendations"
        ],
        nextSteps: [
          "Answer all assessment questions",
          "Submit your responses",
          "Review your personalized learning path"
        ],
      };
    }
  }))
  .commit();

export default assessmentWorkflow;