// src/services/user-service.ts
import { db } from '@/lib/db';
import { 
  users, 
  userProgress, 
  userPreferences,
  assessments,
  type User, 
  type NewUser, 
  type UserProgress, 
  type UserPreferences,
  type NewUserPreferences,
  type Assessment,
} from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

/**
 * 🎯 NEW: Enhanced user context interface for onboarding
 */
export interface UserContext {
  needsOnboarding: boolean;
  onboardingCompleted: boolean;
  isFirstTimeUser: boolean;
  userName?: string;
  preferredLanguage?: string;
  selectedSubject?: 'digital' | 'finance' | 'health';
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * 🎯 NEW: Onboarding step data interface
 */
export interface OnboardingStepData {
  step: 'welcome' | 'language' | 'name' | 'subject' | 'assessment' | 'complete';
  language?: string;
  name?: string;
  subject?: 'digital' | 'finance' | 'health';
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  deviceType?: string;
}

/**
 * 🎯 NEW: User creation options
 */
export interface CreateUserOptions {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  onboardingCompleted?: boolean;
  preferredLanguage?: string;
  createPreferences?: boolean;
  createProgress?: boolean;
}

/**
 * Enhanced User Service with comprehensive onboarding support
 * Handles user creation, onboarding flow, preferences, and progress tracking
 */
export class UserService {

  /**
   * 🎯 ENHANCED: Get user with full preferences and onboarding context
   */
  static async getUserWithPreferences(clerkId: string): Promise<(User & { 
    preferences?: UserPreferences;
    userContext?: UserContext;
  }) | null> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        with: {
          preferences: true,
        }
      });

      if (!user) {
        return null;
      }

      // 🎯 NEW: Generate user context for onboarding
      const userContext: UserContext = {
        needsOnboarding: !user.onboardingCompleted,
        onboardingCompleted: user.onboardingCompleted || false,
        isFirstTimeUser: !user.onboardingCompleted,
        userName: user.firstName || undefined,
        preferredLanguage: user.preferences?.language || 'en',
        selectedSubject: user.preferredSubject || undefined,
        skillLevel: user.skillLevel || undefined,
      };

      return {
        ...user,
        preferences: user.preferences || undefined,
        userContext,
      };
    } catch (error) {
      console.error('Error getting user with preferences:', error);
      return null;
    }
  }

  /**
   * 🎯 ENHANCED: Create new user with comprehensive onboarding setup
   */
  static async createUser(options: CreateUserOptions): Promise<User> {
    try {
      const {
        clerkId,
        email,
        firstName,
        lastName,
        imageUrl,
        onboardingCompleted = false,
        preferredLanguage = 'en',
        createPreferences = true,
        createProgress = true,
      } = options;

      console.log('🎯 Creating new user with onboarding setup:', { clerkId, email, onboardingCompleted });

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          clerkId,
          email,
          firstName,
          lastName,
          imageUrl,
          onboardingCompleted,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      console.log('✅ User created successfully:', newUser.clerkId);

      // 🎯 NEW: Create default preferences if requested
      if (createPreferences) {
        try {
          await this.createDefaultPreferences(clerkId, preferredLanguage);
          console.log('✅ Default preferences created');
        } catch (error) {
          console.warn('⚠️ Failed to create default preferences:', error);
          // Don't fail user creation if preferences fail
        }
      }

      // 🎯 NEW: Create initial progress tracking if requested
      if (createProgress) {
        try {
          await this.createInitialProgress(clerkId);
          console.log('✅ Initial progress tracking created');
        } catch (error) {
          console.warn('⚠️ Failed to create initial progress:', error);
          // Don't fail user creation if progress fails
        }
      }

      return newUser;
    } catch (error) {
      console.error('❌ Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  /**
   * 🎯 NEW: Update user onboarding step
   */
  static async updateOnboardingStep(
    clerkId: string, 
    stepData: OnboardingStepData
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      console.log('🎯 Updating onboarding step:', { clerkId, step: stepData.step });

      const updateData: Partial<User> = {
        updatedAt: new Date(),
      };

      // Update user data based on step
      if (stepData.name) {
        updateData.firstName = stepData.name;
      }

      if (stepData.subject) {
        updateData.preferredSubject = stepData.subject;
      }

      if (stepData.skillLevel) {
        updateData.skillLevel = stepData.skillLevel;
      }

      // Mark as completed if this is the final step
      if (stepData.step === 'complete') {
        updateData.onboardingCompleted = true;
        console.log('🎉 Marking onboarding as completed');
      }

      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.clerkId, clerkId))
        .returning();

      if (!updatedUser) {
        throw new Error('User not found');
      }

      // 🎯 NEW: Update preferences if language was provided
      if (stepData.language) {
        try {
          await this.updateUserPreferences(clerkId, { language: stepData.language });
          console.log('✅ Language preference updated');
        } catch (error) {
          console.warn('⚠️ Failed to update language preference:', error);
        }
      }

      console.log('✅ Onboarding step updated successfully');
      return { success: true, user: updatedUser };

    } catch (error) {
      console.error('❌ Error updating onboarding step:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update onboarding step' 
      };
    }
  }

  /**
   * 🎯 ENHANCED: Complete user onboarding with comprehensive updates
   */
  static async completeOnboarding(clerkId: string): Promise<User> {
    try {
      console.log('🎉 Completing onboarding for user:', clerkId);

      const [updatedUser] = await db
        .update(users)
        .set({
          onboardingCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, clerkId))
        .returning();

      if (!updatedUser) {
        throw new Error('User not found');
      }

      // 🎯 NEW: Ensure user has complete setup
      try {
        await this.ensureCompleteUserSetup(clerkId);
        console.log('✅ Ensured complete user setup');
      } catch (error) {
        console.warn('⚠️ Failed to ensure complete setup:', error);
      }

      console.log('🎉 Onboarding completed successfully for user:', clerkId);
      return updatedUser;
    } catch (error) {
      console.error('❌ Error completing onboarding:', error);
      throw new Error('Failed to complete onboarding');
    }
  }

  /**
   * 🎯 NEW: Ensure user has complete setup (preferences + progress)
   */
  static async ensureCompleteUserSetup(clerkId: string): Promise<void> {
    try {
      // Check if user has preferences
      const existingPreferences = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, clerkId))
        .limit(1);

      if (existingPreferences.length === 0) {
        await this.createDefaultPreferences(clerkId);
        console.log('✅ Created missing preferences');
      }

      // Check if user has progress tracking
      const existingProgress = await db
        .select()
        .from(userProgress)
        .where(eq(userProgress.userId, clerkId))
        .limit(1);

      if (existingProgress.length === 0) {
        await this.createInitialProgress(clerkId);
        console.log('✅ Created missing progress tracking');
      }
    } catch (error) {
      console.error('❌ Error ensuring complete user setup:', error);
      throw error;
    }
  }

  /**
   * Update existing user
   */
  static async updateUser(clerkId: string, userData: Partial<Omit<User, 'clerkId' | 'createdAt'>>): Promise<User> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set({
          ...userData,
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, clerkId))
        .returning();

      if (!updatedUser) {
        throw new Error('User not found');
      }

      return updatedUser;
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  /**
   * 🎯 ENHANCED: Update user learning preferences with validation
   */
  static async updateLearningPreferences(
    clerkId: string, 
    preferences: {
      preferredSubject?: 'digital' | 'finance' | 'health';
      skillLevel?: 'beginner' | 'intermediate' | 'advanced';
    }
  ): Promise<User> {
    try {
      console.log('🎯 Updating learning preferences:', { clerkId, preferences });

      const [updatedUser] = await db
        .update(users)
        .set({
          ...preferences,
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, clerkId))
        .returning();

      if (!updatedUser) {
        throw new Error('User not found');
      }

      console.log('✅ Learning preferences updated successfully');
      return updatedUser;
    } catch (error) {
      console.error('❌ Error updating learning preferences:', error);
      throw new Error('Failed to update learning preferences');
    }
  }

  /**
   * 🎯 NEW: Update user preferences (language, theme, etc.)
   */
  static async updateUserPreferences(
    clerkId: string,
    preferences: Partial<Pick<UserPreferences, 'language' | 'theme' | 'sessionReminders' | 'dailyGoalMinutes'>>
  ): Promise<UserPreferences> {
    try {
      console.log('🎯 Updating user preferences:', { clerkId, preferences });

      // Check if preferences exist
      const [existingPreferences] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, clerkId))
        .limit(1);

      if (existingPreferences) {
        // Update existing preferences
        const [updatedPreferences] = await db
          .update(userPreferences)
          .set({
            ...preferences,
            updatedAt: new Date(),
          })
          .where(eq(userPreferences.userId, clerkId))
          .returning();

        return updatedPreferences;
      } else {
        // Create new preferences
        const [newPreferences] = await db
          .insert(userPreferences)
          .values({
            userId: clerkId,
            ...preferences,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        return newPreferences;
      }
    } catch (error) {
      console.error('❌ Error updating user preferences:', error);
      throw new Error('Failed to update user preferences');
    }
  }

  /**
   * Get user's learning progress
   */
  static async getUserProgress(clerkId: string): Promise<UserProgress[]> {
    try {
      const progress = await db
        .select()
        .from(userProgress)
        .where(eq(userProgress.userId, clerkId));

      return progress;
    } catch (error) {
      console.error('Error getting user progress:', error);
      return [];
    }
  }

  /**
   * Update user progress for a specific subject
   */
  static async updateUserProgress(
    clerkId: string,
    subject: 'digital' | 'finance' | 'health',
    skillLevel: 'beginner' | 'intermediate' | 'advanced',
    progressData: {
      completedTopics: string[];
      totalInteractions: number;
      lastActive: string;
      achievements: string[];
      currentStreak: number;
    }
  ): Promise<UserProgress> {
    try {
      // Check if progress exists for this subject
      const [existingProgress] = await db
        .select()
        .from(userProgress)
        .where(and(
          eq(userProgress.userId, clerkId),
          eq(userProgress.subject, subject)
        ))
        .limit(1);

      if (existingProgress) {
        // Update existing progress
        const [updatedProgress] = await db
          .update(userProgress)
          .set({
            skillLevel,
            progressData,
            updatedAt: new Date(),
          })
          .where(and(
            eq(userProgress.userId, clerkId),
            eq(userProgress.subject, subject)
          ))
          .returning();

        return updatedProgress;
      } else {
        // Create new progress entry
        const [newProgress] = await db
          .insert(userProgress)
          .values({
            userId: clerkId,
            subject,
            skillLevel,
            progressData,
            updatedAt: new Date(),
          })
          .returning();

        return newProgress;
      }
    } catch (error) {
      console.error('Error updating user progress:', error);
      throw new Error('Failed to update user progress');
    }
  }

  /**
   * 🎯 ENHANCED: Create default preferences with better language support
   */
  private static async createDefaultPreferences(
    clerkId: string,
    language: string = 'en'
  ): Promise<UserPreferences> {
    try {
      const [preferences] = await db
        .insert(userPreferences)
        .values({
          userId: clerkId,
          theme: 'dark',
          language,
          sessionReminders: false,
          dailyGoalMinutes: 30,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      console.log(`✅ Created default preferences for user: ${clerkId}`);
      return preferences;
    } catch (error) {
      console.error('Error creating default preferences:', error);
      throw new Error('Failed to create default preferences');
    }
  }

  /**
   * 🎯 ENHANCED: Create initial progress tracking for all subjects
   */
  private static async createInitialProgress(clerkId: string): Promise<void> {
    try {
      const subjects: Array<'digital' | 'finance' | 'health'> = ['digital', 'finance', 'health'];
      
      for (const subject of subjects) {
        await db
          .insert(userProgress)
          .values({
            userId: clerkId,
            subject,
            skillLevel: 'beginner',
            progressData: {
              completedTopics: [],
              totalInteractions: 0,
              lastActive: new Date().toISOString(),
              achievements: [],
              currentStreak: 0,
            },
            updatedAt: new Date(),
          });
      }

      console.log(`✅ Created initial progress tracking for user: ${clerkId}`);
    } catch (error) {
      console.error('Error creating initial progress:', error);
      throw new Error('Failed to create initial progress');
    }
  }

  /**
   * 🎯 NEW: Get user onboarding context
   */
  static async getUserOnboardingContext(clerkId: string): Promise<UserContext | null> {
    try {
      const userWithPreferences = await this.getUserWithPreferences(clerkId);
      return userWithPreferences?.userContext || null;
    } catch (error) {
      console.error('Error getting user onboarding context:', error);
      return null;
    }
  }

  /**
   * 🎯 NEW: Check if user exists and needs onboarding
   */
  static async checkUserOnboardingStatus(clerkId: string): Promise<{
    exists: boolean;
    needsOnboarding: boolean;
    user?: User;
  }> {
    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkId))
        .limit(1);

      if (user.length === 0) {
        return { exists: false, needsOnboarding: true };
      }

      return {
        exists: true,
        needsOnboarding: !user[0].onboardingCompleted,
        user: user[0],
      };
    } catch (error) {
      console.error('Error checking user onboarding status:', error);
      return { exists: false, needsOnboarding: true };
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStatistics(clerkId: string): Promise<{
    totalConversations: number;
    totalMessages: number;
    learningStreaks: Record<string, number>;
    completedTopics: string[];
    lastActive: Date | null;
  }> {
    try {
      // Get user's progress data
      const progress = await this.getUserProgress(clerkId);

      // Calculate statistics
      const stats = {
        totalConversations: 0, // Would need to join with conversations table
        totalMessages: 0, // Would need to join with messages table
        learningStreaks: progress.reduce((acc, p) => {
          acc[p.subject] = p.progressData?.currentStreak || 0;
          return acc;
        }, {} as Record<string, number>),
        completedTopics: progress.flatMap(p => p.progressData?.completedTopics || []),
        lastActive: progress.length > 0 ? new Date(progress[0].updatedAt) : null,
      };

      return stats;
    } catch (error) {
      console.error('Error getting user statistics:', error);
      return {
        totalConversations: 0,
        totalMessages: 0,
        learningStreaks: {},
        completedTopics: [],
        lastActive: null,
      };
    }
  }
}

