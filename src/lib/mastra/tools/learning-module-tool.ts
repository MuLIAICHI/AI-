// src/mastra/tools/learning-module-tool.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Represents a learning module in the system
 */
interface LearningModule {
  id: string;
  title: string;
  description: string;
  subjectArea: "digital" | "finance" | "health";
  skillLevel: "beginner" | "intermediate" | "advanced";
  content: string;
  estimatedTimeMinutes: number;
  quizQuestions?: Array<{
    id: string;
    question: string;
    options: string[];
    correctOptionIndex: number;
  }>;
}

/**
 * In-memory storage for learning modules and user progress
 * In a production environment, this would be replaced with a database
 */
const learningModules: Record<string, LearningModule> = {
  // Digital skills modules
  "digital-email-basics": {
    id: "digital-email-basics",
    title: "Email Basics",
    description: "Learn how to set up and use email accounts",
    subjectArea: "digital",
    skillLevel: "beginner",
    content: "This module covers the fundamentals of email...",
    estimatedTimeMinutes: 20,
  },
  "digital-web-browsing": {
    id: "digital-web-browsing",
    title: "Web Browsing Fundamentals",
    description: "Master the basics of navigating the internet",
    subjectArea: "digital",
    skillLevel: "beginner",
    content: "This module teaches you how to use web browsers effectively...",
    estimatedTimeMinutes: 25,
  },
  
  // Finance modules
  "finance-budgeting-101": {
    id: "finance-budgeting-101",
    title: "Budgeting Basics",
    description: "Learn how to create and maintain a personal budget",
    subjectArea: "finance",
    skillLevel: "beginner",
    content: "This module introduces the concept of budgeting...",
    estimatedTimeMinutes: 30,
  },
  
  // Health modules
  "health-nhs-app": {
    id: "health-nhs-app",
    title: "Using the NHS App",
    description: "Learn how to navigate and use the NHS app",
    subjectArea: "health",
    skillLevel: "beginner",
    content: "This module guides you through setting up and using the NHS app...",
    estimatedTimeMinutes: 15,
  },
};

// Store user learning progress
const userProgress: Record<string, {
  userId: string;
  completedModules: string[];
  currentModule?: string;
  lastActivityTimestamp: string;
}> = {};

/**
 * Tool for managing learning modules and user progress
 */
export const learningModuleTool = createTool({
  id: "learning-module-tool",
  description: "Manages learning modules including retrieval, recommendations, and progress tracking",
  
  inputSchema: z.object({
    action: z.enum(["getModules", "getModule", "startModule", "completeModule", "getProgress"]),
    userId: z.string(),
    
    // Optional parameters based on action
    subjectArea: z.enum(["digital", "finance", "health"]).optional(),
    skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    moduleId: z.string().optional(),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    
    // For getModules action
    modules: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      subjectArea: z.enum(["digital", "finance", "health"]),
      skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
      estimatedTimeMinutes: z.number(),
    })).optional(),
    
    // For getModule action
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
    
    // For progress actions
    progress: z.object({
      completedModules: z.array(z.string()),
      currentModule: z.string().optional(),
      completionPercentage: z.number(),
    }).optional(),
  }),
  
  execute: async ({ context }) => {
    const { action, userId, subjectArea, skillLevel, moduleId } = context;
    
    // Initialize user progress if not exists
    if (!userProgress[userId]) {
      userProgress[userId] = {
        userId,
        completedModules: [],
        lastActivityTimestamp: new Date().toISOString(),
      };
    }
    
    // Handle getModules action
    if (action === "getModules") {
      // Filter modules by subject area and skill level if provided
      const filteredModules = Object.values(learningModules).filter(module => {
        if (subjectArea && module.subjectArea !== subjectArea) return false;
        if (skillLevel && module.skillLevel !== skillLevel) return false;
        return true;
      });
      
      // Return the list of modules without their content
      return {
        success: true,
        modules: filteredModules.map(module => ({
          id: module.id,
          title: module.title,
          description: module.description,
          subjectArea: module.subjectArea,
          skillLevel: module.skillLevel,
          estimatedTimeMinutes: module.estimatedTimeMinutes,
        })),
      };
    }
    
    // Handle getModule action
    if (action === "getModule" && moduleId) {
      const module = learningModules[moduleId];
      
      if (!module) {
        return {
          success: false,
          message: `Module with ID ${moduleId} not found`,
        };
      }
      
      // Update user's current module
      userProgress[userId].currentModule = moduleId;
      userProgress[userId].lastActivityTimestamp = new Date().toISOString();
      
      return {
        success: true,
        module,
      };
    }
    
    // Handle startModule action
    if (action === "startModule" && moduleId) {
      const module = learningModules[moduleId];
      
      if (!module) {
        return {
          success: false,
          message: `Module with ID ${moduleId} not found`,
        };
      }
      
      // Update user's current module
      userProgress[userId].currentModule = moduleId;
      userProgress[userId].lastActivityTimestamp = new Date().toISOString();
      
      return {
        success: true,
        message: `Started module "${module.title}"`,
        progress: {
          completedModules: userProgress[userId].completedModules,
          currentModule: moduleId,
          completionPercentage: calculateCompletionPercentage(userId, subjectArea),
        },
      };
    }
    
    // Handle completeModule action
    if (action === "completeModule" && moduleId) {
      const module = learningModules[moduleId];
      
      if (!module) {
        return {
          success: false,
          message: `Module with ID ${moduleId} not found`,
        };
      }
      
      // Add to completed modules if not already present
      if (!userProgress[userId].completedModules.includes(moduleId)) {
        userProgress[userId].completedModules.push(moduleId);
      }
      
      // Clear current module if it's the one being completed
      if (userProgress[userId].currentModule === moduleId) {
        userProgress[userId].currentModule = undefined;
      }
      
      userProgress[userId].lastActivityTimestamp = new Date().toISOString();
      
      return {
        success: true,
        message: `Completed module "${module.title}"`,
        progress: {
          completedModules: userProgress[userId].completedModules,
          currentModule: userProgress[userId].currentModule,
          completionPercentage: calculateCompletionPercentage(userId, subjectArea),
        },
      };
    }
    
    // Handle getProgress action
    if (action === "getProgress") {
      return {
        success: true,
        progress: {
          completedModules: userProgress[userId].completedModules,
          currentModule: userProgress[userId].currentModule,
          completionPercentage: calculateCompletionPercentage(userId, subjectArea),
        },
      };
    }
    
    // Handle invalid action
    return {
      success: false,
      message: "Invalid action provided",
    };
  },
});

/**
 * Helper function to calculate completion percentage
 */
function calculateCompletionPercentage(userId: string, subjectArea?: string): number {
  const user = userProgress[userId];
  
  if (!user.completedModules.length) {
    return 0;
  }
  
  // If subject area is provided, calculate completion for that subject only
  if (subjectArea) {
    const subjectModules = Object.values(learningModules).filter(
      module => module.subjectArea === subjectArea
    );
    
    const completedSubjectModules = user.completedModules.filter(
      moduleId => {
        const module = learningModules[moduleId];
        return module && module.subjectArea === subjectArea;
      }
    );
    
    return subjectModules.length > 0
      ? (completedSubjectModules.length / subjectModules.length) * 100
      : 0;
  }
  
  // Otherwise, calculate overall completion
  return (user.completedModules.length / Object.keys(learningModules).length) * 100;
}