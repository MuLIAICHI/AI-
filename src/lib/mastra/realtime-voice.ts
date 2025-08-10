// src/lib/mastra/realtime-voice.ts
// Core Mastra Real-time Voice client for speech-to-speech communication

import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { 
  VoiceConfig, 
  VoiceState, 
  VoiceError, 
  VoiceErrorType,
  OpenAIVoiceId,
  OpenAIRealtimeConfig 
} from '@/lib/voice/voice-types';
import { 
  getEnhancedVoiceEnvironmentConfig, 
  createMastraRealtimeConfig 
} from '@/lib/voice/voice-config';

// ==========================================
// INTERFACES & TYPES
// ==========================================

export interface RealtimeVoiceConfig {
  apiKey: string;
  model: string;
  speaker: OpenAIVoiceId;
  vadSettings?: {
    threshold: number;
    silence_duration_ms: number;
    prefix_padding_ms: number;
  };
  temperature?: number;
  maxTokens?: number;
}

export interface RealtimeVoiceState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  sessionActive: boolean;
  userSpeaking: boolean;
  aiSpeaking: boolean;
  audioLevel: number;
  error: string | null;
  sessionId: string | null;
  lastActivity: Date | null;
}

export interface RealtimeVoiceEvents {
  onConnectionChange: (status: RealtimeVoiceState['connectionStatus']) => void;
  onUserSpeaking: (speaking: boolean) => void;
  onAiSpeaking: (speaking: boolean) => void;
  onAudioLevel: (level: number) => void;
  onTranscript: (text: string, role: 'user' | 'assistant') => void;
  onAudioData: (audio: Int16Array) => void;
  onError: (error: VoiceError) => void;
  onSessionUpdate: (sessionId: string) => void;
}

export interface RealtimeSessionOptions {
  conversationId?: string;
  instructions?: string;
  voice?: OpenAIVoiceId;
  temperature?: number;
  autoStart?: boolean;
}

// ==========================================
// MASTRA REAL-TIME VOICE CLIENT
// ==========================================

/**
 * SmartlyteRealtimeVoice - Mastra-powered real-time voice client
 * 
 * Provides direct speech-to-speech communication with OpenAI Realtime API
 * Replaces the problematic STT -> Text -> TTS flow with direct audio streaming
 */
export class SmartlyteRealtimeVoice {
  private voice: OpenAIRealtimeVoice | null = null;
  private state: RealtimeVoiceState;
  private events: Partial<RealtimeVoiceEvents> = {};
  private config: RealtimeVoiceConfig;
  private sessionInstructions: string = '';
  private audioContext: AudioContext | null = null;
  private microphoneStream: MediaStream | null = null;
  private isInitialized: boolean = false;

  constructor(config: RealtimeVoiceConfig) {
    this.config = config;
    this.state = {
      connectionStatus: 'disconnected',
      sessionActive: false,
      userSpeaking: false,
      aiSpeaking: false,
      audioLevel: 0,
      error: null,
      sessionId: null,
      lastActivity: null,
    };
  }

  // ==========================================
  // INITIALIZATION & CONNECTION
  // ==========================================

  /**
   * Initialize the real-time voice client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🎤 Real-time voice client already initialized');
      return;
    }

    try {
      console.log('🎤 Initializing Mastra Real-time Voice client...');
      
      // Create Mastra OpenAI Realtime Voice instance
      this.voice = new OpenAIRealtimeVoice({
        apiKey: this.config.apiKey,
        model: this.config.model || 'gpt-4o-realtime-preview-2024-12-17',
        speaker: this.config.speaker || 'alloy',
      });

      // Configure voice activity detection
      if (this.config.vadSettings) {
        await this.voice.updateConfig({
          turn_detection: {
            type: 'server_vad',
            threshold: this.config.vadSettings.threshold,
            silence_duration_ms: this.config.vadSettings.silence_duration_ms,
            prefix_padding_ms: this.config.vadSettings.prefix_padding_ms,
          },
        });
      }

      // Set up event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('✅ Mastra Real-time Voice client initialized');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize voice client';
      this.updateState({ error: errorMessage, connectionStatus: 'error' });
      throw new Error(`Voice client initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Connect to the real-time voice service
   */
  async connect(options: RealtimeSessionOptions = {}): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.voice) {
      throw new Error('Voice client not initialized');
    }

    try {
      this.updateState({ connectionStatus: 'connecting' });
      console.log('🔗 Connecting to OpenAI Realtime API...');

      // Connect to the service using the correct method
      await this.voice.connect();
      
      // Generate session ID
      const sessionId = `realtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Update session instructions if provided
      if (options.instructions) {
        this.sessionInstructions = options.instructions;
        await this.voice.updateConfig({
          instructions: options.instructions,
        });
      }

      // Update voice if different from default
      if (options.voice && options.voice !== this.config.speaker) {
        await this.voice.updateConfig({
          voice: options.voice,
        });
      }

      // Update temperature if provided
      if (options.temperature !== undefined) {
        await this.voice.updateConfig({
          temperature: options.temperature,
        });
      }

      this.updateState({ 
        connectionStatus: 'connected',
        sessionId,
        sessionActive: true,
        lastActivity: new Date(),
        error: null
      });

      // Trigger session update event
      this.events.onSessionUpdate?.(sessionId);
      
      console.log('✅ Connected to Real-time Voice service:', sessionId);

      // Auto-start listening if requested
      if (options.autoStart !== false) {
        await this.startListening();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.updateState({ 
        connectionStatus: 'error', 
        error: errorMessage,
        sessionActive: false 
      });
      
      this.events.onError?.({
        type: 'connection_lost',
        message: errorMessage,
        context: {
          provider: 'openai',
          operation: 'connect',
          timestamp: new Date(),
        },
        retryable: true,
      });
      
      throw new Error(`Failed to connect: ${errorMessage}`);
    }
  }

  /**
   * Disconnect from the real-time voice service
   */
  async disconnect(): Promise<void> {
    try {
      console.log('🔌 Disconnecting from Real-time Voice service...');
      
      // Stop microphone stream
      await this.stopListening();
      
      // Disconnect from Mastra voice service
      if (this.voice) {
        await this.voice.close();
      }

      // Clean up audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
      }

      this.updateState({
        connectionStatus: 'disconnected',
        sessionActive: false,
        userSpeaking: false,
        aiSpeaking: false,
        audioLevel: 0,
        sessionId: null,
        error: null
      });

      console.log('✅ Disconnected from Real-time Voice service');
      
    } catch (error) {
      console.error('Error disconnecting:', error);
      this.updateState({ 
        connectionStatus: 'error',
        error: error instanceof Error ? error.message : 'Disconnect failed'
      });
    }
  }

  // ==========================================
  // AUDIO INPUT/OUTPUT MANAGEMENT
  // ==========================================

  /**
   * Start listening for user input
   */
  async startListening(): Promise<void> {
    if (!this.voice || this.state.connectionStatus !== 'connected') {
      throw new Error('Voice client not connected');
    }

    try {
      console.log('🎤 Starting microphone input...');
      
      // Request microphone access
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create audio context if needed
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
        });
      }

      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Process microphone input and send to Mastra
      const source = this.audioContext.createMediaStreamSource(this.microphoneStream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array for Mastra
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        
        // Calculate audio level for visualization
        const audioLevel = this.calculateAudioLevel(inputData);
        this.updateState({ audioLevel });
        this.events.onAudioLevel?.(audioLevel);
        
        // Send audio data to Mastra voice client
        if (this.voice && audioLevel > 0.01) { // Only send if there's significant audio
          this.voice.send(int16Data);
        }
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      console.log('✅ Microphone input started');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start listening';
      this.updateState({ error: errorMessage });
      
      this.events.onError?.({
        type: 'microphone_unavailable',
        message: errorMessage,
        context: {
          provider: 'openai',
          operation: 'microphone_access',
          timestamp: new Date(),
        },
        retryable: true,
      });
      
      throw new Error(`Failed to start listening: ${errorMessage}`);
    }
  }

  /**
   * Stop listening for user input
   */
  async stopListening(): Promise<void> {
    try {
      if (this.microphoneStream) {
        this.microphoneStream.getTracks().forEach(track => track.stop());
        this.microphoneStream = null;
      }

      this.updateState({ 
        userSpeaking: false, 
        audioLevel: 0 
      });
      
      console.log('🔇 Microphone input stopped');
      
    } catch (error) {
      console.error('Error stopping microphone:', error);
    }
  }

  /**
   * Speak text using the real-time voice
   */
  async speak(text: string): Promise<void> {
    if (!this.voice || this.state.connectionStatus !== 'connected') {
      throw new Error('Voice client not connected');
    }

    try {
      console.log('🗣️ Speaking text via real-time voice:', text.substring(0, 50) + '...');
      
      // Use Mastra's speak functionality
      await this.voice.speak(text);
      
      this.updateState({ lastActivity: new Date() });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to speak';
      this.updateState({ error: errorMessage });
      
      this.events.onError?.({
        type: 'audio_processing_error',
        message: errorMessage,
        context: {
          provider: 'openai',
          operation: 'text_to_speech',
          timestamp: new Date(),
        },
        retryable: true,
      });
      
      throw new Error(`Failed to speak: ${errorMessage}`);
    }
  }

  // ==========================================
  // EVENT MANAGEMENT
  // ==========================================

  /**
   * Set up event listeners for the Mastra voice client
   */
  private setupEventListeners(): void {
    if (!this.voice) return;

    // Audio output from AI
    this.voice.on('speaker', ({ audio }: { audio: Int16Array }) => {
      this.updateState({ aiSpeaking: true, lastActivity: new Date() });
      this.events.onAiSpeaking?.(true);
      this.events.onAudioData?.(audio);
    });

    // Transcript events (for both user and assistant)
    this.voice.on('writing', ({ text, role }: { text: string; role: 'user' | 'assistant' }) => {
      console.log(`📝 Transcript (${role}):`, text);
      this.events.onTranscript?.(text, role);
      this.updateState({ lastActivity: new Date() });
    });

    // Error events
    this.voice.on('error', (error: Error) => {
      console.error('🚨 Mastra voice error:', error);
      this.updateState({ 
        error: error.message,
        connectionStatus: 'error'
      });
      
      this.events.onError?.({
        type: 'api_error',
        message: error.message,
        context: {
          provider: 'openai',
          operation: 'realtime_voice',
          timestamp: new Date(),
        },
        retryable: false,
      });
    });

    // Connection events (these might not be available in Mastra, so we handle them manually)
    // this.voice.on('connected', () => {
    //   console.log('🔗 Mastra voice connected');
    //   this.updateState({ connectionStatus: 'connected' });
    // });

    // this.voice.on('disconnected', () => {
    //   console.log('🔌 Mastra voice disconnected');
    //   this.updateState({ 
    //     connectionStatus: 'disconnected',
    //     sessionActive: false,
    //     userSpeaking: false,
    //     aiSpeaking: false 
    //   });
    // });
  }

  /**
   * Register event handlers
   */
  on<K extends keyof RealtimeVoiceEvents>(
    event: K,
    handler: RealtimeVoiceEvents[K]
  ): void {
    this.events[event] = handler;
  }

  /**
   * Remove event handlers
   */
  off<K extends keyof RealtimeVoiceEvents>(event: K): void {
    delete this.events[event];
  }

  // ==========================================
  // STATE MANAGEMENT & UTILITIES
  // ==========================================

  /**
   * Update internal state and notify listeners
   */
  private updateState(updates: Partial<RealtimeVoiceState>): void {
    const previousStatus = this.state.connectionStatus;
    this.state = { ...this.state, ...updates };
    
    // Notify connection status changes
    if (updates.connectionStatus && updates.connectionStatus !== previousStatus) {
      this.events.onConnectionChange?.(updates.connectionStatus);
    }

    // Notify speaking state changes
    if (updates.userSpeaking !== undefined) {
      this.events.onUserSpeaking?.(updates.userSpeaking);
    }

    if (updates.aiSpeaking !== undefined) {
      this.events.onAiSpeaking?.(updates.aiSpeaking);
    }
  }

  /**
   * Calculate audio level from audio data
   */
  private calculateAudioLevel(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Update session configuration
   */
  async updateConfig(updates: Partial<RealtimeSessionOptions>): Promise<void> {
    if (!this.voice || this.state.connectionStatus !== 'connected') {
      throw new Error('Voice client not connected');
    }

    try {
      const sessionUpdates: any = {};
      
      if (updates.instructions) {
        sessionUpdates.instructions = updates.instructions;
        this.sessionInstructions = updates.instructions;
      }
      
      if (updates.voice) {
        sessionUpdates.voice = updates.voice;
      }
      
      if (updates.temperature !== undefined) {
        sessionUpdates.temperature = updates.temperature;
      }

      await this.voice.updateConfig(sessionUpdates);
      console.log('⚙️ Session configuration updated');
      
    } catch (error) {
      console.error('Failed to update session:', error);
      throw error;
    }
  }

  // ==========================================
  // GETTERS
  // ==========================================

  /**
   * Get current state
   */
  getState(): RealtimeVoiceState {
    return { ...this.state };
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): RealtimeVoiceState['connectionStatus'] {
    return this.state.connectionStatus;
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.state.sessionActive && this.state.connectionStatus === 'connected';
  }

  /**
   * Check if ready for real-time communication
   */
  isReady(): boolean {
    return this.isInitialized && this.state.connectionStatus === 'connected';
  }

  /**
   * Get session information
   */
  getSessionInfo() {
    return {
      sessionId: this.state.sessionId,
      isActive: this.state.sessionActive,
      connectionStatus: this.state.connectionStatus,
      lastActivity: this.state.lastActivity,
      instructions: this.sessionInstructions,
    };
  }
}

// ==========================================
// FACTORY FUNCTIONS
// ==========================================

/**
 * Create a Mastra real-time voice client with environment configuration
 */
export function createRealtimeVoiceClient(
  voiceConfig?: Partial<VoiceConfig>
): SmartlyteRealtimeVoice {
  const envConfig = getEnhancedVoiceEnvironmentConfig();
  
  if (!envConfig.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is required for real-time voice');
  }

  if (!envConfig.realtime.enabled) {
    throw new Error('Real-time voice is disabled. Set VOICE_REALTIME_ENABLED=true');
  }

  const realtimeConfig: RealtimeVoiceConfig = {
    apiKey: envConfig.openai.apiKey,
    model: envConfig.realtime.model,
    speaker: (voiceConfig?.voiceId as OpenAIVoiceId) || envConfig.realtime.defaultVoice,
    vadSettings: {
      threshold: envConfig.realtime.vadSettings.threshold,
      silence_duration_ms: envConfig.realtime.vadSettings.silenceDurationMs,
      prefix_padding_ms: envConfig.realtime.vadSettings.prefixPaddingMs,
    },
    temperature: envConfig.realtime.temperature,
    maxTokens: envConfig.realtime.maxTokens,
  };

  return new SmartlyteRealtimeVoice(realtimeConfig);
}

/**
 * Validate real-time voice support
 */
export function validateRealtimeSupport(): {
  supported: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check browser APIs
  if (typeof window === 'undefined') {
    errors.push('Real-time voice requires browser environment');
  } else {
    if (!navigator.mediaDevices) {
      errors.push('MediaDevices API not available');
    }
    
    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      errors.push('Web Audio API not available');
    }
    
    if (!window.WebSocket) {
      errors.push('WebSocket API not available');
    }
    
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      errors.push('HTTPS required for microphone access');
    }
  }

  // Check environment configuration
  try {
    const envConfig = getEnhancedVoiceEnvironmentConfig();
    
    if (!envConfig.openai.apiKey) {
      errors.push('OPENAI_API_KEY not configured');
    }
    
    if (!envConfig.realtime.enabled) {
      warnings.push('Real-time voice is disabled in configuration');
    }
    
  } catch (error) {
    errors.push('Configuration validation failed');
  }

  return {
    supported: errors.length === 0,
    errors,
    warnings,
  };
}