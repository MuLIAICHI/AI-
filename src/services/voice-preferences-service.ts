// src/services/voice-preferences-service.ts
// Voice preferences data access layer - FINAL VERSION - Schema-Aligned

import { db } from '@/lib/db';
import { 
  users,
  userPreferences,
  voiceSessions,
  voicePresets,
  type User,
  type UserPreferences,
  type NewUserPreferences,
  type VoiceSession,
  type NewVoiceSession,
  type VoicePreset,
  type NewVoicePreset,
} from '@/lib/db/schema';
import { eq, desc, and, sum, avg, count, gte } from 'drizzle-orm';
import { randomUUID } from 'crypto';
// Import from voice-types.ts (with proper exports)
import {
  VoiceProvider,
  VoiceQuality,
  VoiceLatencyMode,
  VoiceSessionType,
  OpenAIVoiceId,
  DEFAULT_VOICE_CONFIG,
} from '@/lib/voice/voice-types';

// Import from voice-config.ts (with proper exports)
import {
  createDefaultVoiceConfig,
  voicePreferencesToConfig,
  voiceConfigToPreferences,
} from '@/lib/voice/voice-config';

// ==========================================
// INTERFACES & TYPES (Updated to match actual schema)
// ==========================================

/**
 * Voice preferences interface (matches database userPreferences fields)
 */
export interface VoicePreferences {
  voiceEnabled: boolean;
  voiceLanguage: string;
  voiceSpeed: number;
  voiceProvider: VoiceProvider;
  preferredVoice: string;
  voiceAutoplay: boolean;
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;
  voiceInterruptionsEnabled: boolean;
  voiceVisualizationEnabled: boolean;
  voiceQuality: VoiceQuality;
  voiceLatencyMode: VoiceLatencyMode;
}

/**
 * Voice session statistics (matches actual database fields)
 */
export interface VoiceSessionStats {
  totalDuration: number;
  messagesCount: number;
  userSpeechDuration: number;
  agentSpeechDuration: number;
  interruptionsCount: number;
  averageLatency: number;
  errorCount: number;
  successRate: number;
}

/**
 * Voice preferences with user context
 */
export interface UserVoiceContext {
  userId: string;
  preferences: VoicePreferences;
  hasCustomSettings: boolean;
  lastUsed?: Date;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Voice usage analytics for a user
 */
export interface UserVoiceAnalytics {
  userId: string;
  totalSessions: number;
  totalDuration: number;
  messagesSpoken: number;
  averageSessionDuration: number;
  preferredVoice: string;
  mostUsedProvider: VoiceProvider;
  lastActivity?: Date;
  weeklyUsage: number[];
  monthlyUsage: number[];
}

/**
 * Voice preset with metadata (matches actual database schema)
 */
export interface VoicePresetWithMeta {
  id: string;
  name: string;
  description?: string;
  voiceProvider: string;
  voiceId: string;
  voiceSpeed: number;
  voiceQuality: VoiceQuality;
  autoplay: boolean;
  interruptionsEnabled: boolean;
  latencyMode: VoiceLatencyMode;
  isSystemPreset: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Voice session creation options
 */
export interface CreateVoiceSessionOptions {
  userId: string;
  conversationId: string;
  sessionType: VoiceSessionType;
  voiceProvider: string;
  voiceLanguage: string;
  voiceId?: string;
}

// ==========================================
// VOICE PREFERENCES SERVICE
// ==========================================

/**
 * Voice Preferences Service - Fixed to match actual database schema
 */
export class VoicePreferencesService {

  // ==========================================
  // USER VOICE PREFERENCES MANAGEMENT
  // ==========================================

  /**
   * Get user's voice preferences with full context
   */
  static async getUserVoicePreferences(clerkId: string): Promise<UserVoiceContext | null> {
    try {
      // Get user with preferences
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        with: {
          preferences: true,
        }
      });

      if (!user) {
        console.warn(`User not found for clerkId: ${clerkId}`);
        return null;
      }

      // If no preferences exist, create defaults
      let preferences = user.preferences;
      if (!preferences) {
        preferences = await this.initializeDefaultVoicePreferences(clerkId);
      }

      // Convert database preferences to VoicePreferences interface
      const voicePreferences: VoicePreferences = {
        voiceEnabled: preferences.voiceEnabled ?? false,
        voiceLanguage: preferences.voiceLanguage ?? 'en',
        voiceSpeed: preferences.voiceSpeed ?? 1.0,
        voiceProvider: (preferences.voiceProvider as VoiceProvider) ?? 'openai',
        preferredVoice: preferences.preferredVoice ?? 'alloy',
        voiceAutoplay: preferences.voiceAutoplay ?? true,
        voiceInputEnabled: preferences.voiceInputEnabled ?? false,
        voiceOutputEnabled: preferences.voiceOutputEnabled ?? true,
        voiceInterruptionsEnabled: preferences.voiceInterruptionsEnabled ?? true,
        voiceVisualizationEnabled: preferences.voiceVisualizationEnabled ?? true,
        voiceQuality: (preferences.voiceQuality as VoiceQuality) ?? 'standard',
        voiceLatencyMode: (preferences.voiceLatencyMode as VoiceLatencyMode) ?? 'balanced',
      };

      // Get usage statistics
      const usageStats = await this.getUserVoiceUsageCount(clerkId);

      return {
        userId: clerkId,
        preferences: voicePreferences,
        hasCustomSettings: this.hasCustomVoiceSettings(voicePreferences),
        lastUsed: preferences.updatedAt || undefined,
        usageCount: usageStats.totalSessions,
        createdAt: preferences.createdAt || user.createdAt,
        updatedAt: preferences.updatedAt || user.createdAt,
      };

    } catch (error) {
      console.error('Error getting user voice preferences:', error);
      return null;
    }
  }

  /**
   * Initialize default voice preferences for new user
   */
  static async initializeDefaultVoicePreferences(clerkId: string): Promise<UserPreferences> {
    try {
      // Check if user exists
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId)
      });

      if (!user) {
        throw new Error(`Cannot initialize voice preferences: user ${clerkId} not found`);
      }

      // Create default voice configuration
      const defaultPreferences: NewUserPreferences = {
        userId: clerkId,
        language: 'en',
        theme: 'dark', // ✅ FIXED: Use valid theme value
        // Voice preferences with defaults
        voiceEnabled: true,
        voiceLanguage: 'en',
        voiceSpeed: 1.0,
        voiceProvider: 'openai',
        preferredVoice: 'alloy',
        voiceAutoplay: true,
        voiceInputEnabled: true,
        voiceOutputEnabled: true,
        voiceInterruptionsEnabled: true,
        voiceVisualizationEnabled: true,
        voiceQuality: 'standard',
        voiceLatencyMode: 'balanced',
      };

      // Insert or update user preferences
      const [preferences] = await db
        .insert(userPreferences)
        .values(defaultPreferences)
        .onConflictDoUpdate({
          target: userPreferences.userId,
          set: {
            // Only update voice fields, keep existing non-voice preferences
            voiceEnabled: defaultPreferences.voiceEnabled,
            voiceLanguage: defaultPreferences.voiceLanguage,
            voiceSpeed: defaultPreferences.voiceSpeed,
            voiceProvider: defaultPreferences.voiceProvider,
            preferredVoice: defaultPreferences.preferredVoice,
            voiceAutoplay: defaultPreferences.voiceAutoplay,
            voiceInputEnabled: defaultPreferences.voiceInputEnabled,
            voiceOutputEnabled: defaultPreferences.voiceOutputEnabled,
            voiceInterruptionsEnabled: defaultPreferences.voiceInterruptionsEnabled,
            voiceVisualizationEnabled: defaultPreferences.voiceVisualizationEnabled,
            voiceQuality: defaultPreferences.voiceQuality,
            voiceLatencyMode: defaultPreferences.voiceLatencyMode,
            updatedAt: new Date(),
          }
        })
        .returning();

      console.log(`✅ Initialized voice preferences for user: ${clerkId}`);
      return preferences;

    } catch (error) {
      console.error('Error initializing default voice preferences:', error);
      throw error;
    }
  }

  /**
   * Update user's voice preferences
   */
  static async updateVoicePreferences(
    clerkId: string, 
    updates: Partial<VoicePreferences>
  ): Promise<boolean> {
    try {
      // Validate user exists
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId)
      });

      if (!user) {
        console.error(`Cannot update voice preferences: user ${clerkId} not found`);
        return false;
      }

      // Convert VoicePreferences updates to database format
      const dbUpdates: Partial<UserPreferences> = {};
      
      if (updates.voiceEnabled !== undefined) dbUpdates.voiceEnabled = updates.voiceEnabled;
      if (updates.voiceLanguage !== undefined) dbUpdates.voiceLanguage = updates.voiceLanguage;
      if (updates.voiceSpeed !== undefined) dbUpdates.voiceSpeed = updates.voiceSpeed;
      if (updates.voiceProvider !== undefined) dbUpdates.voiceProvider = updates.voiceProvider;
      if (updates.preferredVoice !== undefined) dbUpdates.preferredVoice = updates.preferredVoice;
      if (updates.voiceAutoplay !== undefined) dbUpdates.voiceAutoplay = updates.voiceAutoplay;
      if (updates.voiceInputEnabled !== undefined) dbUpdates.voiceInputEnabled = updates.voiceInputEnabled;
      if (updates.voiceOutputEnabled !== undefined) dbUpdates.voiceOutputEnabled = updates.voiceOutputEnabled;
      if (updates.voiceInterruptionsEnabled !== undefined) dbUpdates.voiceInterruptionsEnabled = updates.voiceInterruptionsEnabled;
      if (updates.voiceVisualizationEnabled !== undefined) dbUpdates.voiceVisualizationEnabled = updates.voiceVisualizationEnabled;
      if (updates.voiceQuality !== undefined) dbUpdates.voiceQuality = updates.voiceQuality;
      if (updates.voiceLatencyMode !== undefined) dbUpdates.voiceLatencyMode = updates.voiceLatencyMode;

      // Add timestamp
      dbUpdates.updatedAt = new Date();

      // Update in database
      await db
        .update(userPreferences)
        .set(dbUpdates)
        .where(eq(userPreferences.userId, clerkId));

      console.log(`✅ Updated voice preferences for user: ${clerkId}`, Object.keys(dbUpdates));
      return true;

    } catch (error) {
      console.error('Error updating voice preferences:', error);
      return false;
    }
  }

  /**
   * Reset user's voice preferences to defaults
   */
  static async resetVoicePreferences(clerkId: string): Promise<boolean> {
    try {
      const defaultPreferences: VoicePreferences = {
        voiceEnabled: true,
        voiceLanguage: 'en',
        voiceSpeed: 1.0,
        voiceProvider: 'openai',
        preferredVoice: 'alloy',
        voiceAutoplay: true,
        voiceInputEnabled: true,
        voiceOutputEnabled: true,
        voiceInterruptionsEnabled: true,
        voiceVisualizationEnabled: true,
        voiceQuality: 'standard',
        voiceLatencyMode: 'balanced',
      };
      
      return await this.updateVoicePreferences(clerkId, defaultPreferences);
    } catch (error) {
      console.error('Error resetting voice preferences:', error);
      return false;
    }
  }

  // ==========================================
  // VOICE SESSIONS MANAGEMENT (Fixed to match actual schema)
  // ==========================================

static async createVoiceSession(options: CreateVoiceSessionOptions): Promise<string | null> {
  try {
    // 🚀 FIX: Generate proper UUID if conversationId is invalid
    let conversationId = options.conversationId;
    
    if (!conversationId || conversationId === 'default' || conversationId.length < 10) {
      conversationId = randomUUID();
      console.log('🔧 Generated new conversation UUID:', conversationId);
    }

    const sessionData: NewVoiceSession = {
      userId: options.userId,
      conversationId: conversationId, // Now always a valid UUID
      sessionType: options.sessionType,
      voiceProvider: options.voiceProvider,
      voiceLanguage: options.voiceLanguage,
      voiceId: options.voiceId || null,
      startedAt: new Date(),
      totalDuration: 0,
      messagesCount: 0,
      userSpeechDuration: 0,
      agentSpeechDuration: 0,
      interruptionsCount: 0,
      averageLatency: null,
      errorCount: 0,
      successRate: null,
      sessionData: null,
    };

    const [session] = await db
      .insert(voiceSessions)
      .values(sessionData)
      .returning({ id: voiceSessions.id });

    console.log(`✅ Created voice session: ${session.id} for user: ${options.userId}`);
    return session.id;

  } catch (error) {
    console.error('Error creating voice session:', error);
    return null;
  }
}
  /**
   * Update voice session statistics
   */
  static async updateVoiceSessionStats(
    sessionId: string,
    updates: Partial<VoiceSessionStats>
  ): Promise<boolean> {
    try {
      // Get current session
      const session = await db.query.voiceSessions.findFirst({
        where: eq(voiceSessions.id, sessionId)
      });

      if (!session) {
        console.warn(`Voice session not found: ${sessionId}`);
        return false;
      }

      // ✅ FIXED: Update individual fields instead of stats object
      const dbUpdates: Partial<VoiceSession> = {};
      
      if (updates.totalDuration !== undefined) dbUpdates.totalDuration = updates.totalDuration;
      if (updates.messagesCount !== undefined) dbUpdates.messagesCount = updates.messagesCount;
      if (updates.userSpeechDuration !== undefined) dbUpdates.userSpeechDuration = updates.userSpeechDuration;
      if (updates.agentSpeechDuration !== undefined) dbUpdates.agentSpeechDuration = updates.agentSpeechDuration;
      if (updates.interruptionsCount !== undefined) dbUpdates.interruptionsCount = updates.interruptionsCount;
      if (updates.averageLatency !== undefined) dbUpdates.averageLatency = updates.averageLatency;
      if (updates.errorCount !== undefined) dbUpdates.errorCount = updates.errorCount;
      if (updates.successRate !== undefined) dbUpdates.successRate = updates.successRate;

      dbUpdates.updatedAt = new Date();

      // Update session
      await db
        .update(voiceSessions)
        .set(dbUpdates)
        .where(eq(voiceSessions.id, sessionId));

      return true;

    } catch (error) {
      console.error('Error updating voice session stats:', error);
      return false;
    }
  }

  /**
   * End voice session
   */
  static async endVoiceSession(sessionId: string): Promise<boolean> {
    try {
      await db
        .update(voiceSessions)
        .set({
          endedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(voiceSessions.id, sessionId));

      console.log(`✅ Ended voice session: ${sessionId}`);
      return true;

    } catch (error) {
      console.error('Error ending voice session:', error);
      return false;
    }
  }

  // ==========================================
  // VOICE ANALYTICS & USAGE STATS
  // ==========================================

  /**
   * Get user's voice usage statistics
   */
  static async getUserVoiceUsageCount(clerkId: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
  }> {
    try {
      const sessions = await db.query.voiceSessions.findMany({
        where: eq(voiceSessions.userId, clerkId),
        columns: {
          endedAt: true,
        }
      });

      const totalSessions = sessions.length;
      const activeSessions = sessions.filter(s => !s.endedAt).length;
      const completedSessions = sessions.filter(s => s.endedAt).length;

      return {
        totalSessions,
        activeSessions,
        completedSessions,
      };

    } catch (error) {
      console.error('Error getting voice usage count:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        completedSessions: 0,
      };
    }
  }

  /**
   * Get comprehensive voice analytics for user
   */
  static async getUserVoiceAnalytics(clerkId: string): Promise<UserVoiceAnalytics | null> {
    try {
      // Get all sessions for user
      const sessions = await db.query.voiceSessions.findMany({
        where: eq(voiceSessions.userId, clerkId),
        orderBy: desc(voiceSessions.createdAt)
      });

      if (sessions.length === 0) {
        return {
          userId: clerkId,
          totalSessions: 0,
          totalDuration: 0,
          messagesSpoken: 0,
          averageSessionDuration: 0,
          preferredVoice: 'alloy',
          mostUsedProvider: 'openai',
          weeklyUsage: Array(7).fill(0),
          monthlyUsage: Array(12).fill(0),
        };
      }

      // Calculate statistics using individual fields
      const totalSessions = sessions.length;
      const totalDuration = sessions.reduce((sum, session) => {
        return sum + (session.totalDuration || 0);
      }, 0);

      const messagesSpoken = sessions.reduce((sum, session) => {
        return sum + (session.messagesCount || 0);
      }, 0);

      const averageSessionDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

      // Find most used voice and provider
      const voiceUsage = sessions.reduce((acc, session) => {
        if (session.voiceId) {
          acc[session.voiceId] = (acc[session.voiceId] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const providerUsage = sessions.reduce((acc, session) => {
        acc[session.voiceProvider] = (acc[session.voiceProvider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const preferredVoice = Object.keys(voiceUsage).reduce((a, b) => 
        voiceUsage[a] > voiceUsage[b] ? a : b, 'alloy'
      );

      const mostUsedProvider = Object.keys(providerUsage).reduce((a, b) => 
        providerUsage[a] > providerUsage[b] ? a : b, 'openai'
      ) as VoiceProvider;

      const lastActivity = sessions[0]?.updatedAt || sessions[0]?.createdAt;

      // Calculate weekly usage (last 7 days)
      const now = new Date();
      const weeklyUsage = Array(7).fill(0);
      sessions.forEach(session => {
        const sessionDate = session.createdAt;
        const daysDiff = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 0 && daysDiff < 7) {
          weeklyUsage[6 - daysDiff]++;
        }
      });

      // Calculate monthly usage (last 12 months)
      const monthlyUsage = Array(12).fill(0);
      sessions.forEach(session => {
        const sessionDate = session.createdAt;
        const monthsDiff = (now.getFullYear() - sessionDate.getFullYear()) * 12 + 
                          (now.getMonth() - sessionDate.getMonth());
        if (monthsDiff >= 0 && monthsDiff < 12) {
          monthlyUsage[11 - monthsDiff]++;
        }
      });

      return {
        userId: clerkId,
        totalSessions,
        totalDuration,
        messagesSpoken,
        averageSessionDuration,
        preferredVoice,
        mostUsedProvider,
        lastActivity,
        weeklyUsage,
        monthlyUsage,
      };

    } catch (error) {
      console.error('Error getting user voice analytics:', error);
      return null;
    }
  }

  // ==========================================
  // VOICE PRESETS MANAGEMENT (Fixed to match actual schema)
  // ==========================================

  /**
   * Save custom voice preset for user
   */
  static async saveVoicePreset(
    userId: string,
    name: string,
    voiceProvider: string,
    voiceId: string,
    voiceSpeed: number = 1.0,
    voiceQuality: VoiceQuality = 'standard',
    description?: string
  ): Promise<string | null> {
    try {
      // ✅ FIXED: Use actual database field structure
      const presetData: NewVoicePreset = {
        name,
        description: description || null,
        isSystemPreset: false,
        isPublic: false,
        createdBy: userId,
        voiceProvider,
        voiceId,
        voiceSpeed,
        voiceQuality,
        autoplay: true,
        interruptionsEnabled: true,
        latencyMode: 'balanced',
        agentOverrides: null,
        usageCount: 0,
        lastUsed: null,
      };

      const [preset] = await db
        .insert(voicePresets)
        .values(presetData)
        .returning({ id: voicePresets.id });

      console.log(`✅ Created voice preset: ${preset.id} for user: ${userId}`);
      return preset.id;

    } catch (error) {
      console.error('Error saving voice preset:', error);
      return null;
    }
  }

  /**
   * Get user's voice presets
   */
  static async getUserVoicePresets(userId: string): Promise<VoicePresetWithMeta[]> {
    try {
      const presets = await db.query.voicePresets.findMany({
        where: eq(voicePresets.createdBy, userId),
        orderBy: desc(voicePresets.updatedAt)
      });

      // ✅ FIXED: Map to actual database fields
      return presets.map(preset => ({
        id: preset.id,
        name: preset.name,
        description: preset.description || undefined,
        voiceProvider: preset.voiceProvider,
        voiceId: preset.voiceId,
        voiceSpeed: preset.voiceSpeed || 1.0,
        voiceQuality: preset.voiceQuality as VoiceQuality,
        autoplay: preset.autoplay || true,
        interruptionsEnabled: preset.interruptionsEnabled || true,
        latencyMode: preset.latencyMode as VoiceLatencyMode,
        isSystemPreset: preset.isSystemPreset || false,
        usageCount: preset.usageCount || 0,
        createdAt: preset.createdAt,
        updatedAt: preset.updatedAt,
      }));

    } catch (error) {
      console.error('Error getting user voice presets:', error);
      return [];
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Check if user has custom voice settings (different from defaults)
   */
  private static hasCustomVoiceSettings(preferences: VoicePreferences): boolean {
    return (
      preferences.voiceEnabled !== true ||
      preferences.voiceSpeed !== 1.0 ||
      preferences.voiceProvider !== 'openai' ||
      preferences.preferredVoice !== 'alloy' ||
      preferences.voiceAutoplay !== true ||
      preferences.voiceQuality !== 'standard' ||
      preferences.voiceLatencyMode !== 'balanced'
    );
  }

  /**
   * Validate voice preferences before saving
   */
  static validateVoicePreferences(preferences: Partial<VoicePreferences>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate speed range
    if (preferences.voiceSpeed !== undefined) {
      if (preferences.voiceSpeed < 0.25 || preferences.voiceSpeed > 4.0) {
        errors.push('Voice speed must be between 0.25 and 4.0');
      }
    }

    // Validate provider
    if (preferences.voiceProvider !== undefined) {
      const validProviders = ['openai', 'elevenlabs', 'playai', 'google', 'azure'];
      if (!validProviders.includes(preferences.voiceProvider)) {
        errors.push(`Invalid voice provider: ${preferences.voiceProvider}`);
      }
    }

    // Validate language code
    if (preferences.voiceLanguage !== undefined) {
      if (preferences.voiceLanguage.length < 2) {
        errors.push('Voice language must be a valid language code (e.g., "en", "es")');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// ==========================================
// EXPORT DEFAULT SERVICE
// ==========================================

export default VoicePreferencesService;

// Export commonly used methods as named exports for convenience
export const {
  getUserVoicePreferences,
  updateVoicePreferences,
  initializeDefaultVoicePreferences,
  resetVoicePreferences,
  createVoiceSession,
  updateVoiceSessionStats,
  endVoiceSession,
  getUserVoiceAnalytics,
  saveVoicePreset,
  getUserVoicePresets,
  validateVoicePreferences,
} = VoicePreferencesService;