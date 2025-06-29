// src/mastra/agents/digital-mentor-agent.ts
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql"
import { digitalMentorPrompts } from "../prompts/domain-specific-prompts";
import { languageTool, userProfileTool, learningModuleTool, assessmentTool } from "../tools";

/**
 * Digital Mentor Agent - Specialized for digital skills education
 * Helps users learn email, web browsing, mobile apps, and online security
 */
export const digitalMentorAgent = new Agent({
  name: "Digital Mentor",
  instructions: digitalMentorPrompts.systemPrompt,
  model: openai("gpt-4o-mini"),
  
  // Enhanced memory for learning conversations
  // memory: new Memory({
  //   storage: new LibSQLStore({
  //     url: 'file:../mastra.db',
  //   }),
  //   options: {
  //     lastMessages: 20, // Remember more context for learning conversations
  //     semanticRecall: true, // Help recall related learning topics
  //     threads: {
  //       generateTitle: true, // Auto-generate meaningful conversation titles
  //     },
  //   },
  // }),
  
  // Tools available to the Digital Mentor
  tools: {
    languageTool,
    userProfileTool,
    learningModuleTool,
    assessmentTool,
  },
  
  // Advanced configuration for educational interactions
//   maxSteps: 5, // Allow multi-step reasoning for complex explanations
});

/**
 * Helper function to get appropriate greeting based on user skill level
 */
export function getDigitalMentorGreeting(skillLevel: "beginner" | "intermediate" | "advanced" = "beginner"): string {
  return digitalMentorPrompts.greetings[skillLevel];
}

/**
 * Helper function to get topic introduction
 */
export function getDigitalTopicIntro(topic: keyof typeof digitalMentorPrompts.topicIntroductions): string {
  return digitalMentorPrompts.topicIntroductions[topic];
}