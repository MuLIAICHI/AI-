import { 
  db, 
  userPreferences, 
  users,
  type UserPreferences, 
  type NewUserPreferences 
} from '@/lib/db';
import { eq } from 'drizzle-orm';

// ==========================================
// PREFERENCE TYPES
// ==========================================

export interface PreferenceUpdate {
  // Learning preferences
  learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  difficultyPreference?: 'easy' | 'moderate' | 'challenging';
  
  // Notification preferences
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  weeklyProgress?: boolean;
  sessionReminders?: boolean;
  
  // UI preferences
  theme?: 'dark' | 'light' | 'auto';
  language?: string;
  
  // Session preferences
  dailyGoalMinutes?: number;
}

export interface LearningPreferences {
  preferredSubject?: 'digital' | 'finance' | 'health';
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  difficultyPreference?: 'easy' | 'moderate' | 'challenging';
}

// ==========================================
// USER PREFERENCES SERVICE
// ==========================================

export class PreferencesService {

  /**
   * Get user preferences
   */
  static async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const [preferences] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      return preferences || null;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return null;
    }
  }

  /**
   * Get or create user preferences with defaults
   */
  static async getOrCreateUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      let preferences = await this.getUserPreferences(userId);
      
      if (!preferences) {
        preferences = await this.createDefaultPreferences(userId);
      }
      
      return preferences;
    } catch (error) {
      console.error('Error getting or creating user preferences:', error);
      throw new Error('Failed to get user preferences');
    }
  }

  /**
   * Update user preferences
   */
  static async updatePreferences(
    userId: string, 
    updates: PreferenceUpdate
  ): Promise<UserPreferences> {
    try {
      // Ensure preferences exist
      await this.getOrCreateUserPreferences(userId);
      
      const [updatedPreferences] = await db
        .update(userPreferences)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, userId))
        .returning();

      if (!updatedPreferences) {
        throw new Error('Failed to update preferences');
      }

      console.log(`✅ Updated preferences for user: ${userId}`);
      return updatedPreferences;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw new Error('Failed to update preferences');
    }
  }

  /**
   * Update learning preferences (also updates user table)
   */
  static async updateLearningPreferences(
    userId: string,
    learningPrefs: LearningPreferences
  ): Promise<{ preferences: UserPreferences; userUpdated: boolean }> {
    try {
      // Update preferences table
      const preferences = await this.updatePreferences(userId, {
        learningStyle: learningPrefs.learningStyle,
        difficultyPreference: learningPrefs.difficultyPreference,
      });

      // Update user table if needed
      let userUpdated = false;
      if (learningPrefs.preferredSubject || learningPrefs.skillLevel) {
        await db
          .update(users)
          .set({
            preferredSubject: learningPrefs.preferredSubject,
            skillLevel: learningPrefs.skillLevel,
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, userId));
        
        userUpdated = true;
      }

      console.log(`✅ Updated learning preferences for user: ${userId}`);
      return { preferences, userUpdated };
    } catch (error) {
      console.error('Error updating learning preferences:', error);
      throw new Error('Failed to update learning preferences');
    }
  }

  /**
   * Update notification preferences
   */
  static async updateNotificationPreferences(
    userId: string,
    notifications: {
      emailNotifications?: boolean;
      pushNotifications?: boolean;
      weeklyProgress?: boolean;
      sessionReminders?: boolean;
    }
  ): Promise<UserPreferences> {
    try {
      const preferences = await this.updatePreferences(userId, notifications);
      
      console.log(`✅ Updated notification preferences for user: ${userId}`);
      return preferences;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw new Error('Failed to update notification preferences');
    }
  }

  /**
   * Update UI preferences
   */
  static async updateUIPreferences(
    userId: string,
    uiPrefs: {
      theme?: 'dark' | 'light' | 'auto';
      language?: string;
    }
  ): Promise<UserPreferences> {
    try {
      const preferences = await this.updatePreferences(userId, uiPrefs);
      
      console.log(`✅ Updated UI preferences for user: ${userId}`);
      return preferences;
    } catch (error) {
      console.error('Error updating UI preferences:', error);
      throw new Error('Failed to update UI preferences');
    }
  }

  /**
   * Update session preferences
   */
  static async updateSessionPreferences(
    userId: string,
    sessionPrefs: {
      dailyGoalMinutes?: number;
      sessionReminders?: boolean;
    }
  ): Promise<UserPreferences> {
    try {
      const preferences = await this.updatePreferences(userId, sessionPrefs);
      
      console.log(`✅ Updated session preferences for user: ${userId}`);
      return preferences;
    } catch (error) {
      console.error('Error updating session preferences:', error);
      throw new Error('Failed to update session preferences');
    }
  }

  /**
   * Reset preferences to defaults
   */
  static async resetToDefaults(userId: string): Promise<UserPreferences> {
    try {
      const defaultPrefs = this.getDefaultPreferences(userId);
      
      const [resetPreferences] = await db
        .update(userPreferences)
        .set({
          ...defaultPrefs,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, userId))
        .returning();

      if (!resetPreferences) {
        throw new Error('Failed to reset preferences');
      }

      console.log(`✅ Reset preferences to defaults for user: ${userId}`);
      return resetPreferences;
    } catch (error) {
      console.error('Error resetting preferences:', error);
      throw new Error('Failed to reset preferences');
    }
  }

  /**
   * Get user preferences with learning info from user table
   */
  static async getFullUserPreferences(userId: string): Promise<{
    preferences: UserPreferences;
    preferredSubject?: 'digital' | 'finance' | 'health';
    skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  } | null> {
    try {
      const result = await db.query.users.findFirst({
        where: eq(users.clerkId, userId),
        with: {
          preferences: true,
        }
      });

      if (!result) return null;

      return {
        preferences: result.preferences || await this.createDefaultPreferences(userId),
        preferredSubject: result.preferredSubject || undefined,
        skillLevel: result.skillLevel || undefined,
      };
    } catch (error) {
      console.error('Error getting full user preferences:', error);
      return null;
    }
  }

  /**
   * Check if user has completed preference setup
   */
  static async hasCompletedPreferenceSetup(userId: string): Promise<boolean> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, userId),
        with: {
          preferences: true,
        }
      });

      if (!user) return false;

      // Check if user has set learning preferences
      const hasLearningPrefs = !!(
        user.preferredSubject && 
        user.skillLevel &&
        user.preferences?.learningStyle
      );

      return hasLearningPrefs;
    } catch (error) {
      console.error('Error checking preference setup:', error);
      return false;
    }
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Create default preferences for user
   */
  private static async createDefaultPreferences(userId: string): Promise<UserPreferences> {
    try {
      const defaultPrefs = this.getDefaultPreferences(userId);
      
      const [newPreferences] = await db
        .insert(userPreferences)
        .values(defaultPrefs)
        .returning();

      console.log(`✅ Created default preferences for user: ${userId}`);
      return newPreferences;
    } catch (error) {
      console.error('Error creating default preferences:', error);
      throw new Error('Failed to create default preferences');
    }
  }

  /**
   * Get default preference values
   */
  private static getDefaultPreferences(userId: string): Omit<NewUserPreferences, 'id'> {
    return {
      userId,
      
      // Learning preferences
      learningStyle: undefined,
      difficultyPreference: 'moderate',
      
      // Notification preferences
      emailNotifications: true,
      pushNotifications: true,
      weeklyProgress: true,
      sessionReminders: false,
      
      // UI preferences
      theme: 'dark',
      language: 'en',
      
      // Session preferences
      dailyGoalMinutes: 30,
      
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Get theme preference with fallback
 */
export function getThemePreference(preferences: UserPreferences | null): 'dark' | 'light' | 'auto' {
  return preferences?.theme || 'dark';
}

/**
 * Get language preference with fallback
 */
export function getLanguagePreference(preferences: UserPreferences | null): string {
  return preferences?.language || 'en';
}

/**
 * Check if notifications are enabled
 */
export function areNotificationsEnabled(preferences: UserPreferences | null): boolean {
  return preferences?.emailNotifications || preferences?.pushNotifications || false;
}

/**
 * Get daily goal in minutes
 */
export function getDailyGoalMinutes(preferences: UserPreferences | null): number {
  return preferences?.dailyGoalMinutes || 30;
}

/**
 * Format preferences for display
 */
export function formatPreferencesForDisplay(preferences: UserPreferences) {
  return {
    // Learning
    learningStyle: preferences.learningStyle || 'Not set',
    difficultyPreference: preferences.difficultyPreference || 'Moderate',
    
    // Notifications
    emailNotifications: preferences.emailNotifications ? 'Enabled' : 'Disabled',
    pushNotifications: preferences.pushNotifications ? 'Enabled' : 'Disabled',
    weeklyProgress: preferences.weeklyProgress ? 'Enabled' : 'Disabled',
    sessionReminders: preferences.sessionReminders ? 'Enabled' : 'Disabled',
    
    // UI
    theme: preferences.theme || 'Dark',
    language: preferences.language || 'English',
    
    // Session
    dailyGoal: `${preferences.dailyGoalMinutes || 30} minutes`,
  };
}

/**
 * Validate preference values
 */
export function validatePreferenceUpdate(updates: PreferenceUpdate): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate learning style
  if (updates.learningStyle && !['visual', 'auditory', 'kinesthetic', 'reading'].includes(updates.learningStyle)) {
    errors.push('Invalid learning style');
  }

  // Validate difficulty preference
  if (updates.difficultyPreference && !['easy', 'moderate', 'challenging'].includes(updates.difficultyPreference)) {
    errors.push('Invalid difficulty preference');
  }

  // Validate theme
  if (updates.theme && !['dark', 'light', 'auto'].includes(updates.theme)) {
    errors.push('Invalid theme');
  }

  // Validate daily goal
  if (updates.dailyGoalMinutes && (updates.dailyGoalMinutes < 5 || updates.dailyGoalMinutes > 480)) {
    errors.push('Daily goal must be between 5 and 480 minutes');
  }

  // Validate language (basic check)
  if (updates.language && updates.language.length > 10) {
    errors.push('Invalid language code');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}