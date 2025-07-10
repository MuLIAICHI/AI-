// src/hooks/use-preferences.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

// Types matching our database schema and API
export interface UserPreferences {
  id: string;
  userId: string;
  // Learning preferences
  learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  difficultyPreference?: 'easy' | 'moderate' | 'challenging';
  // Notification preferences
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyProgress: boolean;
  sessionReminders: boolean;
  // UI preferences
  theme: 'dark' | 'light' | 'auto';
  language: string;
  // Session preferences
  dailyGoalMinutes: number;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface PreferencesUpdate {
  learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  difficultyPreference?: 'easy' | 'moderate' | 'challenging';
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  weeklyProgress?: boolean;
  sessionReminders?: boolean;
  theme?: 'dark' | 'light' | 'auto';
  language?: string;
  dailyGoalMinutes?: number;
}

interface UsePreferencesReturn {
  // State
  preferences: UserPreferences | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  updatePreferences: (updates: PreferencesUpdate) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
  clearError: () => void;
}

/**
 * Custom hook for managing user preferences
 * Provides CRUD operations and state management for user preferences
 */
export function usePreferences(): UsePreferencesReturn {
  const { user, isLoaded } = useUser();
  
  // State
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clear any existing errors
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Fetch user preferences from API
   */
  const fetchPreferences = useCallback(async () => {
    if (!user || !isLoaded) {
      console.log('🔄 User not ready, skipping preferences fetch');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Fetching preferences for user:', user.id);
      
      const response = await fetch('/api/user/preferences', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('📡 API Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        
        let errorMessage = 'Failed to fetch preferences';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If JSON parse fails, use the status text
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ Preferences data received:', data);
      
      if (data.success && data.preferences) {
        // Transform date strings back to Date objects
        const transformedPreferences: UserPreferences = {
          ...data.preferences,
          createdAt: new Date(data.preferences.createdAt),
          updatedAt: new Date(data.preferences.updatedAt),
        };
        
        setPreferences(transformedPreferences);
        console.log('✅ Preferences set in state');
      } else {
        throw new Error(data.message || 'Invalid response from server');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch preferences';
      console.error('❌ Failed to fetch preferences:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoaded]);

  /**
   * Update user preferences
   */
  const updatePreferences = useCallback(async (updates: PreferencesUpdate) => {
    if (!user) {
      setError('Please sign in to update preferences');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Updating preferences:', updates);
      
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      console.log('📡 Update response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Update API Error:', response.status, errorText);
        
        let errorMessage = 'Failed to update preferences';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ Update response:', data);
      
      if (data.success && data.preferences) {
        // Transform date strings back to Date objects
        const transformedPreferences: UserPreferences = {
          ...data.preferences,
          createdAt: new Date(data.preferences.createdAt),
          updatedAt: new Date(data.preferences.updatedAt),
        };
        
        setPreferences(transformedPreferences);
        console.log('✅ Preferences updated successfully');
      } else {
        throw new Error(data.message || 'Failed to update preferences');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update preferences';
      console.error('❌ Failed to update preferences:', errorMessage);
      setError(errorMessage);
      throw error; // Re-throw so the UI can handle it
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Reset preferences to defaults
   */
  const resetToDefaults = useCallback(async () => {
    if (!user) {
      setError('Please sign in to reset preferences');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Resetting preferences to defaults');
      
      const response = await fetch('/api/user/preferences', {
        method: 'DELETE',
      });

      console.log('📡 Reset response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Reset API Error:', response.status, errorText);
        
        let errorMessage = 'Failed to reset preferences';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ Reset response:', data);
      
      if (data.success && data.preferences) {
        // Transform date strings back to Date objects
        const transformedPreferences: UserPreferences = {
          ...data.preferences,
          createdAt: new Date(data.preferences.createdAt),
          updatedAt: new Date(data.preferences.updatedAt),
        };
        
        setPreferences(transformedPreferences);
        console.log('✅ Preferences reset successfully');
      } else {
        throw new Error(data.message || 'Failed to reset preferences');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset preferences';
      console.error('❌ Failed to reset preferences:', errorMessage);
      setError(errorMessage);
      throw error; // Re-throw so the UI can handle it
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Refresh preferences (alias for fetchPreferences)
   */
  const refreshPreferences = useCallback(() => {
    return fetchPreferences();
  }, [fetchPreferences]);

  // Load preferences when user is available
  useEffect(() => {
    if (user && isLoaded) {
      console.log('🔄 User is ready, fetching preferences');
      fetchPreferences();
    } else {
      console.log('⏳ Waiting for user to be ready...', { user: !!user, isLoaded });
    }
  }, [user, isLoaded, fetchPreferences]);

  return {
    // State
    preferences,
    isLoading,
    error,
    
    // Actions
    updatePreferences,
    resetToDefaults,
    refreshPreferences,
    clearError,
  };
}