// src/hooks/use-chat.ts
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

// CORRECTED: Types matching your actual schema
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: Date;
  agentName?: string;
  agentType?: 'router' | 'digital_mentor' | 'finance_guide' | 'health_coach';
}

// CORRECTED: Chat interface with string UUID IDs
interface Chat {
  id: string; // ✅ FIXED: UUID string (matches your schema)
  title: string;
  createdAt: Date;
  updatedAt?: Date;
  latestMessage?: string;
  lastMessageAt: Date;
  lastMessageRole?: 'user' | 'assistant';
  messageCount?: number;
}

interface ChatOptions {
  agentId?: 'router' | 'digital-mentor' | 'finance-guide' | 'health-coach';
  stream?: boolean;
}

// CORRECTED: Return types with string IDs
interface UseChatReturn {
  // State
  messages: Message[];
  chats: Chat[];
  currentChatId: string | null; // ✅ FIXED: string instead of number
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  
  // Actions - CORRECTED: All use string IDs
  sendMessage: (content: string, options?: ChatOptions) => Promise<void>;
  loadChats: () => Promise<void>;
  loadChat: (chatId: string) => Promise<void>; // ✅ FIXED: string parameter
  startNewChat: () => void;
  deleteChat: (chatId: string) => Promise<void>; // ✅ FIXED: string parameter
  stopStreaming: () => void;
  clearError: () => void;
  
  // Utilities
  retryLastMessage: () => Promise<void>;
  exportChat: (chatId: string) => Promise<string>; // ✅ FIXED: string parameter
}

/**
 * Custom hook for managing chat functionality with Smartlyte AI agents
 * ✅ CORRECTED: Now matches your conversations schema exactly
 */
export function useChat(): UseChatReturn {
  const { user } = useUser();

  // CORRECTED: State with string IDs
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null); // ✅ FIXED: string
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for managing streaming
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastMessageRef = useRef<{ content: string; options?: ChatOptions } | null>(null);

  // Load user's chats on mount
  useEffect(() => {
    if (user) {
      loadChats();
    }
  }, [user]);

  /**
   * Clear any error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * ✅ CORRECTED: Load conversations from correct endpoint
   */
  const loadChats = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      // ✅ FIXED: Correct endpoint
      const response = await fetch('/api/chats?limit=50&includePreview=true', {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to load conversations`);
      }

      const data = await response.json();
      if (data.success) {
        // ✅ FIXED: Expecting 'conversations' not 'chats'
        const transformedChats: Chat[] = (data.conversations || []).map((conv: any) => ({
          id: conv.id, // Already UUID string
          title: conv.title,
          createdAt: new Date(conv.createdAt),
          updatedAt: conv.updatedAt ? new Date(conv.updatedAt) : undefined,
          lastMessageAt: conv.updatedAt ? new Date(conv.updatedAt) : new Date(conv.createdAt),
          latestMessage: conv.lastMessage?.content || undefined,
          lastMessageRole: conv.lastMessage?.role || undefined,
          messageCount: conv.messageCount || 0,
        }));
        
        setChats(transformedChats);
      } else {
        throw new Error(data.message || 'Failed to load conversations');
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setError(error instanceof Error ? error.message : 'Failed to load conversations');
    }
  }, [user]);

  /**
   * ✅ CORRECTED: Load specific conversation with string UUID
   */
  const loadChat = useCallback(async (chatId: string) => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // ✅ FIXED: Use UUID string
      const response = await fetch(`/api/chat/${chatId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Conversation not found');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to load conversation');
      }

      const data = await response.json();
      if (data.success) {
        // Transform messages to match our interface
        const transformedMessages: Message[] = (data.messages || []).map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          role: msg.role,
          createdAt: new Date(msg.timestamp || msg.createdAt),
          agentName: msg.agentName,
          agentType: msg.agentType,
        }));

        setMessages(transformedMessages);
        setCurrentChatId(chatId); // Now string UUID
      } else {
        throw new Error(data.message || 'Failed to load conversation');
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setError(error instanceof Error ? error.message : 'Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Start a new chat session
   */
  const startNewChat = useCallback(() => {
    setMessages([]);
    setCurrentChatId(null);
    setError(null);
  }, []);

  /**
   * ✅ CORRECTED: Delete conversation with string UUID
   */
  const deleteChat = useCallback(async (chatId: string) => {
    if (!user) return;

    try {
      setError(null);
      // ✅ FIXED: Use UUID string
      const response = await fetch(`/api/chat/${chatId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete conversation');
      }

      const data = await response.json();
      if (data.success) {
        // Remove from local state
        setChats(prev => prev.filter(chat => chat.id !== chatId));
        
        // If it was the current chat, start a new one
        if (currentChatId === chatId) {
          startNewChat();
        }
      } else {
        throw new Error(data.message || 'Failed to delete conversation');
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete conversation');
    }
  }, [user, currentChatId, startNewChat]);

  /**
   * Stop current streaming operation
   */
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  /**
   * ✅ CORRECTED: Send message with proper conversation ID handling
   */
  const sendMessage = useCallback(async (
    content: string, 
    options: ChatOptions = {}
  ) => {
    if (!user || !content.trim()) return;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Store for retry functionality
    lastMessageRef.current = { content: content.trim(), options };

    // Add user message immediately to UI
    const userMessage: Message = {
      id: `user_${Date.now()}_${Math.random()}`,
      content: content.trim(),
      role: 'user',
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setError(null);
    setIsStreaming(true);

    try {
      // ✅ FIXED: Use conversationId (string UUID)
      const payload = {
        message: content.trim(),
        conversationId: currentChatId, // Now string UUID
        agentId: options.agentId,
        stream: options.stream !== false,
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to send message');
      }

      // Handle non-streaming response for now
      const data = await response.json();
      if (data.success) {
        const assistantMessage: Message = {
          id: `assistant_${Date.now()}_${Math.random()}`,
          content: data.response,
          role: 'assistant',
          createdAt: new Date(),
          agentName: data.agentName,
          agentType: data.agentType,
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        // ✅ FIXED: Update current conversation ID (now string UUID)
        if (data.conversationId && !currentChatId) {
          setCurrentChatId(data.conversationId);
          // Refresh conversations list
          loadChats();
        }
      } else {
        throw new Error(data.message || 'Failed to get response');
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request aborted by user');
      } else {
        console.error('Chat error:', error);
        setError(error instanceof Error ? error.message : 'An error occurred');
        
        // Add error message to chat
        const errorMessage: Message = {
          id: `error_${Date.now()}`,
          content: 'Sorry, I encountered an error. Please try again.',
          role: 'assistant',
          createdAt: new Date(),
          agentName: 'System',
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [user, currentChatId, loadChats]);

  /**
   * Retry the last message that was sent
   */
  const retryLastMessage = useCallback(async () => {
    if (!lastMessageRef.current) return;
    
    const { content, options } = lastMessageRef.current;
    await sendMessage(content, options);
  }, [sendMessage]);

  /**
   * ✅ CORRECTED: Export conversation with string UUID
   */
  const exportChat = useCallback(async (chatId: string): Promise<string> => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) throw new Error('Conversation not found');

    // If it's the current chat, use current messages
    let chatMessages = messages;
    
    // If it's a different chat, load its messages
    if (chatId !== currentChatId) {
      return `Conversation: ${chat.title}\nExport functionality coming soon...`;
    }

    const exportText = [
      `Conversation: ${chat.title}`,
      `Date: ${chat.createdAt.toLocaleDateString()}`,
      `Messages: ${chatMessages.length}`,
      '',
      ...chatMessages.map(msg => 
        `[${msg.role.toUpperCase()}${msg.agentName ? ` - ${msg.agentName}` : ''}]: ${msg.content}`
      )
    ].join('\n');

    return exportText;
  }, [chats, messages, currentChatId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    messages,
    chats,
    currentChatId,
    isLoading,
    isStreaming,
    error,
    
    // Actions
    sendMessage,
    loadChats,
    loadChat,
    startNewChat,
    deleteChat,
    stopStreaming,
    clearError,
    
    // Utilities
    retryLastMessage,
    exportChat,
  };
}