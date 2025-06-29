// src/lib/db/index.ts
// ✅ FIXED: Edge Runtime Compatible Database Connection
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm'; // ✅ FIXED: Import eq function properly
import * as schema from './schema';

// ✅ REMOVED: dotenv import (not compatible with edge runtime)
// ✅ FIXED: Environment variables are available directly in edge runtime
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL environment variable is required. Please add it to your .env.local file.'
  );
}

// Create the connection
const sql = neon(connectionString);

// Create and export the database instance
export const db = drizzle(sql, { 
  schema,
  logger: process.env.NODE_ENV === 'development' 
});

// Export schema for convenience
export * from './schema';

// ==========================================
// DATABASE UTILITIES (EDGE RUNTIME COMPATIBLE)
// ==========================================

/**
 * Test database connection (edge runtime compatible)
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
 * Health check for the database (edge runtime compatible)
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

// ==========================================
// CONVERSATION HELPERS (UPDATED SCHEMA)
// ==========================================

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
        createdAt: new Date(),
        updatedAt: new Date(),
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
        createdAt: new Date(),
      })
      .returning();
    
    // Update conversation timestamp - ✅ FIXED: Use eq from drizzle-orm
    await db
      .update(schema.conversations)
      .set({ updatedAt: new Date() })
      .where(eq(schema.conversations.id, conversationId)); // ✅ FIXED: Correct eq usage
    
    return message;
  } catch (error) {
    console.error('Error adding message:', error);
    throw error;
  }
}