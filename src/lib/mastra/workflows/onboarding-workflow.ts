// src/mastra/workflows/onboarding-workflow.ts
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { languageTool, userProfileTool } from '../tools';

// Create steps directly from tools
const detectLanguageStep = createStep(languageTool);
const updateProfileStep = createStep(userProfileTool);

// Create our workflow
export const onboardingWorkflow = createWorkflow({
  id: 'user-onboarding-process',
  description: 'Guides new users through language detection and profile creation',
  inputSchema: z.object({
    userId: z.string().describe("Unique identifier for the user"),
    initialMessage: z.string().describe("User's first message to the system"),
  }),
  outputSchema: z.object({
    userId: z.string(),
    language: z.string(),
    guidanceMessage: z.string(),
  }),
  steps: [detectLanguageStep, updateProfileStep], // Register steps in the workflow
});

// Define the workflow execution sequence
onboardingWorkflow
  // First step: Prepare language detection input
  .then(createStep({
    id: "prepare-language-detection",
    inputSchema: z.object({
      userId: z.string(),
      initialMessage: z.string(),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
    execute: async ({ inputData }) => {
      // This step prepares the input for the language detection tool
      return {
        text: inputData.initialMessage,
      };
    },
  }))
  
  // Second step: Use language detection tool (as a step)
  .then(detectLanguageStep)
  
  // Third step: Prepare profile update
// Third step: Prepare profile update
.then(createStep({
    id: "prepare-profile-update",
    inputSchema: z.object({
        detectedLanguage: z.enum(["en", "es", "fr", "de", "it", "zh", "ar", "hi"]),
        translatedText: z.string().optional(),
        confidence: z.number()
    }),
    outputSchema: z.object({
        action: z.enum(["get", "update"]),
        userId: z.string(),
        profileData: z.object({
        name: z.string().optional(),
        preferredLanguage: z.string().optional(),
        deviceType: z.string().optional(),
        selectedSubject: z.enum(["digital", "finance", "health"]).optional(),
        skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        }).optional()
    }),
    execute: async ({ inputData, getInitData }) => {
        const initialData = await getInitData();
        
        // Return with explicit typing to match output schema
        return {
        action: "update" as const, // Use 'as const' to narrow the type
        userId: initialData.userId,
        profileData: {
            preferredLanguage: inputData.detectedLanguage
        }
        };
    }
    }))
  
  // Fourth step: Use profile update tool (as a step)
  .then(updateProfileStep)
  
  // Fifth step: Generate guidance message
  .then(createStep({
    id: "generate-guidance-message",
    inputSchema: z.object({
      profile: z.object({
        preferredLanguage: z.string(),
        name: z.string().optional(),
        selectedSubject: z.enum(["digital", "finance", "health"]).optional(),
        skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        deviceType: z.string().optional(),
      }),
      success: z.boolean(),
      message: z.string().optional(),
    }),
    outputSchema: z.object({
      userId: z.string(),
      language: z.string(),
      guidanceMessage: z.string(),
    }),
    execute: async ({ inputData, getInitData }) => {
      const initialData = await getInitData();
      const language = inputData.profile.preferredLanguage;
      
      // Generate a language-appropriate guidance message
      let guidanceMessage = "Welcome to Smartlyte! Please select a learning area: Digital Skills, Financial Skills, or Health Resources.";
      
      if (language === "es") {
        guidanceMessage = "¡Bienvenido a Smartlyte! Por favor, seleccione un área de aprendizaje: Habilidades Digitales, Habilidades Financieras o Recursos de Salud.";
      } else if (language === "fr") {
        guidanceMessage = "Bienvenue sur Smartlyte ! Veuillez sélectionner un domaine d'apprentissage : Compétences Numériques, Compétences Financières ou Ressources de Santé.";
      }
      
      return {
        userId: initialData.userId,
        language,
        guidanceMessage,
      };
    },
  }))
  .commit();

export default onboardingWorkflow;