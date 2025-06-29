// src/services/user-service.ts
import { db, users, userPreferences, userProgress, type User, type NewUser, type UserPreferences } from '@/lib/db';
import { eq } from 'drizzle-orm';
import type { User as ClerkUser } from '@clerk/nextjs/server';

// ==========================================
// USER SYNC SERVICE
// ==========================================

export class UserService {
  
  /**
   * Sync Clerk user with database
   * Creates new user or updates existing user
   */
  static async syncUserFromClerk(clerkUser: ClerkUser): Promise<User> {
    try {
      const userData = {
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
      };

      // Check if user exists
      const existingUser = await this.getUserByClerkId(clerkUser.id);

      if (existingUser) {
        // Update existing user
        return await this.updateUser(clerkUser.id, userData);
      } else {
        // Create new user
        return await this.createUser(userData);
      }
    } catch (error) {
      console.error('Error syncing user from Clerk:', error);
      throw new Error('Failed to sync user');
    }
  }

  /**
   * Get user by Clerk ID
   */
  static async getUserByClerkId(clerkId: string): Promise<User | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkId))
        .limit(1);

      return user || null;
    } catch (error) {
      console.error('Error getting user by Clerk ID:', error);
      return null;
    }
  }

  /**
   * Get user with preferences
   * ✅ Fixed: Properly handle null to undefined conversion for preferences
   */
  static async getUserWithPreferences(clerkId: string): Promise<(User & { preferences?: UserPreferences }) | null> {
    try {
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.clerkId, clerkId),
        with: {
          preferences: true,
        }
      });

      if (!user) {
        return null;
      }

      // ✅ Fixed: Convert null preferences to undefined to match TypeScript optional property expectations
      return {
        ...user,
        preferences: user.preferences || undefined, // Convert null to undefined
      };
    } catch (error) {
      console.error('Error getting user with preferences:', error);
      return null;
    }
  }

  /**
   * Create new user
   */
  static async createUser(userData: Omit<NewUser, 'createdAt' | 'updatedAt'>): Promise<User> {
    try {
      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Create default preferences
      await this.createDefaultPreferences(userData.clerkId);

      // Create initial progress tracking
      await this.createInitialProgress(userData.clerkId);

      console.log(`✅ Created new user: ${userData.email}`);
      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
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
   * Update user learning preferences
   */
  static async updateLearningPreferences(
    clerkId: string, 
    preferences: {
      preferredSubject?: 'digital' | 'finance' | 'health';
      skillLevel?: 'beginner' | 'intermediate' | 'advanced';
    }
  ): Promise<User> {
    try {
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

      console.log(`✅ Updated learning preferences for user: ${clerkId}`);
      return updatedUser;
    } catch (error) {
      console.error('Error updating learning preferences:', error);
      throw new Error('Failed to update learning preferences');
    }
  }

  /**
   * Mark user onboarding as completed
   */
  static async completeOnboarding(clerkId: string): Promise<User> {
    try {
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

      console.log(`✅ Completed onboarding for user: ${clerkId}`);
      return updatedUser;
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw new Error('Failed to complete onboarding');
    }
  }

  /**
   * Get user's learning progress
   */
  static async getUserProgress(clerkId: string): Promise<typeof userProgress.$inferSelect[]> {
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
  ): Promise<typeof userProgress.$inferSelect> {
    try {
      // Check if progress exists for this subject
      const [existingProgress] = await db
        .select()
        .from(userProgress)
        .where(eq(userProgress.userId, clerkId))
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
          .where(eq(userProgress.userId, clerkId))
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
   * Delete user and all associated data
   */
  static async deleteUser(clerkId: string): Promise<void> {
    try {
      // Delete in order to respect foreign key constraints
      
      // 1. Delete user progress
      await db
        .delete(userProgress)
        .where(eq(userProgress.userId, clerkId));

      // 2. Delete user preferences
      await db
        .delete(userPreferences)
        .where(eq(userPreferences.userId, clerkId));

      // 3. Delete user (conversations and messages will be cascade deleted)
      await db
        .delete(users)
        .where(eq(users.clerkId, clerkId));

      console.log(`✅ Deleted user and all associated data: ${clerkId}`);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Create default preferences for a new user
   */
  private static async createDefaultPreferences(clerkId: string): Promise<UserPreferences> {
    try {
      const [preferences] = await db
        .insert(userPreferences)
        .values({
          userId: clerkId,
          learningStyle: undefined,
          difficultyPreference: 'moderate',
          emailNotifications: true,
          pushNotifications: true,
          weeklyProgress: true,
          sessionReminders: false,
          theme: 'dark',
          language: 'en',
          dailyGoalMinutes: 30,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return preferences;
    } catch (error) {
      console.error('Error creating default preferences:', error);
      throw new Error('Failed to create default preferences');
    }
  }

  /**
   * Create initial progress tracking for a new user
   */
  private static async createInitialProgress(clerkId: string): Promise<void> {
    try {
      // Create initial progress entries for all subjects
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
      // Don't throw error here as it's not critical for user creation
      console.warn('Continuing without initial progress tracking');
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
      // Get user's conversations count
      const conversationsCount = await db.query.conversations.findMany({
        where: (conversations, { eq }) => eq(conversations.userId, clerkId),
      });

      // Get user's progress data
      const progress = await this.getUserProgress(clerkId);

      // Calculate statistics
      const stats = {
        totalConversations: conversationsCount.length,
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