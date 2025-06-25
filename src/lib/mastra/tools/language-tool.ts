// src/mastra/tools/language-tool.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { SupportedLanguage } from "../types/common-types";

export const languageTool = createTool({
  id: "language-detection-tool",
  description: "Detects the language of provided text",
  inputSchema: z.object({
    text: z.string().describe("The text to analyze for language detection"),
    targetLanguage: z.string().optional().describe("Optional target language code for translation")
  }),
  outputSchema: z.object({
    detectedLanguage: z.enum([
      "en", "es", "fr", "de", "it", "zh", "ar", "hi"
    ]).describe("The detected language code"),
    translatedText: z.string().optional(),
    confidence: z.number().min(0).max(1)
  }),
  execute: async ({ context }) => {
    const { text, targetLanguage } = context;
    
    // Simple language detection logic
    let detectedLanguage: SupportedLanguage = "en";
    let confidence = 0.6;
    
    // Pattern matching for basic language detection
    if (text.match(/hola|gracias|buenos días|cómo estás/i)) {
      detectedLanguage = "es";
      confidence = 0.8;
    } else if (text.match(/bonjour|merci|comment ça va|salut/i)) {
      detectedLanguage = "fr";
      confidence = 0.8;
    }
    // Additional language patterns...
    
    let translatedText: string | undefined;
    if (targetLanguage) {
      translatedText = `[Translation to ${targetLanguage}]`;
    }
    
    return {
      detectedLanguage,
      translatedText,
      confidence
    };
  },
});