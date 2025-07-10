// src/app/api/user/preferences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userPreferences } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for preference updates
const preferencesUpdateSchema = z.object({
  // Learning preferences
  learningStyle: z.enum(['visual', 'auditory', 'kinesthetic', 'reading']).optional(),
  difficultyPreference: z.enum(['easy', 'moderate', 'challenging']).optional(),
  
  // Notification preferences
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  weeklyProgress: z.boolean().optional(),
  sessionReminders: z.boolean().optional(),
  
  // UI preferences
  theme: z.enum(['dark', 'light', 'auto']).optional(),
  language: z.string().optional(),
  
  // Session preferences
  dailyGoalMinutes: z.number().min(5).max(480).optional(), // 5 minutes to 8 hours
});

/**
 * Helper function to get or create user preferences
 */
async function getOrCreateUserPreferences(userId: string) {
  try {
    // Try to get existing preferences
    const [existingPrefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (existingPrefs) {
      return existingPrefs;
    }

    // Create default preferences if they don't exist
    const [newPrefs] = await db
      .insert(userPreferences)
      .values({
        userId,
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

    console.log(`✅ Created default preferences for user: ${userId}`);
    return newPrefs;
  } catch (error) {
    console.error('Error getting/creating preferences:', error);
    throw new Error('Failed to get user preferences');
  }
}

/**
 * GET /api/user/preferences - Get user preferences
 */
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to access preferences' },
        { status: 401 }
      );
    }

    console.log('📩 Getting preferences for user:', userId);

    // Get or create user preferences
    const preferences = await getOrCreateUserPreferences(userId);
    
    console.log('✅ Preferences retrieved successfully');
    
    return NextResponse.json({
      success: true,
      preferences,
    });

  } catch (error) {
    console.error('❌ Error fetching user preferences:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to fetch user preferences',
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : 'Unknown error') : 
          undefined
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/preferences - Update user preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to update preferences' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    console.log('📩 Received preferences update for user:', userId, body);
    
    const validation = preferencesUpdateSchema.safeParse(body);
    
    if (!validation.success) {
      console.error('❌ Validation failed:', validation.error.errors);
      return NextResponse.json({
        error: 'Invalid request',
        message: 'Please check your input and try again',
        details: validation.error.errors
      }, { status: 400 });
    }

    const updates = validation.data;

    // Ensure preferences exist first
    await getOrCreateUserPreferences(userId);

    // Update preferences
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
    
    console.log('✅ Preferences updated successfully for user:', userId);
    
    return NextResponse.json({
      success: true,
      preferences: updatedPreferences,
      message: 'Preferences updated successfully',
    });

  } catch (error) {
    console.error('❌ Error updating preferences:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to update preferences',
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : 'Unknown error') : 
          undefined
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/preferences - Reset preferences to defaults
 */
export async function DELETE() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to reset preferences' },
        { status: 401 }
      );
    }

    console.log('📩 Resetting preferences for user:', userId);

    // Reset to defaults
    const [resetPreferences] = await db
      .update(userPreferences)
      .set({
        learningStyle: undefined,
        difficultyPreference: 'moderate',
        emailNotifications: true,
        pushNotifications: true,
        weeklyProgress: true,
        sessionReminders: false,
        theme: 'dark',
        language: 'en',
        dailyGoalMinutes: 30,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, userId))
      .returning();

    if (!resetPreferences) {
      // If no preferences exist, create them
      const defaultPrefs = await getOrCreateUserPreferences(userId);
      return NextResponse.json({
        success: true,
        preferences: defaultPrefs,
        message: 'Preferences reset to defaults successfully',
      });
    }
    
    console.log('✅ Preferences reset to defaults for user:', userId);
    
    return NextResponse.json({
      success: true,
      preferences: resetPreferences,
      message: 'Preferences reset to defaults successfully',
    });

  } catch (error) {
    console.error('❌ Error resetting preferences:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to reset preferences',
        details: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : 'Unknown error') : 
          undefined
      },
      { status: 500 }
    );
  }
}