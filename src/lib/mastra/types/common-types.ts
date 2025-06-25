// src/mastra/types/common-types.ts

/**
 * Represents a user profile in the Smartlyte system
 */
export interface UserProfile {
  name?: string;  // Optional as per requirements
  preferredLanguage: string;
  deviceType?: string;  // Optional device information
  selectedSubject?: "digital" | "finance" | "health";  // The chosen learning area
  skillLevel?: "beginner" | "intermediate" | "advanced";  // Determined through assessment
}

/**
 * Supported languages in the platform
 * This enum is used for language detection and translation
 */
export type SupportedLanguage = 
  | "en" // English
  | "es" // Spanish
  | "fr" // French
  | "de" // German
  | "it" // Italian
  | "zh" // Chinese
  | "ar" // Arabic
  | "hi"; // Hindi

// Export all types
export * from "./common-types";