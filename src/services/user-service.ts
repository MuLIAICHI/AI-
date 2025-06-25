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
   */
  static async getUserWithPreferences(clerkId: string): Promise<(User & { preferences?: UserPreferences }) | null> {
    try {
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.clerkId, clerkId),
        with: {
          preferences: true,
        }
      });

      return user || null;
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
          preferredSubject: preferences.preferredSubject,
          skillLevel: preferences.skillLevel,
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
   * Mark onboarding as completed
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

      console.log(`✅ Onboarding completed for user: ${clerkId}`);
      return updatedUser;
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw new Error('Failed to complete onboarding');
    }
  }

  /**
   * Delete user and all related data
   */
  static async deleteUser(clerkId: string): Promise<boolean> {
    try {
      // This will cascade delete related data due to foreign key constraints
      const deletedRows = await db
        .delete(users)
        .where(eq(users.clerkId, clerkId));

      console.log(`✅ Deleted user: ${clerkId}`);
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(clerkId: string): Promise<{
    totalConversations: number;
    totalMessages: number;
    subjects: string[];
    joinedDate: Date;
    lastActive: Date;
  } | null> {
    try {
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.clerkId, clerkId),
        with: {
          conversations: {
            with: {
              messages: true,
            }
          },
          progress: true,
        }
      });

      if (!user) return null;

      const totalConversations = user.conversations.length;
      const totalMessages = user.conversations.reduce(
        (total, conv) => total + conv.messages.length, 
        0
      );
      const subjects = user.progress.map(p => p.subject);
      const lastActive = user.conversations.length > 0 
        ? new Date(Math.max(...user.conversations.map(c => c.updatedAt.getTime())))
        : user.createdAt;

      return {
        totalConversations,
        totalMessages,
        subjects,
        joinedDate: user.createdAt,
        lastActive,
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return null;
    }
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Create default preferences for new user
   */
  private static async createDefaultPreferences(clerkId: string): Promise<void> {
    try {
      await db
        .insert(userPreferences)
        .values({
          userId: clerkId,
          theme: 'dark',
          language: 'en',
          emailNotifications: true,
          pushNotifications: true,
          weeklyProgress: true,
          sessionReminders: false,
          dailyGoalMinutes: 30,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      console.log(`✅ Created default preferences for user: ${clerkId}`);
    } catch (error) {
      console.error('Error creating default preferences:', error);
      // Don't throw here - user creation should still succeed
    }
  }

  /**
   * Create initial progress tracking for new user
   */
  private static async createInitialProgress(clerkId: string): Promise<void> {
    try {
      const subjects: ('digital' | 'finance' | 'health')[] = ['digital', 'finance', 'health'];
      
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
      // Don't throw here - user creation should still succeed
    }
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Convert Clerk user to our User format
 */
export function clerkUserToDbUser(clerkUser: ClerkUser): Omit<NewUser, 'createdAt' | 'updatedAt'> {
  return {
    clerkId: clerkUser.id,
    email: clerkUser.emailAddresses[0]?.emailAddress || '',
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    imageUrl: clerkUser.imageUrl,
  };
}

/**
 * Check if user needs onboarding
 */
export async function userNeedsOnboarding(clerkId: string): Promise<boolean> {
  try {
    const user = await UserService.getUserByClerkId(clerkId);
    return user ? !user.onboardingCompleted : true;
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return true; // Default to needing onboarding
  }
}

/**
 * Get user display name
 */
export function getUserDisplayName(user: User): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  return user.email.split('@')[0];
}