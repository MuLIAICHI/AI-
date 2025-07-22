// src/hooks/use-profile.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

// ==========================================
// TYPES
// ==========================================

export interface UserProfile {
  id: string;
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  
  // Learning info
  onboardingCompleted: boolean;
  preferredSubject?: 'digital' | 'finance' | 'health';
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProgress {
  id: string;
  userId: string;
  subject: 'digital' | 'finance' | 'health';
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  progressData: {
    completedTopics: string[];
    totalInteractions: number;
    lastActive: string;
    achievements: string[];
    currentStreak: number;
  };
  updatedAt: Date;
}

export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
  preferredSubject?: 'digital' | 'finance' | 'health';
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export interface ProfileData {
  profile: UserProfile;
  progress: UserProgress[];
  stats: {
    totalInteractions: number;
    currentStreak: number;
    completedTopics: number;
    achievements: number;
    joinedDate: Date;
    lastActive: Date;
  };
}

interface UseProfileReturn {
  // State
  profileData: ProfileData | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  updateProfile: (updates: ProfileUpdate) => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
  
  // Computed values
  displayName: string;
  progressSummary: {
    digital: number;
    finance: number;
    health: number;
  };
}

/**
 * Custom hook for managing user profile data
 * Provides CRUD operations and computed values for user profiles and progress
 */
export function useProfile(): UseProfileReturn {
  const { user, isLoaded } = useUser();
  
  // State
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clear any existing errors
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Fetch complete profile data from API
   */
  const fetchProfile = useCallback(async () => {
    if (!user || !isLoaded) {
      console.log('🔄 User not ready, skipping profile fetch');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Fetching profile for user:', user.id);
      
      const response = await fetch('/api/user/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('📡 API Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        
        let errorMessage = 'Failed to fetch profile';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ Profile data received:', data);
      
      if (data.success && data.profileData) {
        // Transform date strings back to Date objects
        const transformedData: ProfileData = {
          ...data.profileData,
          profile: {
            ...data.profileData.profile,
            createdAt: new Date(data.profileData.profile.createdAt),
            updatedAt: new Date(data.profileData.profile.updatedAt),
          },
          progress: data.profileData.progress.map((p: any) => ({
            ...p,
            updatedAt: new Date(p.updatedAt),
          })),
          stats: {
            ...data.profileData.stats,
            joinedDate: new Date(data.profileData.stats.joinedDate),
            lastActive: new Date(data.profileData.stats.lastActive),
          },
        };
        
        setProfileData(transformedData);
        console.log('✅ Profile data set in state');
      } else {
        throw new Error(data.message || 'Invalid response from server');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ Error fetching profile:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoaded]);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (updates: ProfileUpdate) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Updating profile for user:', user.id, updates);
      
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        
        let errorMessage = 'Failed to update profile';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ Profile updated successfully:', data);
      
      // Refresh profile data to get latest state
      await fetchProfile();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('❌ Error updating profile:', errorMessage);
      setError(errorMessage);
      throw error; // Re-throw for form error handling
    } finally {
      setIsLoading(false);
    }
  }, [user, fetchProfile]);

  /**
   * Refresh profile data manually
   */
  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  // Fetch profile data when user is ready
  useEffect(() => {
    if (user && isLoaded) {
      fetchProfile();
    }
  }, [user, isLoaded, fetchProfile]);

  // Computed values
  const displayName = profileData?.profile 
    ? `${profileData.profile.firstName || ''} ${profileData.profile.lastName || ''}`.trim() || 
      profileData.profile.email?.split('@')[0] || 
      'User'
    : 'Loading...';

  const progressSummary = profileData?.progress.reduce((acc, progress) => {
    const percentage = Math.round(
      (progress.progressData.completedTopics.length / Math.max(progress.progressData.totalInteractions, 1)) * 100
    );
    acc[progress.subject] = Math.min(percentage, 100);
    return acc;
  }, { digital: 0, finance: 0, health: 0 }) || { digital: 0, finance: 0, health: 0 };

  return {
    // State
    profileData,
    isLoading,
    error,
    
    // Actions
    updateProfile,
    refreshProfile,
    clearError,
    
    // Computed values
    displayName,
    progressSummary,
  };
}