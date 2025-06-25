import { 
  db, 
  conversations, 
  messages, 
  type Conversation, 
  type NewConversation, 
  type Message, 
  type NewMessage 
} from '@/lib/db';
import { eq, desc, asc, and, like, sql } from 'drizzle-orm';

// ==========================================
// CONVERSATION SERVICE
// ==========================================

export class ConversationService {

  /**
   * Create a new conversation
   */
  static async createConversation(
    userId: string, 
    title: string = 'New Conversation'
  ): Promise<Conversation> {
    try {
      const [newConversation] = await db
        .insert(conversations)
        .values({
          userId,
          title,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      console.log(`✅ Created new conversation: ${newConversation.id}`);
      return newConversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw new Error('Failed to create conversation');
    }
  }

  /**
   * Add a message to a conversation
   */
  static async addMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    agentType?: 'router' | 'digital_mentor' | 'finance_guide' | 'health_coach'
  ): Promise<Message> {
    try {
      const [newMessage] = await db
        .insert(messages)
        .values({
          conversationId,
          role,
          content,
          agentType,
          createdAt: new Date(),
        })
        .returning();

      // Update conversation's updatedAt timestamp
      await this.updateConversationTimestamp(conversationId);

      console.log(`✅ Added ${role} message to conversation: ${conversationId}`);
      return newMessage;
    } catch (error) {
      console.error('Error adding message:', error);
      throw new Error('Failed to add message');
    }
  }

  /**
   * Start a new conversation with first message
   */
  static async startConversation(
    userId: string,
    firstMessage: string,
    title?: string
  ): Promise<{ conversation: Conversation; message: Message }> {
    try {
      // Generate title from first message if not provided
      const conversationTitle = title || this.generateConversationTitle(firstMessage);
      
      // Create conversation
      const conversation = await this.createConversation(userId, conversationTitle);
      
      // Add first message
      const message = await this.addMessage(
        conversation.id,
        'user',
        firstMessage
      );

      return { conversation, message };
    } catch (error) {
      console.error('Error starting conversation:', error);
      throw new Error('Failed to start conversation');
    }
  }

  /**
   * Get user's conversations with pagination
   */
  static async getUserConversations(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<Array<Conversation & { 
    messageCount: number; 
    lastMessage?: Message;
    lastMessageAt: Date;
  }>> {
    try {
      const userConversations = await db.query.conversations.findMany({
        where: eq(conversations.userId, userId),
        with: {
          messages: {
            orderBy: desc(messages.createdAt),
            limit: 1, // Just get the latest message
          }
        },
        orderBy: desc(conversations.updatedAt),
        limit,
        offset,
      });

      // Get message counts for each conversation
      const conversationsWithCounts = await Promise.all(
        userConversations.map(async (conv) => {
          const [countResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(messages)
            .where(eq(messages.conversationId, conv.id));

          return {
            ...conv,
            messageCount: countResult.count,
            lastMessage: conv.messages[0] || undefined,
            lastMessageAt: conv.messages[0]?.createdAt || conv.updatedAt,
          };
        })
      );

      return conversationsWithCounts;
    } catch (error) {
      console.error('Error getting user conversations:', error);
      return [];
    }
  }

  /**
   * Get a specific conversation with all messages
   */
  static async getConversationWithMessages(
    conversationId: string,
    userId?: string
  ): Promise<(Conversation & { messages: Message[] }) | null> {
    try {
      const conversation = await db.query.conversations.findFirst({
        where: userId 
          ? and(eq(conversations.id, conversationId), eq(conversations.userId, userId))
          : eq(conversations.id, conversationId),
        with: {
          messages: {
            orderBy: asc(messages.createdAt),
          }
        }
      });

      return conversation || null;
    } catch (error) {
      console.error('Error getting conversation with messages:', error);
      return null;
    }
  }

  /**
   * Update conversation title
   */
  static async updateConversationTitle(
    conversationId: string,
    title: string,
    userId?: string
  ): Promise<Conversation | null> {
    try {
      const [updatedConversation] = await db
        .update(conversations)
        .set({
          title,
          updatedAt: new Date(),
        })
        .where(
          userId 
            ? and(eq(conversations.id, conversationId), eq(conversations.userId, userId))
            : eq(conversations.id, conversationId)
        )
        .returning();

      return updatedConversation || null;
    } catch (error) {
      console.error('Error updating conversation title:', error);
      return null;
    }
  }

  /**
   * Update conversation summary
   */
  static async updateConversationSummary(
    conversationId: string,
    summary: string,
    userId?: string
  ): Promise<Conversation | null> {
    try {
      const [updatedConversation] = await db
        .update(conversations)
        .set({
          summary,
          updatedAt: new Date(),
        })
        .where(
          userId 
            ? and(eq(conversations.id, conversationId), eq(conversations.userId, userId))
            : eq(conversations.id, conversationId)
        )
        .returning();

      return updatedConversation || null;
    } catch (error) {
      console.error('Error updating conversation summary:', error);
      return null;
    }
  }

  /**
   * Delete a conversation and all its messages
   */
  static async deleteConversation(
    conversationId: string,
    userId?: string
  ): Promise<boolean> {
    try {
      // Delete messages first (foreign key constraint)
      await db
        .delete(messages)
        .where(eq(messages.conversationId, conversationId));

      // Delete conversation
      const deletedRows = await db
        .delete(conversations)
        .where(
          userId 
            ? and(eq(conversations.id, conversationId), eq(conversations.userId, userId))
            : eq(conversations.id, conversationId)
        );

      console.log(`✅ Deleted conversation: ${conversationId}`);
      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }
  }

  /**
   * Search conversations by title or content
   */
  static async searchConversations(
    userId: string,
    searchTerm: string,
    limit: number = 10
  ): Promise<Array<Conversation & { matchType: 'title' | 'content' }>> {
    try {
      // Search by title
      const titleMatches = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.userId, userId),
            like(conversations.title, `%${searchTerm}%`)
          )
        )
        .orderBy(desc(conversations.updatedAt))
        .limit(limit);

      // Search by message content
      const contentMatches = await db
        .selectDistinct({
          id: conversations.id,
          userId: conversations.userId,
          title: conversations.title,
          summary: conversations.summary,
          createdAt: conversations.createdAt,
          updatedAt: conversations.updatedAt,
        })
        .from(conversations)
        .innerJoin(messages, eq(messages.conversationId, conversations.id))
        .where(
          and(
            eq(conversations.userId, userId),
            like(messages.content, `%${searchTerm}%`)
          )
        )
        .orderBy(desc(conversations.updatedAt))
        .limit(limit);

      // Combine and deduplicate results
      const titleResults = titleMatches.map(conv => ({ ...conv, matchType: 'title' as const }));
      const contentResults = contentMatches
        .filter(conv => !titleMatches.some(title => title.id === conv.id))
        .map(conv => ({ ...conv, matchType: 'content' as const }));

      return [...titleResults, ...contentResults].slice(0, limit);
    } catch (error) {
      console.error('Error searching conversations:', error);
      return [];
    }
  }

  /**
   * Get conversation statistics for a user
   */
  static async getConversationStats(userId: string): Promise<{
    totalConversations: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
    mostActiveDay: string;
    agentInteractions: Record<string, number>;
  }> {
    try {
      // Get total conversations
      const [conversationCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(conversations)
        .where(eq(conversations.userId, userId));

      // Get total messages and agent interactions
      const messageStats = await db
        .select({
          count: sql<number>`count(*)`,
          agentType: messages.agentType,
        })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(eq(conversations.userId, userId))
        .groupBy(messages.agentType);

      const totalMessages = messageStats.reduce((sum, stat) => sum + stat.count, 0);
      const agentInteractions = messageStats.reduce((acc, stat) => {
        if (stat.agentType) {
          acc[stat.agentType] = stat.count;
        }
        return acc;
      }, {} as Record<string, number>);

      const averageMessagesPerConversation = conversationCount.count > 0 
        ? totalMessages / conversationCount.count 
        : 0;

      return {
        totalConversations: conversationCount.count,
        totalMessages,
        averageMessagesPerConversation: Math.round(averageMessagesPerConversation * 100) / 100,
        mostActiveDay: 'Monday', // TODO: Implement actual calculation
        agentInteractions,
      };
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      return {
        totalConversations: 0,
        totalMessages: 0,
        averageMessagesPerConversation: 0,
        mostActiveDay: 'N/A',
        agentInteractions: {},
      };
    }
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Update conversation timestamp
   */
  private static async updateConversationTimestamp(conversationId: string): Promise<void> {
    try {
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
    } catch (error) {
      console.error('Error updating conversation timestamp:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Generate conversation title from first message
   */
  private static generateConversationTitle(firstMessage: string): string {
    // Clean and truncate the message
    const cleaned = firstMessage.trim().replace(/\s+/g, ' ');
    const maxLength = 50;
    
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    
    // Try to truncate at word boundary
    const truncated = cleaned.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > maxLength * 0.5) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }
    
    return truncated + '...';
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Format conversation for display
 */
export function formatConversationForDisplay(
  conversation: Conversation & { messageCount?: number; lastMessage?: Message }
) {
  return {
    id: conversation.id,
    title: conversation.title,
    summary: conversation.summary,
    messageCount: conversation.messageCount || 0,
    lastMessage: conversation.lastMessage?.content?.substring(0, 100) + '...',
    lastMessageAt: conversation.lastMessage?.createdAt || conversation.updatedAt,
    createdAt: conversation.createdAt,
  };
}

/**
 * Check if user owns conversation
 */
export async function userOwnsConversation(
  conversationId: string, 
  userId: string
): Promise<boolean> {
  try {
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    });
    
    return !!conversation;
  } catch (error) {
    console.error('Error checking conversation ownership:', error);
    return false;
  }
}

/**
 * Get recent conversations for quick access
 */
export async function getRecentConversations(
  userId: string, 
  limit: number = 5
): Promise<Conversation[]> {
  try {
    return await db.query.conversations.findMany({
      where: eq(conversations.userId, userId),
      orderBy: desc(conversations.updatedAt),
      limit,
    });
  } catch (error) {
    console.error('Error getting recent conversations:', error);
    return [];
  }
}