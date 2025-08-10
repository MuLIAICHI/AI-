// src/hooks/use-chat.ts
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

// 🎯 NEW: Input type enumeration for better type safety
type MessageInputType = 'text' | 'voice';

// 🎯 NEW: Voice interaction metadata
interface VoiceMetadata {
  inputType?: MessageInputType;           // How the message was created
  shouldAutoPlay?: boolean;               // Override auto-play decision
  voiceProcessed?: boolean;               // Track if voice processing is complete
  voiceError?: string;                    // Any voice-related errors
}

// 🎯 NEW: Enhanced message interface with user context
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: Date;
  agentName?: string;
  metadata?: {
    tokenUsage?: number;
    responseTime?: number;
    confidence?: number;
    isStreaming?: boolean;
    userContext?: UserContext;
    
    // 🎯 NEW: Voice-specific metadata
    inputType?: MessageInputType;         // 'text' | 'voice' - How message was created
    shouldAutoPlay?: boolean;             // Override auto-play behavior
    voiceProcessed?: boolean;             // Track voice processing state
    voiceError?: string;                  // Voice-related errors
    
    // 🎯 NEW: Additional context for decision making
    conversationMode?: 'text' | 'voice' | 'mixed';  // Current conversation context
    userTriggeredVoice?: boolean;         // User explicitly requested voice
  };
}

// 🎯 NEW: User context interface
interface UserContext {
  needsOnboarding: boolean;
  onboardingCompleted: boolean;
  isFirstTimeUser: boolean;
  userName?: string;
}

// 🎯 NEW: Enhanced chat options
interface ChatOptions {
  agentId?: 'router' | 'digital-mentor' | 'finance-guide' | 'health-coach';
  stream?: boolean;
  conversationId?: string;
  inputType?: string;
}

// 🎯 NEW: Enhanced API response interface
interface ChatAPIResponse {
  success: boolean;
  response: string;
  agentName: string;
  agentType: string;
  conversationId: string;
  messageId: string;
  userContext?: UserContext; // 🎯 NEW: User context from API
  error?: string;
}

// Chat conversation interface
interface ChatConversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt?: Date;
  messageCount?: number;
  latestMessage?: string;
  lastMessageAt: Date;
  lastMessageRole?: 'user' | 'assistant';
}

// 🎯 NEW: Onboarding event interface
interface OnboardingEvent {
  type: 'started' | 'step_completed' | 'completed';
  step?: string;
  progress?: number;
  userName?: string;
}

/**
 * Enhanced chat hook with comprehensive onboarding support
 * Manages chat state, user context, and onboarding flow
 */
export function useChat() {
  // Core chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Conversation management
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatConversation[]>([]);
  
  // 🎯 NEW: User context and onboarding state
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [onboardingEvents, setOnboardingEvents] = useState<OnboardingEvent[]>([]);
  const [lastOnboardingUpdate, setLastOnboardingUpdate] = useState<Date | null>(null);
  
  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user } = useUser();

  // 🎯 NEW: Initialize user context on mount
  useEffect(() => {
    if (user && !userContext) {
      initializeUserContext();
    }
  }, [user]);

  /**
   * 🎯 NEW: Initialize user context from API
   */
  const initializeUserContext = useCallback(async () => {
    if (!user) return;

    try {
      // This would typically be a separate API call to get user context
      // For now, we'll initialize with basic data and let the first message update it
      setUserContext({
        needsOnboarding: true, // Will be updated on first API call
        onboardingCompleted: false,
        isFirstTimeUser: true,
        userName: user.firstName || undefined,
      });
    } catch (error) {
      console.error('Error initializing user context:', error);
    }
  }, [user]);

  /**
   * 🎯 NEW: Handle onboarding completion
   */
  const handleOnboardingCompletion = useCallback((userName?: string) => {
    const completionEvent: OnboardingEvent = {
      type: 'completed',
      progress: 100,
      userName,
    };
    
    setOnboardingEvents(prev => [...prev, completionEvent]);
    setUserContext(prev => prev ? {
      ...prev,
      needsOnboarding: false,
      onboardingCompleted: true,
      userName: userName || prev.userName,
    } : null);
    
    setLastOnboardingUpdate(new Date());
    
    console.log('🎉 Onboarding completed!', completionEvent);
  }, []);

  /**
   * 🎯 NEW: Handle onboarding step completion
   */
  const handleOnboardingStep = useCallback((step: string, progress: number) => {
    const stepEvent: OnboardingEvent = {
      type: 'step_completed',
      step,
      progress,
    };
    
    setOnboardingEvents(prev => [...prev, stepEvent]);
    setLastOnboardingUpdate(new Date());
    
    console.log('📍 Onboarding step completed:', stepEvent);
  }, []);

  /**
   * Enhanced send message function with user context support
   */
  const sendMessage = useCallback(async (
    content: string, 
    options: ChatOptions = {}
  ): Promise<ChatAPIResponse | null> => {
    if (!content.trim()) return null;

    setIsLoading(true);
    setError(null);
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();

    try {
      // 🎯 NEW: Create user message with enhanced metadata
      const userMessage: Message = {
        id: Date.now().toString(),
        content: content.trim(),
        role: 'user',
        createdAt: new Date(),
        metadata: {
          userContext: userContext ?? undefined, // Include current user context
        },
      };

      // Add user message to state immediately
      setMessages(prev => [...prev, userMessage]);

      // 🎯 ENHANCED: Prepare API request with user context
      const requestBody = {
        message: content.trim(),
        conversationId: options.conversationId || currentChatId,
        agentId: options.agentId,
        stream: options.stream ?? true,
      };

      console.log('🚀 Sending enhanced message:', {
        content: content.substring(0, 50) + '...',
        agentId: options.agentId,
        hasUserContext: !!userContext,
        needsOnboarding: userContext?.needsOnboarding,
      });

      // Make API request
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ChatAPIResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get response');
      }

      // 🎯 NEW: Handle user context updates from API response
      if (data.userContext) {
        console.log('📊 Updating user context from API:', data.userContext);
        
        // Check for onboarding completion
        if (userContext?.needsOnboarding && data.userContext.onboardingCompleted) {
          handleOnboardingCompletion(data.userContext.userName);
        }
        
        // Update user context state
        setUserContext(data.userContext);
      }

      // Create assistant message with enhanced metadata
      const assistantMessage: Message = {
        id: data.messageId || Date.now().toString(),
        content: data.response,
        role: 'assistant',
        createdAt: new Date(),
        agentName: data.agentName,
        metadata: {
          userContext: data.userContext, // 🎯 NEW: Include user context in message
          responseTime: Date.now() - userMessage.createdAt.getTime(),
        },
      };

      // Add assistant message to state
      setMessages(prev => [...prev, assistantMessage]);

      // Update current chat ID if we got a new conversation
      if (data.conversationId && data.conversationId !== currentChatId) {
        setCurrentChatId(data.conversationId);
      }

      console.log('✅ Enhanced message sent successfully:', {
        agentName: data.agentName,
        userContextUpdated: !!data.userContext,
        onboardingCompleted: data.userContext?.onboardingCompleted,
      });

      return data;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      console.error('❌ Send message error:', errorMessage);
      setError(errorMessage);

      // Remove the user message that failed to send
      setMessages(prev => prev.slice(0, -1));

      return null;
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [currentChatId, userContext, handleOnboardingCompletion]);

  /**
   * Start streaming (for future streaming implementation)
   */
  const startStreaming = useCallback(() => {
    setIsStreaming(true);
  }, []);

  /**
   * Stop streaming
   */
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Retry last message
   */
  const retryLastMessage = useCallback(async () => {
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    if (lastUserMessage) {
      // Remove the last two messages (user and failed assistant message)
      setMessages(prev => prev.slice(0, -2));
      
      // Resend the last user message
      await sendMessage(lastUserMessage.content, {
        agentId: lastUserMessage.metadata?.userContext ? 'router' : undefined,
      });
    }
  }, [messages, sendMessage]);

  /**
   * 🎯 NEW: Start new chat with onboarding awareness
   */
  const startNewChat = useCallback(() => {
    setMessages([]);
    setCurrentChatId(null);
    setError(null);
    
    // 🎯 NEW: Reset user context if needed for new onboarding flow
    if (userContext?.needsOnboarding) {
      console.log('🎯 Starting new chat for user needing onboarding');
    }
    
    console.log('🆕 Started new chat');
  }, [userContext]);

  /**
   * Load chat conversations
   */
  const loadChats = useCallback(async () => {
    try {
      const response = await fetch('/api/chats');
      if (response.ok) {
        const data = await response.json();
        setChats(data.conversations || []);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  }, []);

  /**
   * 🎯 NEW: Get onboarding progress
   */
  const getOnboardingProgress = useCallback(() => {
    if (!userContext) return { progress: 0, currentStep: 'unknown' };
    
    if (userContext.onboardingCompleted) {
      return { progress: 100, currentStep: 'completed' };
    }
    
    // Calculate progress based on onboarding events
    const completedSteps = onboardingEvents.filter(e => e.type === 'step_completed').length;
    const totalSteps = 5; // Welcome, Language, Profile, Subject, Complete
    
    return {
      progress: Math.min((completedSteps / totalSteps) * 100, 90), // Cap at 90% until completion
      currentStep: onboardingEvents.length > 0 ? onboardingEvents[onboardingEvents.length - 1].step || 'in_progress' : 'starting',
    };
  }, [userContext, onboardingEvents]);

  /**
   * 🎯 NEW: Check if user needs onboarding
   */
  const needsOnboarding = useCallback(() => {
    return userContext?.needsOnboarding ?? true;
  }, [userContext]);

  /**
   * 🎯 NEW: Get user learning preferences
   */
  const getUserPreferences = useCallback(() => {
    return {
      userName: userContext?.userName,
      isFirstTimeUser: userContext?.isFirstTimeUser,
      onboardingCompleted: userContext?.onboardingCompleted,
      needsOnboarding: userContext?.needsOnboarding,
    };
  }, [userContext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 🎯 ENHANCED: Return enhanced hook interface
  return {
    // Core chat functionality
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    startStreaming,
    stopStreaming,
    clearError,
    retryLastMessage,
    
    // Conversation management
    currentChatId,
    chats,
    startNewChat,
    loadChats,
    
    // 🎯 NEW: User context and onboarding
    userContext,
    onboardingEvents,
    lastOnboardingUpdate,
    getOnboardingProgress,
    needsOnboarding,
    getUserPreferences,
    handleOnboardingCompletion,
    handleOnboardingStep,
    
    // 🎯 NEW: Onboarding utilities
    isOnboardingComplete: userContext?.onboardingCompleted ?? false,
    isFirstTimeUser: userContext?.isFirstTimeUser ?? true,
    userName: userContext?.userName,
  };
}

// 🎯 NEW: Helper functions for voice metadata handling
// 🎯 NEW: Helper functions for voice metadata handling
export function hasVoiceMetadata(message: Message): message is Message & {
  metadata: NonNullable<Message['metadata']> & {
    inputType: MessageInputType;
  };
} {
  return !!(message?.metadata?.inputType);
}

export function shouldMessageAutoPlay(message: Message | undefined): boolean {
  // 🔧 FIX: Add null check
  if (!message) {
    return false;
  }
  
  // Explicit override takes precedence
  if (message.metadata?.shouldAutoPlay !== undefined) {
    return message.metadata.shouldAutoPlay;
  }
  
  // Only assistant messages can auto-play
  if (message.role !== 'assistant') {
    return false;
  }
  
  // If no input type specified, default to no auto-play for safety
  if (!message.metadata?.inputType) {
    return false;
  }
  
  // Auto-play only if the conversation was initiated via voice
  return message.metadata.inputType === 'voice';
}

export function getMessageInputType(message: Message | undefined): MessageInputType {
  // 🔧 FIX: Add null check
  if (!message) {
    return 'text';
  }
  return message.metadata?.inputType || 'text'; // Default to text for backward compatibility
}

// 🎯 NEW: Export enhanced types for use in components
export type {
  Message,
  MessageInputType,
  VoiceMetadata,
  UserContext,
  ChatOptions,
  ChatAPIResponse,
  ChatConversation,
  OnboardingEvent,
};