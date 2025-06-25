import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

// Load environment variables
config({ path: '.env.local' });

// Validate environment variable
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL environment variable is required. Please add it to your .env.local file.'
  );
}

// Create the connection
const sql = neon(connectionString);

// Create and export the database instance (CORRECTED PATTERN)
export const db = drizzle({ 
  client: sql, 
  schema,
  logger: process.env.NODE_ENV === 'development' 
});

// Export schema for convenience
export * from './schema';

// ==========================================
// DATABASE UTILITIES
// ==========================================

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    // Simple query to test connection
    await sql`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

/**
 * Health check for the database
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    await sql`SELECT 1`;
    const latency = Date.now() - startTime;
    
    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Database transaction helper
 */
import type { PgColumn, PgTransaction } from 'drizzle-orm/pg-core';
import type { NeonHttpQueryResultHKT, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { ExtractTablesWithRelations } from 'drizzle-orm';

export async function withTransaction<T>(
  callback: (
    tx: PgTransaction<
      NeonHttpQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >
  ) => Promise<T>
): Promise<T> {
  return await db.transaction(callback);
}

// ==========================================
// QUERY HELPERS (UPDATED FOR LATEST DRIZZLE)
// ==========================================

/**
 * Get user by Clerk ID
 */
export async function getUserByClerkId(clerkId: string) {
  try {
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.clerkId, clerkId),
    });
    
    return user || null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

/**
 * Get user with all related data
 */
export async function getUserWithRelations(clerkId: string) {
  try {
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.clerkId, clerkId),
      with: {
        preferences: true,
        progress: true,
        conversations: {
          with: {
            messages: {
              orderBy: (messages, { desc }) => [desc(messages.createdAt)],
              limit: 10, // Latest 10 messages per conversation
            }
          },
          orderBy: (conversations, { desc }) => [desc(conversations.updatedAt)],
          limit: 20, // Latest 20 conversations
        },
        assessments: {
          orderBy: (assessments, { desc }) => [desc(assessments.completedAt)],
          limit: 10, // Latest 10 assessments
        }
      }
    });
    
    return user || null;
  } catch (error) {
    console.error('Error fetching user with relations:', error);
    return null;
  }
}

/**
 * Create or update user from Clerk data (UPDATED WITH LATEST CLERK FIELDS)
 */
export async function upsertUser(userData: {
  clerkId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  profileImageUrl?: string | null;
}) {
  try {
    const existingUser = await getUserByClerkId(userData.clerkId);
    
    if (existingUser) {
      // Update existing user
      const [updatedUser] = await db
        .update(schema.users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          imageUrl: userData.imageUrl || userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(schema.eq(schema.users.clerkId, userData.clerkId))
        .returning();
      
      return updatedUser;
    } else {
      // Create new user
      const [newUser] = await db
        .insert(schema.users)
        .values({
          clerkId: userData.clerkId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          imageUrl: userData.imageUrl || userData.profileImageUrl,
        })
        .returning();
      
      // Create default preferences for new user
      await db
        .insert(schema.userPreferences)
        .values({
          userId: userData.clerkId,
          theme: 'dark',
          language: 'en',
          emailNotifications: true,
          pushNotifications: true,
          weeklyProgress: true,
          dailyGoalMinutes: 30,
        });
      
      return newUser;
    }
  } catch (error) {
    console.error('Error upserting user:', error);
    throw error;
  }
}

/**
 * Get user conversations with pagination
 */
export async function getUserConversations(
  clerkId: string,
  limit: number = 20,
  offset: number = 0
) {
  try {
    const conversations = await db.query.conversations.findMany({
      where: (conversations, { eq }) => eq(conversations.userId, clerkId),
      with: {
        messages: {
          orderBy: (messages, { desc }) => [desc(messages.createdAt)],
          limit: 1, // Just the latest message for preview
        }
      },
      orderBy: (conversations, { desc }) => [desc(conversations.updatedAt)],
      limit,
      offset,
    });
    
    return conversations;
  } catch (error) {
    console.error('Error fetching user conversations:', error);
    return [];
  }
}

/**
 * Get conversation with all messages
 */
export async function getConversationWithMessages(conversationId: string) {
  try {
    const conversation = await db.query.conversations.findFirst({
      where: (conversations, { eq }) => eq(conversations.id, conversationId),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        }
      }
    });
    
    return conversation || null;
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return null;
  }
}

/**
 * Create new conversation
 */
export async function createConversation(userId: string, title: string) {
  try {
    const [conversation] = await db
      .insert(schema.conversations)
      .values({
        userId,
        title,
      })
      .returning();
    
    return conversation;
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
}

/**
 * Add message to conversation
 */
export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  agentType?: 'router' | 'digital_mentor' | 'finance_guide' | 'health_coach'
) {
  try {
    const [message] = await db
      .insert(schema.messages)
      .values({
        conversationId,
        role,
        content,
        agentType,
      })
      .returning();
    
    // Update conversation timestamp
    await db
      .update(schema.conversations)
      .set({ updatedAt: new Date() })
      .where(schema.eq(schema.conversations.id, conversationId));
    
    return message;
  } catch (error) {
    console.error('Error adding message:', error);
    throw error;
  }
}

// ==========================================
// DEVELOPMENT HELPERS
// ==========================================

/**
 * Development helper to reset database
 * ⚠️ WARNING: This will delete ALL data
 */
export async function resetDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Database reset is not allowed in production');
  }
  
  try {
    console.log('⚠️  Resetting database...');
    
    // Drop tables in reverse dependency order
    await sql`DROP TABLE IF EXISTS messages CASCADE`;
    await sql`DROP TABLE IF EXISTS conversations CASCADE`;
    await sql`DROP TABLE IF EXISTS assessments CASCADE`;
    await sql`DROP TABLE IF EXISTS user_progress CASCADE`;
    await sql`DROP TABLE IF EXISTS user_preferences CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;
    
    console.log('✅ Database reset complete');
    return true;
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    return false;
  }
}