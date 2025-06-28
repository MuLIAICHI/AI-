// src/hooks/use-chat.ts
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

// Types for our chat system
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: Date;
  agentName?: string;
}

interface Chat {
  id: number;
  title: string;
  createdAt: Date;
  latestMessage?: string;
  lastMessageAt: Date;
  lastMessageRole?: 'user' | 'assistant';
}

interface ChatOptions {
  agentId?: 'router' | 'digital-mentor' | 'finance-guide' | 'health-coach';
  stream?: boolean;
}

interface UseChatReturn {
  // State
  messages: Message[];
  chats: Chat[];
  currentChatId: number | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  
  // Actions
  sendMessage: (content: string, options?: ChatOptions) => Promise<void>;
  loadChats: () => Promise<void>;
  loadChat: (chatId: number) => Promise<void>;
  startNewChat: () => void;
  deleteChat: (chatId: number) => Promise<void>;
  stopStreaming: () => void;
  clearError: () => void;
  
  // Utilities
  retryLastMessage: () => Promise<void>;
  exportChat: (chatId: number) => Promise<string>;
}

/**
 * Custom hook for managing chat functionality with Smartlyte AI agents
 * Handles streaming responses, chat history, and state management
 */
export function useChat(): UseChatReturn {
  const { user } = useUser();

  // Core state
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
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
   * Load user's chat list from API
   */
  const loadChats = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      const response = await fetch('/api/chat?limit=50', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to load chats');
      }

      const data = await response.json();
      if (data.success) {
        setChats(data.chats);
      } else {
        throw new Error(data.message || 'Failed to load chats');
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
      setError(error instanceof Error ? error.message : 'Failed to load chats');
    }
  }, [user]);

  /**
   * Load specific chat and its messages
   */
  const loadChat = useCallback(async (chatId: number) => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/chat/${chatId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Chat not found');
        }
        throw new Error('Failed to load chat');
      }

      const data = await response.json();
      if (data.success) {
        // Transform messages to match our interface
        const transformedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id.toString(),
          content: msg.content,
          role: msg.role,
          createdAt: new Date(msg.createdAt),
          agentName: msg.agentName,
        }));

        setMessages(transformedMessages);
        setCurrentChatId(chatId);
      } else {
        throw new Error(data.message || 'Failed to load chat');
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
      setError(error instanceof Error ? error.message : 'Failed to load chat');
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
   * Delete a chat session
   */
  const deleteChat = useCallback(async (chatId: number) => {
    if (!user) return;

    try {
      setError(null);
      const response = await fetch(`/api/chat?chatId=${chatId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete chat');
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
        throw new Error(data.message || 'Failed to delete chat');
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete chat');
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
   * Send a message to the AI and handle the response
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
      // Prepare request payload
      const payload = {
        message: content.trim(),
        chatId: currentChatId,
        agentId: options.agentId,
        stream: options.stream !== false, // Default to streaming
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
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message');
      }

      if (payload.stream && response.headers.get('content-type')?.includes('text/event-stream')) {
        // Handle streaming response
        await handleStreamingResponse(response, abortController);
      } else {
        // Handle non-streaming response
        const data = await response.json();
        if (data.success) {
          const assistantMessage: Message = {
            id: `assistant_${Date.now()}_${Math.random()}`,
            content: data.response,
            role: 'assistant',
            createdAt: new Date(),
            agentName: data.agentName,
          };

          setMessages(prev => [...prev, assistantMessage]);
          
          // Update current chat ID if it's a new chat
          if (data.chatId && !currentChatId) {
            setCurrentChatId(data.chatId);
            // Refresh chats list to include the new chat
            loadChats();
          }
        } else {
          throw new Error(data.message || 'Failed to get response');
        }
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
   * Handle streaming server-sent events response
   */
  const handleStreamingResponse = async (
    response: Response, 
    abortController: AbortController
  ) => {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response stream available');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let assistantMessage: Message = {
      id: `assistant_${Date.now()}_${Math.random()}`,
      content: '',
      role: 'assistant',
      createdAt: new Date(),
    };

    // Add empty assistant message that we'll update
    setMessages(prev => [...prev, assistantMessage]);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || abortController.signal.aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              setIsStreaming(false);
              // Refresh chats list after completion
              loadChats();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'metadata') {
                // Update chat ID and agent info
                if (parsed.chatId && !currentChatId) {
                  setCurrentChatId(parsed.chatId);
                }
                assistantMessage.agentName = parsed.agentName;
              } else if (parsed.type === 'content' && parsed.content) {
                // Update message content
                assistantMessage = {
                  ...assistantMessage,
                  content: assistantMessage.content + parsed.content,
                  agentName: parsed.agentName || assistantMessage.agentName,
                };

                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === assistantMessage.id ? assistantMessage : msg
                  )
                );
              } else if (parsed.type === 'error') {
                throw new Error(parsed.error || 'Streaming error occurred');
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError);
              // Continue processing other lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  };

  /**
   * Retry the last message that was sent
   */
  const retryLastMessage = useCallback(async () => {
    if (!lastMessageRef.current) return;
    
    const { content, options } = lastMessageRef.current;
    await sendMessage(content, options);
  }, [sendMessage]);

  /**
   * Export chat as text format
   */
  const exportChat = useCallback(async (chatId: number): Promise<string> => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) throw new Error('Chat not found');

    // If it's the current chat, use current messages
    let chatMessages = messages;
    
    // If it's a different chat, load its messages
    if (chatId !== currentChatId) {
      // This would need to call the API to get messages
      // For now, return a placeholder
      return `Chat: ${chat.title}\nExport functionality coming soon...`;
    }

    const exportText = [
      `Chat: ${chat.title}`,
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