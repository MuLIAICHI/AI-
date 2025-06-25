// src/mastra/prompts/index.ts

// Export all prompts for easy importing
export * from "./onboarding-prompts";
export * from "./domain-specific-prompts"; 
export * from "./assessment-prompts";

// Grouped exports for convenience
export { domainPrompts } from "./domain-specific-prompts";
export { assessmentPrompts } from "./assessment-prompts";
export { onboardingPrompts } from "./onboarding-prompts";