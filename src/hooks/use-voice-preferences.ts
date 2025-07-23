// src/hooks/use-voice-preferences.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import VoicePreferencesService, {
  type VoicePreferences,
  type UserVoiceContext,
  type UserVoiceAnalytics,
  type VoicePresetWithMeta,
} from '@/services/voice-preferences-service';
import {
  VoiceProvider,
  VoiceQuality,
  VoiceLatencyMode,
  OpenAIVoiceId,
} from '@/lib/voice/voice-types';

// ==========================================
// TYPES & INTERFACES
// ==========================================

/**
 * Voice preferences update interface
 */
export interface VoicePreferencesUpdate {
  voiceEnabled?: boolean;
  voiceLanguage?: string;
  voiceSpeed?: number;
  voiceProvider?: VoiceProvider;
  preferredVoice?: string;
  voiceAutoplay?: boolean;
  voiceInputEnabled?: boolean;
  voiceOutputEnabled?: boolean;
  voiceInterruptionsEnabled?: boolean;
  voiceVisualizationEnabled?: boolean;
  voiceQuality?: VoiceQuality;
  voiceLatencyMode?: VoiceLatencyMode;
}

/**
 * Voice session creation options
 */
export interface CreateSessionOptions {
  conversationId: string;
  sessionType: 'tts_only' | 'stt_only' | 'realtime' | 'mixed';
  voiceProvider?: string;
  voiceLanguage?: string;
  voiceId?: string;
}

/**
 * Voice preset creation options
 */
export interface CreatePresetOptions {
  name: string;
  voiceProvider: string;
  voiceId: string;
  voiceSpeed?: number;
  voiceQuality?: VoiceQuality;
  description?: string;
}

/**
 * Hook return interface following your existing patterns
 */
interface UseVoicePreferencesReturn {
  // State
  voiceContext: UserVoiceContext | null;
  preferences: VoicePreferences | null;
  analytics: UserVoiceAnalytics | null;
  presets: VoicePresetWithMeta[];
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  
  // Actions - Preferences Management
  updatePreferences: (updates: VoicePreferencesUpdate) => Promise<void>;
  resetPreferences: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
  
  // Actions - Session Management
  createVoiceSession: (options: CreateSessionOptions) => Promise<string | null>;
  endVoiceSession: (sessionId: string) => Promise<boolean>;
  
  // Actions - Presets Management
  savePreset: (options: CreatePresetOptions) => Promise<string | null>;
  loadPresets: () => Promise<void>;
  
  // Actions - Analytics
  refreshAnalytics: () => Promise<void>;
  
  // Utilities
  clearError: () => void;
  validatePreferences: (updates: Partial<VoicePreferences>) => { isValid: boolean; errors: string[] };
  
  // Computed values
  isVoiceEnabled: boolean;
  hasCustomSettings: boolean;
  currentVoiceProvider: VoiceProvider;
  currentVoiceId: string;
  currentSpeed: number;
  voiceUsageStats: {
    totalSessions: number;
    totalDuration: number;
    averageSessionLength: number;
  };
}

/**
 * Custom hook for managing voice preferences and sessions
 * Follows the same patterns as usePreferences, useProfile, useChat
 */
export function useVoicePreferences(): UseVoicePreferencesReturn {
  const { user, isLoaded } = useUser();
  
  // State - following your existing pattern
  const [voiceContext, setVoiceContext] = useState<UserVoiceContext | null>(null);
  const [analytics, setAnalytics] = useState<UserVoiceAnalytics | null>(null);
  const [presets, setPresets] = useState<VoicePresetWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clear any existing errors - following your pattern
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Fetch user voice preferences from service
   */
  const fetchVoicePreferences = useCallback(async () => {
    if (!user || !isLoaded) {
      console.log('🔄 User not ready, skipping voice preferences fetch');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Fetching voice preferences for user:', user.id);
      
      const context = await VoicePreferencesService.getUserVoicePreferences(user.id);
      
      if (context) {
        setVoiceContext(context);
        console.log('✅ Voice preferences loaded:', context.preferences);
      } else {
        console.warn('⚠️ No voice preferences found, will initialize on first update');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch voice preferences';
      console.error('❌ Error fetching voice preferences:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoaded]);

  /**
   * Update voice preferences
   */
  const updatePreferences = useCallback(async (updates: VoicePreferencesUpdate) => {
    if (!user || !isLoaded) {
      throw new Error('User not authenticated');
    }

    // Validate preferences before updating
    const validation = VoicePreferencesService.validateVoicePreferences(updates);
    if (!validation.isValid) {
      setError(`Invalid preferences: ${validation.errors.join(', ')}`);
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);
      
      console.log('🔄 Updating voice preferences:', updates);
      
      const success = await VoicePreferencesService.updateVoicePreferences(user.id, updates);
      
      if (success) {
        // Refresh preferences to get updated data
        await fetchVoicePreferences();
        console.log('✅ Voice preferences updated successfully');
      } else {
        throw new Error('Failed to update voice preferences');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update preferences';
      console.error('❌ Error updating voice preferences:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  }, [user, isLoaded, fetchVoicePreferences]);

  /**
   * Reset preferences to defaults
   */
  const resetPreferences = useCallback(async () => {
    if (!user || !isLoaded) {
      throw new Error('User not authenticated');
    }

    try {
      setIsUpdating(true);
      setError(null);
      
      console.log('🔄 Resetting voice preferences to defaults');
      
      const success = await VoicePreferencesService.resetVoicePreferences(user.id);
      
      if (success) {
        // Refresh preferences to get updated data
        await fetchVoicePreferences();
        console.log('✅ Voice preferences reset successfully');
      } else {
        throw new Error('Failed to reset voice preferences');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset preferences';
      console.error('❌ Error resetting voice preferences:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  }, [user, isLoaded, fetchVoicePreferences]);

  /**
   * Refresh preferences manually
   */
  const refreshPreferences = useCallback(async () => {
    await fetchVoicePreferences();
  }, [fetchVoicePreferences]);

  /**
   * Create a new voice session
   */
  const createVoiceSession = useCallback(async (options: CreateSessionOptions): Promise<string | null> => {
    if (!user || !isLoaded) {
      throw new Error('User not authenticated');
    }

    try {
      setError(null);
      
      console.log('🔄 Creating voice session:', options);
      
      const sessionId = await VoicePreferencesService.createVoiceSession({
        userId: user.id,
        conversationId: options.conversationId,
        sessionType: options.sessionType,
        voiceProvider: options.voiceProvider || voiceContext?.preferences.voiceProvider || 'openai',
        voiceLanguage: options.voiceLanguage || voiceContext?.preferences.voiceLanguage || 'en',
        voiceId: options.voiceId || voiceContext?.preferences.preferredVoice || 'alloy',
      });
      
      if (sessionId) {
        console.log('✅ Voice session created:', sessionId);
        // Optionally refresh analytics to include new session
        refreshAnalytics();
      }
      
      return sessionId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create voice session';
      console.error('❌ Error creating voice session:', errorMessage);
      setError(errorMessage);
      return null;
    }
  }, [user, isLoaded, voiceContext]);

  /**
   * End a voice session
   */
  const endVoiceSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      setError(null);
      
      console.log('🔄 Ending voice session:', sessionId);
      
      const success = await VoicePreferencesService.endVoiceSession(sessionId);
      
      if (success) {
        console.log('✅ Voice session ended:', sessionId);
        // Optionally refresh analytics
        refreshAnalytics();
      }
      
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to end voice session';
      console.error('❌ Error ending voice session:', errorMessage);
      setError(errorMessage);
      return false;
    }
  }, []);

  /**
   * Save a custom voice preset
   */
  const savePreset = useCallback(async (options: CreatePresetOptions): Promise<string | null> => {
    if (!user || !isLoaded) {
      throw new Error('User not authenticated');
    }

    try {
      setError(null);
      
      console.log('🔄 Saving voice preset:', options);
      
      const presetId = await VoicePreferencesService.saveVoicePreset(
        user.id,
        options.name,
        options.voiceProvider,
        options.voiceId,
        options.voiceSpeed || 1.0,
        options.voiceQuality || 'standard',
        options.description
      );
      
      if (presetId) {
        console.log('✅ Voice preset saved:', presetId);
        // Refresh presets list
        await loadPresets();
      }
      
      return presetId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save voice preset';
      console.error('❌ Error saving voice preset:', errorMessage);
      setError(errorMessage);
      return null;
    }
  }, [user, isLoaded]);

  /**
   * Load user's voice presets
   */
  const loadPresets = useCallback(async () => {
    if (!user || !isLoaded) {
      console.log('🔄 User not ready, skipping presets load');
      return;
    }

    try {
      setError(null);
      
      console.log('🔄 Loading voice presets for user:', user.id);
      
      const userPresets = await VoicePreferencesService.getUserVoicePresets(user.id);
      
      setPresets(userPresets);
      console.log('✅ Voice presets loaded:', userPresets.length);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load voice presets';
      console.error('❌ Error loading voice presets:', errorMessage);
      setError(errorMessage);
    }
  }, [user, isLoaded]);

  /**
   * Refresh voice analytics
   */
  const refreshAnalytics = useCallback(async () => {
    if (!user || !isLoaded) {
      console.log('🔄 User not ready, skipping analytics refresh');
      return;
    }

    try {
      setError(null);
      
      console.log('🔄 Refreshing voice analytics for user:', user.id);
      
      const userAnalytics = await VoicePreferencesService.getUserVoiceAnalytics(user.id);
      
      setAnalytics(userAnalytics);
      console.log('✅ Voice analytics refreshed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh analytics';
      console.error('❌ Error refreshing voice analytics:', errorMessage);
      setError(errorMessage);
    }
  }, [user, isLoaded]);

  /**
   * Validate preferences helper
   */
  const validatePreferences = useCallback((updates: Partial<VoicePreferences>) => {
    return VoicePreferencesService.validateVoicePreferences(updates);
  }, []);

  // Initialize on mount - following your pattern
  useEffect(() => {
    if (user && isLoaded && !voiceContext) {
      console.log('🚀 Initializing voice preferences hook');
      fetchVoicePreferences();
      loadPresets();
      refreshAnalytics();
    }
  }, [user, isLoaded, voiceContext, fetchVoicePreferences, loadPresets, refreshAnalytics]);

  // Computed values - following your pattern
  const preferences = voiceContext?.preferences || null;
  const isVoiceEnabled = preferences?.voiceEnabled || false;
  const hasCustomSettings = voiceContext?.hasCustomSettings || false;
  const currentVoiceProvider = preferences?.voiceProvider || 'openai';
  const currentVoiceId = preferences?.preferredVoice || 'alloy';
  const currentSpeed = preferences?.voiceSpeed || 1.0;
  
  const voiceUsageStats = {
    totalSessions: analytics?.totalSessions || 0,
    totalDuration: analytics?.totalDuration || 0,
    averageSessionLength: analytics?.averageSessionDuration || 0,
  };

  // Return comprehensive hook interface - following your pattern
  return {
    // State
    voiceContext,
    preferences,
    analytics,
    presets,
    isLoading,
    isUpdating,
    error,
    
    // Actions - Preferences Management
    updatePreferences,
    resetPreferences,
    refreshPreferences,
    
    // Actions - Session Management
    createVoiceSession,
    endVoiceSession,
    
    // Actions - Presets Management
    savePreset,
    loadPresets,
    
    // Actions - Analytics
    refreshAnalytics,
    
    // Utilities
    clearError,
    validatePreferences,
    
    // Computed values
    isVoiceEnabled,
    hasCustomSettings,
    currentVoiceProvider,
    currentVoiceId,
    currentSpeed,
    voiceUsageStats,
  };
}

// Export types for use in components - following your pattern
export type {
  UseVoicePreferencesReturn,
};