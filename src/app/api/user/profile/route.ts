// src/app/api/user/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { users, userProgress, userPreferences } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { UserService } from '@/services/user-service';

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const profileUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  preferredSubject: z.enum(['digital', 'finance', 'health']).optional(),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get complete profile data including progress and stats
 */
async function getCompleteProfileData(userId: string) {
  try {
    // Get user with preferences
    const userWithPrefs = await UserService.getUserWithPreferences(userId);
    
    if (!userWithPrefs) {
      throw new Error('User not found');
    }

    // Get user progress data
    const progressData = await db.query.userProgress.findMany({
      where: eq(userProgress.userId, userId),
    });

    // Calculate stats
    const stats = calculateUserStats(userWithPrefs, progressData);

    return {
      profile: userWithPrefs,
      progress: progressData,
      stats,
    };
  } catch (error) {
    console.error('Error getting complete profile data:', error);
    throw new Error('Failed to get profile data');
  }
}

/**
 * Calculate user statistics from profile and progress data
 */
function calculateUserStats(user: any, progressData: any[]) {
  const now = new Date();
  
  let totalInteractions = 0;
  let maxStreak = 0;
  let totalCompletedTopics = 0;
  let totalAchievements = 0;
  let lastActiveDate = user.createdAt;

  progressData.forEach(progress => {
    if (progress.progressData) {
      totalInteractions += progress.progressData.totalInteractions || 0;
      maxStreak = Math.max(maxStreak, progress.progressData.currentStreak || 0);
      totalCompletedTopics += progress.progressData.completedTopics?.length || 0;
      totalAchievements += progress.progressData.achievements?.length || 0;
      
      // Update last active date
      const progressDate = new Date(progress.updatedAt);
      if (progressDate > lastActiveDate) {
        lastActiveDate = progressDate;
      }
    }
  });

  return {
    totalInteractions,
    currentStreak: maxStreak,
    completedTopics: totalCompletedTopics,
    achievements: totalAchievements,
    joinedDate: user.createdAt,
    lastActive: lastActiveDate,
  };
}

// ==========================================
// API ROUTES
// ==========================================

/**
 * GET /api/user/profile - Get complete user profile data
 */
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to access profile' },
        { status: 401 }
      );
    }

    console.log('📩 Getting complete profile for user:', userId);

    // Get complete profile data
    const profileData = await getCompleteProfileData(userId);
    
    console.log('✅ Profile data retrieved successfully');
    
    return NextResponse.json({
      success: true,
      profileData,
    });

  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to fetch user profile',
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : 'Unknown error') : 
          undefined
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/profile - Update user profile
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to update profile' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    console.log('📩 Received profile update for user:', userId, body);
    
    const validation = profileUpdateSchema.safeParse(body);
    
    if (!validation.success) {
      console.error('❌ Validation failed:', validation.error.errors);
      return NextResponse.json({
        error: 'Invalid request',
        message: 'Please check your input and try again',
        details: validation.error.errors
      }, { status: 400 });
    }

    const updates = validation.data;

    // Ensure user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found', message: 'User profile does not exist' },
        { status: 404 }
      );
    }

    // Update user profile
    const [updatedUser] = await db
      .update(users)
      .set({
        firstName: updates.firstName,
        lastName: updates.lastName,
        preferredSubject: updates.preferredSubject,
        skillLevel: updates.skillLevel,
        updatedAt: new Date(),
      })
      .where(eq(users.clerkId, userId))
      .returning();

    if (!updatedUser) {
      throw new Error('Failed to update user profile');
    }
    
    console.log('✅ Profile updated successfully for user:', userId);

    // Get complete updated profile data
    const profileData = await getCompleteProfileData(userId);
    
    return NextResponse.json({
      success: true,
      profileData,
      message: 'Profile updated successfully',
    });

  } catch (error) {
    console.error('❌ Error updating profile:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to update profile',
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : 'Unknown error') : 
          undefined
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/profile - Create or initialize user profile
 * This endpoint can be used for onboarding completion
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to create profile' },
        { status: 401 }
      );
    }

    // Parse request body for initial profile data
    const body = await request.json();
    console.log('📩 Creating/initializing profile for user:', userId, body);
    
    const validation = profileUpdateSchema.extend({
      email: z.string().email().optional(),
      onboardingCompleted: z.boolean().optional(),
    }).safeParse(body);
    
    if (!validation.success) {
      console.error('❌ Validation failed:', validation.error.errors);
      return NextResponse.json({
        error: 'Invalid request',
        message: 'Please check your input and try again',
        details: validation.error.errors
      }, { status: 400 });
    }

    const profileData = validation.data;

    // Use UserService to create or update user
    const user = await UserService.createUser({
      clerkId: userId,
      email: profileData.email || `user-${userId}@temp.com`,
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      onboardingCompleted: profileData.onboardingCompleted || false,
      createPreferences: true,
      createProgress: true,
    });

    console.log('✅ Profile created/initialized successfully for user:', userId);

    // Get complete profile data
    const completeProfileData = await getCompleteProfileData(userId);
    
    return NextResponse.json({
      success: true,
      profileData: completeProfileData,
      message: 'Profile created successfully',
    });

  } catch (error) {
    console.error('❌ Error creating profile:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to create profile',
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : 'Unknown error') : 
          undefined
      },
      { status: 500 }
    );
  }
}