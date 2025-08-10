// src/hooks/use-realtime-session.ts
// Session management hook for real-time voice conversations

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMastraVoice } from './use-mastra-voice';
import { useVoicePreferences } from './use-voice-preferences';
import { useChat } from './use-chat';
import { 
  globalVoiceEvents, 
  emitVoiceEvent,
  createConnectionEvent,
  createErrorEvent 
} from '@/lib/mastra/voice-events';

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface RealtimeSessionConfig {
  agentId?: string;
  instructions?: string;
  autoStart?: boolean;
  enableFallback?: boolean;
  maxDuration?: number; // in seconds
  conversationId?: string;
}

export interface RealtimeSessionState {
  isActive: boolean;
  sessionId: string | null;
  duration: number; // in seconds
  messageCount: number;
  lastActivity: Date | null;
  
  // Voice activity
  userSpeechTime: number;
  aiSpeechTime: number;
  totalInterruptions: number;
  
  // Connection quality
  connectionQuality: 'poor' | 'fair' | 'good' | 'excellent';
  averageLatency: number;
  
  // Error tracking
  errorCount: number;
  lastError: string | null;
}

export interface UseRealtimeSessionReturn {
  // State
  sessionState: RealtimeSessionState;
  isRealtimeEnabled: boolean;
  isSessionActive: boolean;
  canStartSession: boolean;
  
  // Actions
  startRealtimeSession: (config?: RealtimeSessionConfig) => Promise<void>;
  endRealtimeSession: () => Promise<void>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  
  // Integration with existing chat
  sendVoiceMessage: (text: string) => Promise<void>;
  handleUserSpeech: (transcript: string) => void;
  handleAISpeech: (text: string) => Promise<void>;
  
  // Utilities
  getSessionMetrics: () => RealtimeSessionState;
  resetSession: () => void;
  
  // Events
  onSessionStart: (handler: () => void) => () => void;
  onSessionEnd: (handler: () => void) => () => void;
  onTranscript: (handler: (text: string, role: 'user' | 'assistant') => void) => () => void;
}

// ==========================================
// MAIN HOOK
// ==========================================

/**
 * Hook for managing real-time voice sessions integrated with your chat system
 * 
 * This hook bridges the Mastra real-time voice with your existing useChat hook,
 * providing seamless integration between voice and text conversations.
 */
export function useRealtimeSession(): UseRealtimeSessionReturn {
  const { user } = useUser();
  const { preferences, isVoiceEnabled } = useVoicePreferences();
  const { sendMessage, messages } = useChat();
  const {
    state: voiceState,
    isConnected,
    isSessionActive: voiceSessionActive,
    startSession,
    endSession,
    speak,
    startListening,
    stopListening,
    onTranscript,
    onError,
  } = useMastraVoice();

  // Session state
  const [sessionState, setSessionState] = useState<RealtimeSessionState>({
    isActive: false,
    sessionId: null,
    duration: 0,
    messageCount: 0,
    lastActivity: null,
    userSpeechTime: 0,
    aiSpeechTime: 0,
    totalInterruptions: 0,
    connectionQuality: 'good',
    averageLatency: 0,
    errorCount: 0,
    lastError: null,
  });

  // Tracking refs
  const sessionStartTimeRef = useRef<Date | null>(null);
  const lastUserSpeechStartRef = useRef<Date | null>(null);
  const lastAISpeechStartRef = useRef<Date | null>(null);
  const sessionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentConfigRef = useRef<RealtimeSessionConfig | null>(null);

  /**
   * Update session state helper
   */
  const updateSessionState = useCallback((updates: Partial<RealtimeSessionState>) => {
    setSessionState(prev => ({ ...prev, ...updates, lastActivity: new Date() }));
  }, []);

  /**
   * Check if real-time voice is enabled and supported
   */
  const isRealtimeEnabled = Boolean(
    isVoiceEnabled && 
    preferences?.voiceEnabled && 
    voiceState.isSupported && 
    voiceState.isReady
  );

  /**
   * Check if we can start a session
   */
  const canStartSession = Boolean(
    isRealtimeEnabled && 
    !sessionState.isActive && 
    !voiceSessionActive &&
    !!user
  );

  /**
   * Start a real-time voice session
   */
  const startRealtimeSession = useCallback(async (config: RealtimeSessionConfig = {}): Promise<void> => {
    if (!canStartSession) {
      throw new Error('Cannot start real-time session: conditions not met');
    }

    try {
      console.log('🚀 Starting real-time voice session with config:', config);
      
      // Store config
      currentConfigRef.current = config;
      sessionStartTimeRef.current = new Date();

      // Start Mastra voice session
      await startSession({
        conversationId: config.conversationId || `conversation_${Date.now()}`,
        instructions: config.instructions || getDefaultInstructions(config.agentId),
        voiceId: preferences?.preferredVoice,
        autoStart: config.autoStart !== false,
      });

      // Update session state
      updateSessionState({
        isActive: true,
        sessionId: voiceState.sessionId,
        duration: 0,
        errorCount: 0,
        lastError: null,
      });

      // Start session timer
      sessionIntervalRef.current = setInterval(() => {
        if (sessionStartTimeRef.current) {
          const duration = Math.floor((Date.now() - sessionStartTimeRef.current.getTime()) / 1000);
          updateSessionState({ duration });
        }
      }, 1000);

      // Emit session start event
      emitVoiceEvent({
        type: 'session_started',
        timestamp: new Date(),
        sessionId: voiceState.sessionId || '',
      });

      console.log('✅ Real-time voice session started');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start session';
      console.error('❌ Failed to start real-time session:', error);
      
      updateSessionState({ 
        lastError: errorMessage,
        errorCount: sessionState.errorCount + 1 
      });

      throw new Error(`Failed to start real-time session: ${errorMessage}`);
    }
  }, [canStartSession, startSession, preferences, voiceState.sessionId, updateSessionState, sessionState.errorCount]);

  /**
   * End the real-time voice session
   */
  const endRealtimeSession = useCallback(async (): Promise<void> => {
    if (!sessionState.isActive) {
      console.log('🔇 No active real-time session to end');
      return;
    }

    try {
      console.log('🛑 Ending real-time voice session...');

      // Stop session timer
      if (sessionIntervalRef.current) {
        clearInterval(sessionIntervalRef.current);
        sessionIntervalRef.current = null;
      }

      // End Mastra voice session
      await endSession();

      // Calculate final duration
      const finalDuration = sessionStartTimeRef.current 
        ? Math.floor((Date.now() - sessionStartTimeRef.current.getTime()) / 1000)
        : sessionState.duration;

      // Emit session end event
      emitVoiceEvent({
        type: 'session_ended',
        timestamp: new Date(),
        sessionId: sessionState.sessionId || '',
        duration: finalDuration,
      });

      // Reset session state
      setSessionState({
        isActive: false,
        sessionId: null,
        duration: finalDuration,
        messageCount: sessionState.messageCount,
        lastActivity: new Date(),
        userSpeechTime: sessionState.userSpeechTime,
        aiSpeechTime: sessionState.aiSpeechTime,
        totalInterruptions: sessionState.totalInterruptions,
        connectionQuality: sessionState.connectionQuality,
        averageLatency: sessionState.averageLatency,
        errorCount: sessionState.errorCount,
        lastError: sessionState.lastError,
      });

      // Clear refs
      sessionStartTimeRef.current = null;
      currentConfigRef.current = null;

      console.log('✅ Real-time voice session ended');

    } catch (error) {
      console.error('❌ Error ending real-time session:', error);
      updateSessionState({ 
        lastError: error instanceof Error ? error.message : 'Failed to end session',
        errorCount: sessionState.errorCount + 1 
      });
    }
  }, [sessionState, endSession, updateSessionState]);

  /**
   * Pause the session (stop listening but keep connection)
   */
  const pauseSession = useCallback(async (): Promise<void> => {
    if (!sessionState.isActive) return;

    try {
      await stopListening();
      console.log('⏸️ Real-time session paused');
    } catch (error) {
      console.error('❌ Error pausing session:', error);
    }
  }, [sessionState.isActive, stopListening]);

  /**
   * Resume the session (start listening again)
   */
  const resumeSession = useCallback(async (): Promise<void> => {
    if (!sessionState.isActive) return;

    try {
      await startListening();
      console.log('▶️ Real-time session resumed');
    } catch (error) {
      console.error('❌ Error resuming session:', error);
    }
  }, [sessionState.isActive, startListening]);

  /**
   * Send a voice message (speak text via real-time voice)
   */
  const sendVoiceMessage = useCallback(async (text: string): Promise<void> => {
    if (!sessionState.isActive) {
      throw new Error('No active real-time session');
    }

    try {
      // Record AI speech start
      lastAISpeechStartRef.current = new Date();
      
      await speak(text, true); // interrupt any current speech
      
      updateSessionState({ messageCount: sessionState.messageCount + 1 });
      
    } catch (error) {
      console.error('❌ Error sending voice message:', error);
      updateSessionState({ 
        lastError: error instanceof Error ? error.message : 'Failed to send voice message',
        errorCount: sessionState.errorCount + 1 
      });
      throw error;
    }
  }, [sessionState.isActive, sessionState.messageCount, sessionState.errorCount, speak, updateSessionState]);

  /**
   * Handle user speech (received from voice transcription)
   */
  const handleUserSpeech = useCallback((transcript: string) => {
    console.log('🎤 User speech received:', transcript);
    
    // Update speech tracking
    if (lastUserSpeechStartRef.current) {
      const speechDuration = Date.now() - lastUserSpeechStartRef.current.getTime();
      updateSessionState({ 
        userSpeechTime: sessionState.userSpeechTime + speechDuration 
      });
    }

    // Send to chat system as a user message
    sendMessage(transcript);
    
    updateSessionState({ messageCount: sessionState.messageCount + 1 });
    
  }, [sendMessage, sessionState.userSpeechTime, sessionState.messageCount, updateSessionState]);

  /**
   * Handle AI speech (send AI response via voice)
   */
  const handleAISpeech = useCallback(async (text: string): Promise<void> => {
    if (!sessionState.isActive) {
      return; // Fall back to regular text display
    }

    try {
      await sendVoiceMessage(text);
    } catch (error) {
      console.error('❌ Failed to send AI speech, falling back to text:', error);
      // Error is already handled in sendVoiceMessage
    }
  }, [sessionState.isActive, sendVoiceMessage]);

  /**
   * Get current session metrics
   */
  const getSessionMetrics = useCallback((): RealtimeSessionState => {
    return { ...sessionState };
  }, [sessionState]);

  /**
   * Reset session metrics
   */
  const resetSession = useCallback(() => {
    setSessionState(prev => ({
      ...prev,
      duration: 0,
      messageCount: 0,
      userSpeechTime: 0,
      aiSpeechTime: 0,
      totalInterruptions: 0,
      errorCount: 0,
      lastError: null,
    }));
  }, []);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================

  // Track user speech timing
  useEffect(() => {
    const unsubscribe = globalVoiceEvents.on('user_speaking_start', () => {
      lastUserSpeechStartRef.current = new Date();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = globalVoiceEvents.on('user_speaking_end', () => {
      if (lastUserSpeechStartRef.current) {
        const speechDuration = Date.now() - lastUserSpeechStartRef.current.getTime();
        updateSessionState({ 
          userSpeechTime: sessionState.userSpeechTime + speechDuration 
        });
        lastUserSpeechStartRef.current = null;
      }
    });
    return unsubscribe;
  }, [sessionState.userSpeechTime, updateSessionState]);

  // Track AI speech timing
  useEffect(() => {
    const unsubscribe = globalVoiceEvents.on('ai_speaking_start', () => {
      lastAISpeechStartRef.current = new Date();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = globalVoiceEvents.on('ai_speaking_end', () => {
      if (lastAISpeechStartRef.current) {
        const speechDuration = Date.now() - lastAISpeechStartRef.current.getTime();
        updateSessionState({ 
          aiSpeechTime: sessionState.aiSpeechTime + speechDuration 
        });
        lastAISpeechStartRef.current = null;
      }
    });
    return unsubscribe;
  }, [sessionState.aiSpeechTime, updateSessionState]);

  // Handle voice errors
  useEffect(() => {
    const unsubscribe = onError((error) => {
      updateSessionState({ 
        lastError: error.message,
        errorCount: sessionState.errorCount + 1 
      });
    });
    return unsubscribe;
  }, [onError, sessionState.errorCount, updateSessionState]);

  // Handle transcriptions
  useEffect(() => {
    const unsubscribe = onTranscript((text, role) => {
      if (role === 'user') {
        handleUserSpeech(text);
      }
      // AI responses are handled separately through the chat system
    });
    return unsubscribe;
  }, [onTranscript, handleUserSpeech]);

  // Auto-end session on timeout
  useEffect(() => {
    if (sessionState.isActive && currentConfigRef.current?.maxDuration) {
      const timeout = setTimeout(() => {
        console.log('⏰ Session timeout reached, ending session');
        endRealtimeSession();
      }, currentConfigRef.current.maxDuration * 1000);

      return () => clearTimeout(timeout);
    }
  }, [sessionState.isActive, endRealtimeSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionIntervalRef.current) {
        clearInterval(sessionIntervalRef.current);
      }
      if (sessionState.isActive) {
        endRealtimeSession();
      }
    };
  }, [sessionState.isActive, endRealtimeSession]);

  // ==========================================
  // EVENT SUBSCRIPTION HELPERS
  // ==========================================

  const onSessionStart = useCallback((handler: () => void) => {
    return globalVoiceEvents.on('session_started', handler);
  }, []);

  const onSessionEnd = useCallback((handler: () => void) => {
    return globalVoiceEvents.on('session_ended', handler);
  }, []);

  // ==========================================
  // RETURN INTERFACE
  // ==========================================

  return {
    // State
    sessionState,
    isRealtimeEnabled,
    isSessionActive: sessionState.isActive,
    canStartSession,
    
    // Actions
    startRealtimeSession,
    endRealtimeSession,
    pauseSession,
    resumeSession,
    
    // Integration with existing chat
    sendVoiceMessage,
    handleUserSpeech,
    handleAISpeech,
    
    // Utilities
    getSessionMetrics,
    resetSession,
    
    // Events
    onSessionStart,
    onSessionEnd,
    onTranscript,
  };
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get default instructions based on agent ID
 */
function getDefaultInstructions(agentId?: string): string {
  const baseInstructions = "You are a helpful AI assistant engaging in real-time voice conversation. Respond naturally and conversationally.";
  
  switch (agentId) {
    case 'digital-mentor':
      return `${baseInstructions} You are a patient digital learning mentor, focused on helping users learn technology and digital skills.`;
    case 'finance-guide':
      return `${baseInstructions} You are a professional financial advisor, providing clear and responsible financial guidance.`;
    case 'health-coach':
      return `${baseInstructions} You are an encouraging health and wellness coach, promoting healthy lifestyle choices.`;
    default:
      return baseInstructions;
  }
}