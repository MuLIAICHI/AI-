// src/mastra/tools/assessment-tool.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * In-memory storage for assessment results
 */
const assessmentResults: Record<string, {
  userId: string;
  subjectArea: string;
  responses: Array<{
    questionId: string;
    canPerform: boolean;
    confidenceLevel: number;
  }>;
  skillLevel: "beginner" | "intermediate" | "advanced";
  timestamp: string;
}> = {};

// Define the skill level type to ensure type safety
type SkillLevel = "beginner" | "intermediate" | "advanced";

/**
 * A tool for managing skill assessments in the Smartlyte platform.
 */
export const assessmentTool = createTool({
  id: "assessment-tool",
  description: "Manages skill assessments including generating questions, processing responses, and determining skill levels",
  
  inputSchema: z.object({
    action: z.enum(["getQuestions", "submitResponses", "getResults"]),
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
  }),
  
  // Corrected parameter structure based on the error message
  execute: async ({context}) => {
    // Extract input parameters directly from context
    const { action, userId, subjectArea, responses } = context;
    
    // Handle getQuestions action
    if (action === "getQuestions") {
      return {
        success: true,
        questions: getAssessmentQuestions(subjectArea),
      };
    }
    
    // Handle submitResponses action
    if (action === "submitResponses" && responses) {
      // Calculate skill level based on responses
      const skillLevel = calculateSkillLevel(responses);
      
      // Store assessment result
      const resultId = `${userId}-${subjectArea}-${Date.now()}`;
      assessmentResults[resultId] = {
        userId,
        subjectArea,
        responses,
        skillLevel,
        timestamp: new Date().toISOString(),
      };
      
      // Generate recommendations and next steps based on skill level
      const recommendations = getRecommendations(subjectArea, skillLevel);
      const nextSteps = getNextSteps(subjectArea, skillLevel);
      
      return {
        success: true,
        message: "Assessment completed successfully",
        result: {
          skillLevel,
          recommendations,
          nextSteps,
        },
      };
    }
    
    // Handle getResults action
    if (action === "getResults") {
      // Find the most recent assessment for this user and subject
      const userAssessments = Object.values(assessmentResults)
        .filter(result => result.userId === userId && result.subjectArea === subjectArea)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      if (userAssessments.length > 0) {
        const latestAssessment = userAssessments[0];
        
        return {
          success: true,
          result: {
            skillLevel: latestAssessment.skillLevel as SkillLevel,
            recommendations: getRecommendations(subjectArea, latestAssessment.skillLevel),
            nextSteps: getNextSteps(subjectArea, latestAssessment.skillLevel),
          },
        };
      } else {
        return {
          success: false,
          message: "No assessment results found for this user and subject",
        };
      }
    }
    
    // Handle invalid action
    return {
      success: false,
      message: "Invalid action provided",
    };
  },
});

/**
 * Helper function to get assessment questions for a specific subject area
 */
function getAssessmentQuestions(subjectArea: string) {
  // Each subject area has different assessment questions
  if (subjectArea === "digital") {
    return [
      {
        id: "digital-email",
        question: "Can you set up a new email account?",
        confidenceQuestion: "How confident are you in setting up email accounts?",
      },
      {
        id: "digital-browse",
        question: "Can you search for information online using a web browser?",
        confidenceQuestion: "How confident are you in finding information online?",
      },
      {
        id: "digital-apps",
        question: "Can you download and install mobile apps?",
        confidenceQuestion: "How confident are you in managing mobile apps?",
      },
      {
        id: "digital-security",
        question: "Can you create and manage secure passwords?",
        confidenceQuestion: "How confident are you in managing your passwords securely?",
      },
    ];
  } else if (subjectArea === "finance") {
    return [
      {
        id: "finance-budget",
        question: "Can you create a basic budget?",
        confidenceQuestion: "How confident are you in creating and sticking to a budget?",
      },
      {
        id: "finance-taxes",
        question: "Do you understand basic tax concepts?",
        confidenceQuestion: "How confident are you in your understanding of taxes?",
      },
      {
        id: "finance-savings",
        question: "Do you have strategies for saving money?",
        confidenceQuestion: "How confident are you in your approach to saving money?",
      },
      {
        id: "finance-banking",
        question: "Can you use online banking services?",
        confidenceQuestion: "How confident are you in using online banking tools?",
      },
    ];
  } else if (subjectArea === "health") {
    return [
      {
        id: "health-nhs",
        question: "Can you use the NHS app or website?",
        confidenceQuestion: "How confident are you in using NHS digital services?",
      },
      {
        id: "health-appointments",
        question: "Can you book medical appointments online?",
        confidenceQuestion: "How confident are you in managing appointments online?",
      },
      {
        id: "health-research",
        question: "Can you research health information online?",
        confidenceQuestion: "How confident are you in finding reliable health information?",
      },
      {
        id: "health-telehealth",
        question: "Can you participate in video consultations with healthcare providers?",
        confidenceQuestion: "How confident are you with telehealth appointments?",
      },
    ];
  }
  
  return [];
}

/**
 * Helper function to calculate skill level based on assessment responses
 * Returns a specific union type rather than a generic string
 */
function calculateSkillLevel(responses: Array<{
  questionId: string;
  canPerform: boolean;
  confidenceLevel: number;
}>): SkillLevel {
  // Count how many tasks the user can perform
  const canPerformCount = responses.filter(r => r.canPerform).length;
  
  // Calculate average confidence level for tasks they can perform
  const confidenceSum = responses
    .filter(r => r.canPerform)
    .reduce((sum, r) => sum + r.confidenceLevel, 0);
  
  const averageConfidence = canPerformCount > 0
    ? confidenceSum / canPerformCount
    : 0;
  
  // Determine skill level based on performance and confidence
  if (canPerformCount < responses.length * 0.5) {
    return "beginner";
  } else if (canPerformCount < responses.length * 0.8 || averageConfidence < 4) {
    return "intermediate";
  } else {
    return "advanced";
  }
}

/**
 * Helper function to get personalized recommendations based on subject area and skill level
 */
function getRecommendations(subjectArea: string, skillLevel: SkillLevel | string): string[] {
  // Use type assertion to handle potential string input
  const level = skillLevel as SkillLevel;
  
  if (subjectArea === "digital") {
    if (level === "beginner") {
      return [
        "Start with our 'Digital Basics' course",
        "Practice setting up an email account with our guided tutorial",
        "Learn about internet safety fundamentals",
      ];
    } else if (level === "intermediate") {
      return [
        "Explore our 'Efficient Web Searching' module",
        "Try the 'Managing Digital Accounts' workshop",
        "Consider learning about cloud storage solutions",
      ];
    } else {
      return [
        "Check out advanced security practices",
        "Explore our digital productivity tools course",
        "Consider learning basic coding concepts",
      ];
    }
  } else if (subjectArea === "finance") {
    if (level === "beginner") {
      return [
        "Start with 'Budgeting Basics'",
        "Learn about different types of bank accounts",
        "Explore our 'Introduction to Personal Finance' course",
      ];
    } else if (level === "intermediate") {
      return [
        "Discover strategies for debt management",
        "Explore our investment basics module",
        "Learn about tax-efficient saving options",
      ];
    } else {
      return [
        "Check out our advanced investment strategies course",
        "Explore retirement planning options",
        "Consider our 'Financial Independence' workshop",
      ];
    }
  } else if (subjectArea === "health") {
    if (level === "beginner") {
      return [
        "Start with our 'NHS Digital Services Introduction'",
        "Learn how to find reliable health information online",
        "Practice booking a test appointment online",
      ];
    } else if (level === "intermediate") {
      return [
        "Explore health tracking apps and tools",
        "Learn about managing family health records online",
        "Try our telehealth preparation course",
      ];
    } else {
      return [
        "Discover advanced health research techniques",
        "Explore digital health management systems",
        "Consider our 'Health Data Privacy' workshop",
      ];
    }
  }
  
  return ["Explore our learning modules to improve your skills"];
}

/**
 * Helper function to get next steps based on subject area and skill level
 */
function getNextSteps(subjectArea: string, skillLevel: SkillLevel | string): string[] {
  // Use type assertion to handle potential string input
  const level = skillLevel as SkillLevel;
  
  // General next steps based on skill level
  if (level === "beginner") {
    return [
      "Complete the beginner learning path",
      "Practice with our interactive tutorials",
      "Take a follow-up assessment in 2 weeks",
    ];
  } else if (level === "intermediate") {
    return [
      "Build on your existing knowledge with our interactive modules",
      "Try solving real-world scenarios in our practice environment",
      "Connect with a learning community for your subject area",
    ];
  } else {
    return [
      "Explore our expert-level content",
      "Consider mentoring beginners in our community",
      "Check out our specialized advanced courses",
    ];
  }
}
