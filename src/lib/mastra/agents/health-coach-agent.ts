// src/mastra/agents/health-coach-agent.ts
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { healthCoachPrompts } from "../prompts/domain-specific-prompts";
import { languageTool, userProfileTool, learningModuleTool, assessmentTool } from "../tools";

/**
 * Health Coach Agent - Specialized for digital health literacy
 * Helps users learn NHS app, online appointments, health research, and telehealth
 */
export const healthCoachAgent = new Agent({
  name: "Health Coach",
  instructions: healthCoachPrompts.systemPrompt,
  model: openai("gpt-4o-mini"),
  
  // Memory configuration for health learning conversations  
  // memory: new Memory({
  //   storage: new LibSQLStore({
  //     url: 'file:../mastra.db',
  //   }),
  //   options: {
  //     lastMessages: 20, // Remember health-related learning context
  //     semanticRecall: true, // Connect related health digital skills
  //     threads: {
  //       generateTitle: true, // Organize health learning sessions
  //     },
  //   },
  // }),
  
  // Tools available to the Health Coach
  tools: {
    languageTool,
    userProfileTool,
    learningModuleTool,
    assessmentTool,
  },
  
  // Configuration for health education interactions
//   maxSteps: 5, // Allow comprehensive health guidance while maintaining boundaries
});

/**
 * Helper function to get appropriate greeting based on user skill level
 */
export function getHealthCoachGreeting(skillLevel: "beginner" | "intermediate" | "advanced" = "beginner"): string {
  return healthCoachPrompts.greetings[skillLevel];
}

/**
 * Helper function to get topic introduction for health topics
 */
export function getHealthTopicIntro(topic: keyof typeof healthCoachPrompts.topicIntroductions): string {
  return healthCoachPrompts.topicIntroductions[topic];
}

/**
 * Helper function to get safety reminders for health topics
 */
export function getHealthSafetyReminder(type: keyof typeof healthCoachPrompts.safetyReminders): string {
  return healthCoachPrompts.safetyReminders[type];
}

/**
 * Helper function to get encouragement phrases for health learning
 */
export function getHealthEncouragement(): string {
  const phrases = healthCoachPrompts.encouragementPhrases;
  return phrases[Math.floor(Math.random() * phrases.length)];
}