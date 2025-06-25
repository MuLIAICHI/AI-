// src/mastra/agents/finance-guide-agent.ts
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { financeGuidePrompts } from "../prompts/domain-specific-prompts";
import { languageTool, userProfileTool, learningModuleTool, assessmentTool } from "../tools";

/**
 * Finance Guide Agent - Specialized for financial literacy education
 * Helps users learn budgeting, taxes, savings, and online banking
 */
export const financeGuideAgent = new Agent({
  name: "Finance Guide", 
  instructions: financeGuidePrompts.systemPrompt,
  model: openai("gpt-4o-mini"),
  
  // Memory configuration for financial learning conversations
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
    options: {
      lastMessages: 20, // Important for tracking financial learning progress
      semanticRecall: true, // Help connect related financial concepts
      threads: {
        generateTitle: true, // Organize financial learning topics
      },
    },
  }),
  
  // Tools available to the Finance Guide
  tools: {
    languageTool,
    userProfileTool,
    learningModuleTool,
    assessmentTool,
  },
  
  // Configuration for financial education interactions
//   maxSteps: 5, // Allow detailed explanations of financial concepts conduct reserach, many questions, based on resp 1 have 2 to 3 questions. 
});

/**
 * Helper function to get appropriate greeting based on user skill level
 */
export function getFinanceGuideGreeting(skillLevel: "beginner" | "intermediate" | "advanced" = "beginner"): string {
  return financeGuidePrompts.greetings[skillLevel];
}

/**
 * Helper function to get topic introduction for finance topics
 */
export function getFinanceTopicIntro(topic: keyof typeof financeGuidePrompts.topicIntroductions): string {
  return financeGuidePrompts.topicIntroductions[topic];
}

/**
 * Helper function to get practical examples for finance concepts
 */
export function getFinancePracticalExample(concept: keyof typeof financeGuidePrompts.practicalExamples): string {
  return financeGuidePrompts.practicalExamples[concept];
}