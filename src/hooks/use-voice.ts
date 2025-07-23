// src/hooks/use-voice.ts
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useVoicePreferences } from './use-voice-preferences';
import VoiceManager, { 
  type VoiceManagerConfig, 
  type VoicePlaybackState, 
  type SpeakOptions 
} from '@/lib/voice/voice-manager';
import {
  VoiceState,
  VoiceError,
  VoiceSessionStats,
  DEFAULT_VOICE_CONFIG,
} from '@/lib/voice/voice-types';

// ==========================================
// TYPES & INTERFACES
// ==========================================

/**
 * Voice playback options for speak function
 */
export interface VoiceSpeakOptions {
  text: string;
  voiceId?: string;
  speed?: number;
  interrupt?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error: VoiceError) => void;
}

/**
 * Voice session options
 */
export interface VoiceSessionOptions {
  conversationId?: string;
  autoStart?: boolean;
}

/**
 * Voice control settings
 */
export interface VoiceControlSettings {
  volume?: number;
  speed?: number;
  autoplay?: boolean;
}

/**
 * Hook return interface following your existing patterns
 */
interface UseVoiceReturn {
  // State - Voice Status
  voiceState: VoiceState;
  playbackState: VoicePlaybackState;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  isEnabled: boolean;
  error: string | null;
  
  // State - Current Playback
  currentText: string | undefined;
  duration: number;
  currentTime: number;
  volume: number;
  speed: number;
  
  // State - Session
  sessionActive: boolean;
  sessionStats: VoiceSessionStats | null;
  
  // Actions - Playback Control
  speak: (options: VoiceSpeakOptions | string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  
  // Actions - Settings
  setVolume: (volume: number) => void;
  setSpeed: (speed: number) => void;
  updateSettings: (settings: VoiceControlSettings) => void;
  
  // Actions - Session Management
  startSession: (options?: VoiceSessionOptions) => Promise<void>;
  endSession: () => Promise<void>;
  
  // Utilities
  clearError: () => void;
  canSpeak: boolean;
  
  // Computed values
  playbackProgress: number; // 0-1
  remainingTime: number;
  isReady: boolean;
}

/**
 * Custom hook for voice synthesis and playback
 * Wraps VoiceManager class with React state management
 * Follows the same patterns as useChat, usePreferences, etc.
 */
export function useVoice(): UseVoiceReturn {
  const { user, isLoaded } = useUser();
  const { preferences, isVoiceEnabled } = useVoicePreferences();
  
  // State - following your patterns
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [playbackState, setPlaybackState] = useState<VoicePlaybackState>({
    isPlaying: false,
    isPaused: false,
    isLoading: false,
    duration: 0,
    currentTime: 0,
    volume: 1.0,
    speed: 1.0,
  });
  const [error, setError] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionStats, setSessionStats] = useState<VoiceSessionStats | null>(null);
  
  // Refs for VoiceManager instance and cleanup
  const voiceManagerRef = useRef<VoiceManager | null>(null);
  const currentConversationId = useRef<string | null>(null);

  /**
   * Clear any existing errors - following your pattern
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Initialize VoiceManager instance
   */
  const initializeVoiceManager = useCallback(() => {
    if (!user || !isLoaded || !preferences) {
      console.log('🔄 User/preferences not ready, skipping voice manager initialization');
      return null;
    }

    // Don't recreate if already exists with same config
    if (voiceManagerRef.current) {
      // Update config if preferences changed
      const currentConfig = voiceManagerRef.current.getConfig();
      const hasConfigChanged = 
        currentConfig.voiceId !== preferences.preferredVoice ||
        currentConfig.speed !== preferences.voiceSpeed ||
        currentConfig.provider !== preferences.voiceProvider;
        
      if (hasConfigChanged) {
        console.log('⚙️ Updating voice manager config');
        voiceManagerRef.current.updateConfig({
          voiceId: preferences.preferredVoice,
          speed: preferences.voiceSpeed,
          provider: preferences.voiceProvider,
          quality: preferences.voiceQuality,
          latencyMode: preferences.voiceLatencyMode,
        });
      }
      
      return voiceManagerRef.current;
    }

    try {
      console.log('🎤 Initializing VoiceManager with user preferences');
      
      const config: VoiceManagerConfig = {
        userId: user.id,
        voiceConfig: {
          enabled: preferences.voiceEnabled,
          provider: preferences.voiceProvider,
          voiceId: preferences.preferredVoice,
          language: preferences.voiceLanguage,
          speed: preferences.voiceSpeed,
          quality: preferences.voiceQuality,
          latencyMode: preferences.voiceLatencyMode,
          autoplay: preferences.voiceAutoplay,
          inputEnabled: preferences.voiceInputEnabled,
          outputEnabled: preferences.voiceOutputEnabled,
          interruptionsEnabled: preferences.voiceInterruptionsEnabled,
          visualizationEnabled: preferences.voiceVisualizationEnabled,
          inputMode: 'push_to_talk', // Default for now
          microphoneSensitivity: 0.6,
          noiseSuppression: true,
        },
        onStateChange: (state: VoiceState) => {
          setVoiceState(state);
          if (state === 'error') {
            console.log('🚨 Voice state changed to error');
          }
        },
        onPlaybackChange: (playback: VoicePlaybackState) => {
          setPlaybackState(playback);
        },
        onError: (voiceError: VoiceError) => {
          console.error('🚨 Voice error:', voiceError);
          setError(voiceError.message);
          setVoiceState('error');
        },
        onSessionUpdate: (stats: Partial<VoiceSessionStats>) => {
          setSessionStats(prev => prev ? { ...prev, ...stats } : null);
        },
      };

      const manager = new VoiceManager(config);
      voiceManagerRef.current = manager;
      
      console.log('✅ VoiceManager initialized successfully');
      return manager;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize voice manager';
      console.error('❌ Failed to initialize VoiceManager:', errorMessage);
      setError(errorMessage);
      return null;
    }
  }, [user, isLoaded, preferences]);

  /**
   * Speak text with voice synthesis
   */
  const speak = useCallback(async (options: VoiceSpeakOptions | string) => {
    const manager = voiceManagerRef.current || initializeVoiceManager();
    if (!manager) {
      setError('Voice manager not available');
      return;
    }

    if (!isVoiceEnabled) {
      console.log('🔇 Voice disabled, skipping synthesis');
      return;
    }

    try {
      clearError();
      
      // Handle string shorthand
      const speakOptions: SpeakOptions = typeof options === 'string' 
        ? { text: options }
        : {
            text: options.text,
            voiceId: options.voiceId,
            speed: options.speed,
            interrupt: options.interrupt ?? true, // Default to interrupt
            onStart: options.onStart,
            onComplete: options.onComplete,
            onError: options.onError,
          };

      console.log('🎤 Speaking text:', speakOptions.text.substring(0, 50) + '...');
      await manager.speak(speakOptions);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to speak text';
      console.error('❌ Speak failed:', errorMessage);
      setError(errorMessage);
    }
  }, [initializeVoiceManager, isVoiceEnabled, clearError]);

  /**
   * Pause current playback
   */
  const pause = useCallback(async () => {
    const manager = voiceManagerRef.current;
    if (!manager) return;

    try {
      await manager.pause();
      console.log('⏸️ Playback paused');
    } catch (error) {
      console.error('❌ Pause failed:', error);
    }
  }, []);

  /**
   * Resume paused playback
   */
  const resume = useCallback(async () => {
    const manager = voiceManagerRef.current;
    if (!manager) return;

    try {
      await manager.resume();
      console.log('▶️ Playback resumed');
    } catch (error) {
      console.error('❌ Resume failed:', error);
    }
  }, []);

  /**
   * Stop current playback
   */
  const stop = useCallback(async () => {
    const manager = voiceManagerRef.current;
    if (!manager) return;

    try {
      await manager.stop();
      console.log('⏹️ Playback stopped');
    } catch (error) {
      console.error('❌ Stop failed:', error);
    }
  }, []);

  /**
   * Set playback volume
   */
  const setVolume = useCallback((volume: number) => {
    const manager = voiceManagerRef.current;
    if (!manager) return;

    manager.setVolume(volume);
  }, []);

  /**
   * Set playback speed
   */
  const setSpeed = useCallback((speed: number) => {
    const manager = voiceManagerRef.current;
    if (!manager) return;

    manager.setSpeed(speed);
  }, []);

  /**
   * Update multiple voice settings at once
   */
  const updateSettings = useCallback((settings: VoiceControlSettings) => {
    const manager = voiceManagerRef.current;
    if (!manager) return;

    if (settings.volume !== undefined) {
      manager.setVolume(settings.volume);
    }
    
    if (settings.speed !== undefined) {
      manager.setSpeed(settings.speed);
    }

    // Note: autoplay is handled by preferences, not real-time control
    console.log('⚙️ Voice settings updated:', settings);
  }, []);

  /**
   * Start a voice session for analytics
   */
  const startSession = useCallback(async (options?: VoiceSessionOptions) => {
    const manager = voiceManagerRef.current || initializeVoiceManager();
    if (!manager) {
      console.warn('⚠️ Cannot start session: Voice manager not available');
      return;
    }

    try {
      currentConversationId.current = options?.conversationId || null;
      await manager.startSession(options?.conversationId);
      setSessionActive(true);
      setSessionStats({
        totalDuration: 0,
        messagesCount: 0,
        userSpeechDuration: 0,
        agentSpeechDuration: 0,
        interruptionsCount: 0,
        averageLatency: 0,
        errorCount: 0,
        successRate: 0,
      });
      console.log('🎯 Voice session started');
    } catch (error) {
      console.error('❌ Failed to start voice session:', error);
    }
  }, [initializeVoiceManager]);

  /**
   * End current voice session
   */
  const endSession = useCallback(async () => {
    const manager = voiceManagerRef.current;
    if (!manager) return;

    try {
      await manager.endSession();
      setSessionActive(false);
      setSessionStats(null);
      currentConversationId.current = null;
      console.log('✅ Voice session ended');
    } catch (error) {
      console.error('❌ Failed to end voice session:', error);
    }
  }, []);

  // Initialize VoiceManager when dependencies are ready - following your pattern
  useEffect(() => {
    if (user && isLoaded && preferences && !voiceManagerRef.current) {
      console.log('🚀 Initializing voice hook');
      initializeVoiceManager();
    }
  }, [user, isLoaded, preferences, initializeVoiceManager]);

  // Cleanup on unmount - following your pattern
  useEffect(() => {
    return () => {
      if (voiceManagerRef.current) {
        console.log('🧹 Cleaning up VoiceManager');
        voiceManagerRef.current.dispose();
        voiceManagerRef.current = null;
      }
    };
  }, []);

  // Auto-start session if preferences indicate autoplay - following your patterns
  useEffect(() => {
    if (preferences?.voiceAutoplay && !sessionActive && voiceManagerRef.current) {
      startSession();
    }
  }, [preferences?.voiceAutoplay, sessionActive, startSession]);

  // Computed values - following your pattern
  const isPlaying = playbackState.isPlaying;
  const isPaused = playbackState.isPaused;
  const isLoading = playbackState.isLoading || voiceState === 'processing';
  const isEnabled = preferences?.voiceEnabled || false;
  const currentText = playbackState.currentText;
  const duration = playbackState.duration;
  const currentTime = playbackState.currentTime;
  const volume = playbackState.volume;
  const speed = playbackState.speed;
  
  const canSpeak = Boolean(
    user && 
    isLoaded && 
    preferences?.voiceEnabled && 
    voiceManagerRef.current && 
    voiceState !== 'error'
  );
  
  const playbackProgress = duration > 0 ? currentTime / duration : 0;
  const remainingTime = Math.max(0, duration - currentTime);
  const isReady = Boolean(voiceManagerRef.current && voiceState !== 'error');

  // Return comprehensive hook interface - following your pattern
  return {
    // State - Voice Status
    voiceState,
    playbackState,
    isPlaying,
    isPaused,
    isLoading,
    isEnabled,
    error,
    
    // State - Current Playback
    currentText,
    duration,
    currentTime,
    volume,
    speed,
    
    // State - Session
    sessionActive,
    sessionStats,
    
    // Actions - Playback Control
    speak,
    pause,
    resume,
    stop,
    
    // Actions - Settings
    setVolume,
    setSpeed,
    updateSettings,
    
    // Actions - Session Management
    startSession,
    endSession,
    
    // Utilities
    clearError,
    canSpeak,
    
    // Computed values
    playbackProgress,
    remainingTime,
    isReady,
  };
}

// Export types for use in components - following your pattern
export type {
  UseVoiceReturn,
};