// src/lib/voice/voice-manager.ts
// Core voice engine - handles TTS, audio playback, and session management

import {
  VoiceConfig,
  VoiceProvider,
  VoiceQuality,
  VoiceState,
  VoiceError,
  VoiceErrorType,
  AudioMetadata,
  VoiceSessionStats,
  OpenAIVoiceId,
} from './voice-types';

import {
  createOpenAITTSConfig,
  validateVoiceConfig,
} from './voice-config';

import VoicePreferencesService from '@/services/voice-preferences-service';

// ==========================================
// VOICE MANAGER INTERFACES
// ==========================================

/**
 * Voice playback state
 */
export interface VoicePlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  currentText?: string;
  duration: number;
  currentTime: number;
  volume: number;
  speed: number;
}

/**
 * Voice manager configuration
 */
export interface VoiceManagerConfig {
  userId: string;
  voiceConfig: VoiceConfig;
  conversationId?: string;
  onStateChange?: (state: VoiceState) => void;
  onPlaybackChange?: (playback: VoicePlaybackState) => void;
  onError?: (error: VoiceError) => void;
  onSessionUpdate?: (stats: Partial<VoiceSessionStats>) => void;
}

/**
 * TTS request options
 */
export interface SpeakOptions {
  text: string;
  voiceId?: string;
  speed?: number;
  quality?: VoiceQuality;
  interrupt?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error: VoiceError) => void;
}

/**
 * Voice synthesis result
 */
interface VoiceSynthesisResult {
  audioUrl: string;
  metadata: AudioMetadata;
}

// ==========================================
// CORE VOICE MANAGER CLASS
// ==========================================

/**
 * VoiceManager - Core voice engine for Smartlyte AI
 * 
 * Handles:
 * - Text-to-speech synthesis via OpenAI API
 * - Audio playback management
 * - Voice session tracking
 * - Error handling and fallbacks
 * - User preference integration
 */
export class VoiceManager {
  private config: VoiceManagerConfig;
  private currentAudio: HTMLAudioElement | null = null;
  private currentState: VoiceState = 'idle';
  private playbackState: VoicePlaybackState;
  private currentSessionId: string | null = null;
  private sessionStats: VoiceSessionStats;
  private abortController: AbortController | null = null;

  constructor(config: VoiceManagerConfig) {
    this.config = config;
    
    // Initialize playback state
    this.playbackState = {
      isPlaying: false,
      isPaused: false,
      isLoading: false,
      duration: 0,
      currentTime: 0,
      volume: 1.0,
      speed: config.voiceConfig.speed,
    };

    // Initialize session stats
    this.sessionStats = {
      totalDuration: 0,
      messagesCount: 0,
      userSpeechDuration: 0,
      agentSpeechDuration: 0,
      interruptionsCount: 0,
      averageLatency: 0,
      errorCount: 0,
      successRate: 0,
    };

    // Validate voice configuration
    const validation = validateVoiceConfig(config.voiceConfig);
    if (!validation.isValid) {
      console.warn('⚠️ Voice config validation warnings:', validation.warnings);
      if (validation.errors.length > 0) {
        this.handleError({
          type: 'invalid_configuration',
          message: `Invalid voice configuration: ${validation.errors.join(', ')}`,
          retryable: false,
          suggestedAction: 'Please check your voice settings',
        });
      }
    }

    console.log('🎤 VoiceManager initialized:', {
      userId: config.userId,
      voiceId: config.voiceConfig.voiceId,
      provider: config.voiceConfig.provider,
      enabled: config.voiceConfig.enabled,
    });
  }

  // ==========================================
  // PUBLIC API - TEXT-TO-SPEECH
  // ==========================================

  /**
   * Convert text to speech and play it
   */
  async speak(options: SpeakOptions): Promise<void> {
    // Check if voice is enabled
    if (!this.config.voiceConfig.enabled || !this.config.voiceConfig.outputEnabled) {
      console.log('🔇 Voice output disabled, skipping TTS');
      return;
    }

    // Validate text input
    if (!options.text || options.text.trim().length === 0) {
      console.warn('⚠️ Empty text provided to speak()');
      return;
    }

    // Handle interruption
    if (options.interrupt && this.isPlaying()) {
      await this.stop();
    }

    try {
      this.setState('processing');
      this.setPlaybackState({ isLoading: true, currentText: options.text });
      
      console.log('🎤 Starting TTS synthesis:', {
        text: options.text.substring(0, 100) + (options.text.length > 100 ? '...' : ''),
        voiceId: options.voiceId || this.config.voiceConfig.voiceId,
        speed: options.speed || this.config.voiceConfig.speed,
      });

      const startTime = Date.now();
      
      // Call onStart callback
      options.onStart?.();

      // Synthesize speech
      const result = await this.synthesizeSpeech({
        text: options.text,
        voiceId: options.voiceId || this.config.voiceConfig.voiceId,
        speed: options.speed || this.config.voiceConfig.speed,
        quality: options.quality || this.config.voiceConfig.quality,
      });

      const synthesisTime = Date.now() - startTime;
      console.log(`✅ TTS synthesis completed in ${synthesisTime}ms`);

      // Create and configure audio element
      await this.playAudio(result.audioUrl, result.metadata);
      
      // Update session stats
      this.updateSessionStats({
        messagesCount: this.sessionStats.messagesCount + 1,
        agentSpeechDuration: this.sessionStats.agentSpeechDuration + result.metadata.duration,
        averageLatency: (this.sessionStats.averageLatency + synthesisTime) / 2,
      });

      // Call onComplete callback
      options.onComplete?.();

    } catch (error) {
      const voiceError = this.createVoiceError(error, 'api_error');
      console.error('❌ TTS synthesis failed:', voiceError);
      
      this.handleError(voiceError);
      options.onError?.(voiceError);
      
      // Update error stats
      this.updateSessionStats({
        errorCount: this.sessionStats.errorCount + 1,
      });
    } finally {
      this.setPlaybackState({ isLoading: false });
    }
  }

  /**
   * Synthesize speech using OpenAI TTS API
   */
  private async synthesizeSpeech(options: {
    text: string;
    voiceId: string;
    speed: number;
    quality: VoiceQuality;
  }): Promise<VoiceSynthesisResult> {
    // Create abort controller for this request
    this.abortController = new AbortController();

    try {
      // Create TTS configuration
      const ttsConfig = createOpenAITTSConfig(
        options.voiceId as OpenAIVoiceId,
        options.quality,
        options.speed
      );

      console.log('📡 Calling TTS API:', { 
        model: ttsConfig.model,
        voice: ttsConfig.voice,
        speed: ttsConfig.speed,
        textLength: options.text.length 
      });

      // Call your API route (not directly to OpenAI for security)
      const response = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: options.text,
          config: ttsConfig,
          userId: this.config.userId,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'TTS synthesis failed');
      }

      // Return audio URL and metadata
      return {
        audioUrl: data.audioUrl, // Base64 data URL or blob URL
        metadata: {
          duration: data.metadata.duration || 0,
          format: data.metadata.format || 'mp3',
          bitrate: data.metadata.bitrate,
          fileSize: data.metadata.fileSize,
          language: this.config.voiceConfig.language,
          voiceId: options.voiceId,
          provider: this.config.voiceConfig.provider,
          processingTime: data.metadata.processingTime,
          isRealtime: false,
        },
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createVoiceError(error, 'timeout_error');
      }
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  // ==========================================
  // PUBLIC API - AUDIO PLAYBACK CONTROLS
  // ==========================================

  /**
   * Play audio from URL
   */
  private async playAudio(audioUrl: string, metadata: AudioMetadata): Promise<void> {
    return new Promise((resolve, reject) => {
      // Clean up existing audio
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.src = '';
        this.currentAudio = null;
      }

      // Create new audio element
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.volume = this.playbackState.volume;
      this.currentAudio.playbackRate = this.playbackState.speed;

      // Set up event listeners
      this.currentAudio.addEventListener('loadstart', () => {
        console.log('🔄 Audio loading started');
      });

      this.currentAudio.addEventListener('canplay', () => {
        console.log('✅ Audio can start playing');
        this.setPlaybackState({ 
          duration: this.currentAudio?.duration || 0,
          isLoading: false,
        });
      });

      this.currentAudio.addEventListener('play', () => {
        console.log('▶️ Audio playback started');
        this.setState('speaking');
        this.setPlaybackState({ 
          isPlaying: true, 
          isPaused: false,
        });
      });

      this.currentAudio.addEventListener('pause', () => {
        console.log('⏸️ Audio playback paused');
        this.setPlaybackState({ 
          isPlaying: false, 
          isPaused: true,
        });
      });

      this.currentAudio.addEventListener('timeupdate', () => {
        if (this.currentAudio) {
          this.setPlaybackState({ 
            currentTime: this.currentAudio.currentTime,
          });
        }
      });

      this.currentAudio.addEventListener('ended', () => {
        console.log('✅ Audio playback completed');
        this.setState('idle');
        this.setPlaybackState({ 
          isPlaying: false, 
          isPaused: false,
          currentTime: 0,
        });
        resolve();
      });

      this.currentAudio.addEventListener('error', (e) => {
        const error = this.createVoiceError(
          new Error(`Audio playback failed: ${this.currentAudio?.error?.message || 'Unknown error'}`),
          'audio_processing_error'
        );
        console.error('❌ Audio playback error:', error);
        this.handleError(error);
        reject(error);
      });

      // Start playback
      this.currentAudio.play().catch(error => {
        const voiceError = this.createVoiceError(error, 'audio_processing_error');
        this.handleError(voiceError);
        reject(voiceError);
      });
    });
  }

  /**
   * Pause current audio playback
   */
  async pause(): Promise<void> {
    if (this.currentAudio && this.isPlaying()) {
      this.currentAudio.pause();
      console.log('⏸️ Audio paused by user');
    }
  }

  /**
   * Resume paused audio playback
   */
  async resume(): Promise<void> {
    if (this.currentAudio && this.isPaused()) {
      await this.currentAudio.play();
      console.log('▶️ Audio resumed by user');
    }
  }

  /**
   * Stop current audio playback
   */
  async stop(): Promise<void> {
    // Cancel any ongoing synthesis
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Stop current audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
      
      this.updateSessionStats({
        interruptionsCount: this.sessionStats.interruptionsCount + 1,
      });
    }

    this.setState('idle');
    this.setPlaybackState({ 
      isPlaying: false, 
      isPaused: false,
      currentTime: 0,
      currentText: undefined,
    });

    console.log('⏹️ Audio stopped by user');
  }

  /**
   * Set playback volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    
    if (this.currentAudio) {
      this.currentAudio.volume = clampedVolume;
    }
    
    this.setPlaybackState({ volume: clampedVolume });
    console.log('🔊 Volume set to:', clampedVolume);
  }

  /**
   * Set playback speed (0.25 to 4.0)
   */
  setSpeed(speed: number): void {
    const clampedSpeed = Math.max(0.25, Math.min(4.0, speed));
    
    if (this.currentAudio) {
      this.currentAudio.playbackRate = clampedSpeed;
    }
    
    this.setPlaybackState({ speed: clampedSpeed });
    console.log('⏩ Speed set to:', clampedSpeed);
  }

  // ==========================================
  // PUBLIC API - STATE QUERIES
  // ==========================================

  /**
   * Check if audio is currently playing
   */
  isPlaying(): boolean {
    return this.playbackState.isPlaying;
  }

  /**
   * Check if audio is paused
   */
  isPaused(): boolean {
    return this.playbackState.isPaused;
  }

  /**
   * Check if synthesis/loading is in progress
   */
  isLoading(): boolean {
    return this.playbackState.isLoading || this.currentState === 'processing';
  }

  /**
   * Get current voice state
   */
  getState(): VoiceState {
    return this.currentState;
  }

  /**
   * Get current playback state
   */
  getPlaybackState(): VoicePlaybackState {
    return { ...this.playbackState };
  }

  /**
   * Get current session statistics
   */
  getSessionStats(): VoiceSessionStats {
    return { ...this.sessionStats };
  }

  // ==========================================
  // PUBLIC API - SESSION MANAGEMENT
  // ==========================================

  /**
   * Start a new voice session
   */
  async startSession(conversationId?: string): Promise<void> {
    if (this.currentSessionId) {
      console.log('⚠️ Voice session already active:', this.currentSessionId);
      return;
    }

    try {
      const sessionId = await VoicePreferencesService.createVoiceSession({
        userId: this.config.userId,
        conversationId: conversationId || this.config.conversationId || 'default',
        sessionType: 'tts_only', // For now, TTS only
        voiceProvider: this.config.voiceConfig.provider,
        voiceLanguage: this.config.voiceConfig.language,
        voiceId: this.config.voiceConfig.voiceId,
      });

      if (sessionId) {
        this.currentSessionId = sessionId;
        console.log('🎯 Voice session started:', sessionId);
      }
    } catch (error) {
      console.error('❌ Failed to start voice session:', error);
    }
  }

  /**
   * End current voice session
   */
  async endSession(): Promise<void> {
    if (!this.currentSessionId) {
      return;
    }

    try {
      // Update final session stats
      await VoicePreferencesService.updateVoiceSessionStats(
        this.currentSessionId,
        this.sessionStats
      );

      // End the session
      await VoicePreferencesService.endVoiceSession(this.currentSessionId);
      
      console.log('✅ Voice session ended:', this.currentSessionId);
      this.currentSessionId = null;
      
      // Reset stats
      this.sessionStats = {
        totalDuration: 0,
        messagesCount: 0,
        userSpeechDuration: 0,
        agentSpeechDuration: 0,
        interruptionsCount: 0,
        averageLatency: 0,
        errorCount: 0,
        successRate: 0,
      };
    } catch (error) {
      console.error('❌ Failed to end voice session:', error);
    }
  }

  // ==========================================
  // PUBLIC API - CONFIGURATION
  // ==========================================

  /**
   * Update voice configuration
   */
  updateConfig(newConfig: Partial<VoiceConfig>): void {
    this.config.voiceConfig = {
      ...this.config.voiceConfig,
      ...newConfig,
    };

    // Apply immediate changes
    if (newConfig.speed && this.currentAudio) {
      this.setSpeed(newConfig.speed);
    }

    console.log('⚙️ Voice config updated:', newConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): VoiceConfig {
    return { ...this.config.voiceConfig };
  }

  // ==========================================
  // PRIVATE METHODS - STATE MANAGEMENT
  // ==========================================

  /**
   * Update voice state and notify listeners
   */
  private setState(newState: VoiceState): void {
    if (this.currentState !== newState) {
      this.currentState = newState;
      this.config.onStateChange?.(newState);
      console.log('🔄 Voice state changed:', newState);
    }
  }

  /**
   * Update playback state and notify listeners
   */
  private setPlaybackState(updates: Partial<VoicePlaybackState>): void {
    this.playbackState = { ...this.playbackState, ...updates };
    this.config.onPlaybackChange?.(this.playbackState);
  }

  /**
   * Update session statistics
   */
  private updateSessionStats(updates: Partial<VoiceSessionStats>): void {
    this.sessionStats = { ...this.sessionStats, ...updates };
    
    // Calculate success rate
    if (this.sessionStats.messagesCount > 0) {
      this.sessionStats.successRate = 
        (this.sessionStats.messagesCount - this.sessionStats.errorCount) / this.sessionStats.messagesCount;
    }

    this.config.onSessionUpdate?.(updates);
    
    // Update remote session if active
    if (this.currentSessionId) {
      VoicePreferencesService.updateVoiceSessionStats(
        this.currentSessionId,
        updates
      ).catch(error => {
        console.error('Failed to update session stats:', error);
      });
    }
  }

  // ==========================================
  // PRIVATE METHODS - ERROR HANDLING
  // ==========================================

  /**
   * Handle voice errors
   */
  private handleError(error: VoiceError): void {
    this.setState('error');
    this.setPlaybackState({ isLoading: false, isPlaying: false });
    this.config.onError?.(error);
    
    console.error('🚨 Voice error:', error);
  }

  /**
   * Create standardized voice error
   */
  private createVoiceError(error: unknown, type: VoiceErrorType): VoiceError {
    const message = error instanceof Error ? error.message : 'Unknown voice error';
    
    return {
      type,
      message,
      context: {
        provider: this.config.voiceConfig.provider,
        operation: 'text_to_speech',
        timestamp: new Date(),
        details: { error },
      },
      retryable: ['network_error', 'api_error', 'timeout_error'].includes(type),
      suggestedAction: this.getSuggestedAction(type),
    };
  }

  /**
   * Get suggested action for error type
   */
  private getSuggestedAction(type: VoiceErrorType): string {
    switch (type) {
      case 'network_error':
        return 'Check your internet connection and try again';
      case 'api_error':
        return 'The voice service is temporarily unavailable. Please try again in a moment';
      case 'timeout_error':
        return 'Request timed out. Try again with a shorter message';
      case 'audio_processing_error':
        return 'Unable to play audio. Try refreshing the page';
      case 'invalid_configuration':
        return 'Please check your voice settings';
      default:
        return 'Please try again or contact support if the issue persists';
    }
  }

  // ==========================================
  // PUBLIC API - CLEANUP
  // ==========================================

  /**
   * Clean up resources and end session
   */
  async dispose(): Promise<void> {
    console.log('🧹 Disposing VoiceManager');
    
    // Stop current playback
    await this.stop();
    
    // End current session
    await this.endSession();
    
    // Clean up audio element
    if (this.currentAudio) {
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
    
    // Cancel any pending requests
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    console.log('✅ VoiceManager disposed');
  }
}

// ==========================================
// EXPORT DEFAULT AND TYPES
// ==========================================

export default VoiceManager;