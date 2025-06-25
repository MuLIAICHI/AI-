// src/mastra/tools/user-profile-tool.ts
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { UserProfile } from "../types/common-types";

const userProfiles: Record<string, UserProfile> = {};

export const userProfileTool = createTool({
  id: "user-profile-tool",
  description: "Manages user profile information",
  inputSchema: z.object({
    action: z.enum(["get", "update"]),
    userId: z.string(),
    profileData: z.object({
      name: z.string().optional(),
      preferredLanguage: z.string().optional(),
      deviceType: z.string().optional(),
      selectedSubject: z.enum(["digital", "finance", "health"]).optional(),
      skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    }).optional(),
  }),
  outputSchema: z.object({
    profile: z.object({
      name: z.string().optional(),
      preferredLanguage: z.string(),
      deviceType: z.string().optional(),
      selectedSubject: z.enum(["digital", "finance", "health"]).optional(),
      skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    }),
    success: z.boolean(),
    message: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { action, userId, profileData } = context;
    
    if (!userProfiles[userId]) {
      userProfiles[userId] = {
        preferredLanguage: "en",
      };
    }
    
    if (action === "update" && profileData) {
      userProfiles[userId] = {
        ...userProfiles[userId],
        ...Object.fromEntries(
          Object.entries(profileData).filter(([_, v]) => v !== undefined)
        ),
      };
    }
    
    return {
      profile: userProfiles[userId],
      success: true,
      message: action === "update" ? "Profile updated successfully" : undefined
    };
  },
});