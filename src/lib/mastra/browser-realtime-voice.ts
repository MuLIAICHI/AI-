// src/lib/mastra/browser-realtime-voice.ts
// Browser-compatible real-time voice client (avoiding Node.js ws dependency)

import { 
  VoiceConfig, 
  VoiceState, 
  VoiceError, 
  VoiceErrorType,
  OpenAIVoiceId,
} from '@/lib/voice/voice-types';
import { 
  getEnhancedVoiceEnvironmentConfig 
} from '@/lib/voice/voice-config';

// ==========================================
// BROWSER-SPECIFIC INTERFACES
// ==========================================

export interface BrowserRealtimeConfig {
  apiKey: string;
  model: string;
  voice: OpenAIVoiceId;
  temperature?: number;
  maxTokens?: number;
  instructions?: string;
}

export interface BrowserRealtimeState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  sessionActive: boolean;
  userSpeaking: boolean;
  aiSpeaking: boolean;
  audioLevel: number;
  error: string | null;
  sessionId: string | null;
}

export interface BrowserRealtimeEvents {
  onConnectionChange: (status: BrowserRealtimeState['connectionStatus']) => void;
  onUserSpeaking: (speaking: boolean) => void;
  onAiSpeaking: (speaking: boolean) => void;
  onAudioLevel: (level: number) => void;
  onTranscript: (text: string, role: 'user' | 'assistant') => void;
  onAudioData: (audio: Int16Array) => void;
  onError: (error: VoiceError) => void;
  onSessionUpdate: (sessionId: string) => void;
}

// ==========================================
// BROWSER REAL-TIME VOICE CLIENT
// ==========================================

/**
 * Browser-compatible real-time voice client
 * Uses native browser WebSocket and Web Audio APIs
 */
export class BrowserRealtimeVoice {
  private config: BrowserRealtimeConfig;
  private state: BrowserRealtimeState;
  private events: Partial<BrowserRealtimeEvents> = {};
  private websocket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private isInitialized: boolean = false;

  constructor(config: BrowserRealtimeConfig) {
    this.config = config;
    this.state = {
      connectionStatus: 'disconnected',
      sessionActive: false,
      userSpeaking: false,
      aiSpeaking: false,
      audioLevel: 0,
      error: null,
      sessionId: null,
    };
  }

  // ==========================================
  // INITIALIZATION & CONNECTION
  // ==========================================

  /**
   * Initialize the browser-based real-time voice client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🎤 Browser real-time voice already initialized');
      return;
    }

    try {
      console.log('🎤 Initializing browser real-time voice...');
      
      // Check browser support
      if (!this.checkBrowserSupport()) {
        throw new Error('Browser does not support required APIs');
      }

      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
        latencyHint: 'interactive',
      });

      this.isInitialized = true;
      console.log('✅ Browser real-time voice initialized');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Initialization failed';
      this.updateState({ error: errorMessage, connectionStatus: 'error' });
      throw new Error(`Browser voice initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Connect to OpenAI Realtime API using browser WebSocket
   */
  async connect(options: { instructions?: string; voice?: OpenAIVoiceId } = {}): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.updateState({ connectionStatus: 'connecting' });
      console.log('🔗 Connecting to OpenAI Realtime API via browser WebSocket...');

      // Create WebSocket connection using browser's native WebSocket
      const wsUrl = `wss://api.openai.com/v1/realtime?model=${this.config.model}`;
      this.websocket = new WebSocket(wsUrl, ['realtime']);

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers();

      // Wait for connection
      await this.waitForConnection();

      // Configure session
      await this.configureSession(options);

      const sessionId = `browser_session_${Date.now()}`;
      this.updateState({ 
        connectionStatus: 'connected',
        sessionActive: true,
        sessionId 
      });

      this.events.onSessionUpdate?.(sessionId);
      console.log('✅ Connected to Real-time API via browser WebSocket');

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
   * Disconnect from the real-time service
   */
  async disconnect(): Promise<void> {
    try {
      console.log('🔌 Disconnecting from Real-time API...');
      
      // Stop microphone
      await this.stopListening();
      
      // Close WebSocket
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }

      // Close audio context
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

      console.log('✅ Disconnected from Real-time API');
      
    } catch (error) {
      console.error('Error disconnecting:', error);
      this.updateState({ 
        connectionStatus: 'error',
        error: error instanceof Error ? error.message : 'Disconnect failed'
      });
    }
  }

  // ==========================================
  // AUDIO MANAGEMENT
  // ==========================================

  /**
   * Start listening for user input using browser microphone
   */
  async startListening(): Promise<void> {
    if (!this.websocket || this.state.connectionStatus !== 'connected') {
      throw new Error('Not connected to real-time service');
    }

    try {
      console.log('🎤 Starting browser microphone input...');
      
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!this.audioContext) {
        throw new Error('Audio context not initialized');
      }

      // Create audio processing pipeline
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Calculate audio level
        const audioLevel = this.calculateAudioLevel(inputData);
        this.updateState({ audioLevel });
        this.events.onAudioLevel?.(audioLevel);
        
        // Convert to Int16Array and send via WebSocket
        if (audioLevel > 0.01) { // Only send if there's significant audio
          const int16Data = this.float32ToInt16(inputData);
          this.sendAudioData(int16Data);
        }
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);

      console.log('✅ Browser microphone input started');
      
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
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      this.updateState({ 
        userSpeaking: false, 
        audioLevel: 0 
      });
      
      console.log('🔇 Browser microphone input stopped');
      
    } catch (error) {
      console.error('Error stopping microphone:', error);
    }
  }

  /**
   * Speak text using the real-time voice
   */
  async speak(text: string): Promise<void> {
    if (!this.websocket || this.state.connectionStatus !== 'connected') {
      throw new Error('Not connected to real-time service');
    }

    try {
      console.log('🗣️ Speaking text via browser real-time voice:', text.substring(0, 50) + '...');
      
      // Send text to real-time API
      this.sendMessage({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text }]
        }
      });

      this.sendMessage({ type: 'response.create' });
      
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
  // WEBSOCKET MANAGEMENT
  // ==========================================

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.websocket) return;

    this.websocket.onopen = () => {
      console.log('🔗 WebSocket connected');
    };

    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleRealtimeMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.websocket.onerror = (error) => {
      console.error('🚨 WebSocket error:', error);
      this.updateState({ 
        error: 'WebSocket connection error',
        connectionStatus: 'error'
      });
    };

    this.websocket.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      this.updateState({ 
        connectionStatus: 'disconnected',
        sessionActive: false 
      });
    };
  }

  /**
   * Handle real-time API messages
   */
  private handleRealtimeMessage(data: any): void {
    switch (data.type) {
      case 'conversation.item.input_audio_transcription.completed':
        this.events.onTranscript?.(data.transcript, 'user');
        break;
        
      case 'response.audio.delta':
        if (data.delta) {
          // Convert base64 audio to Int16Array
          const audioData = this.base64ToInt16Array(data.delta);
          this.events.onAudioData?.(audioData);
          this.updateState({ aiSpeaking: true });
        }
        break;
        
      case 'response.audio.done':
        this.updateState({ aiSpeaking: false });
        break;
        
      case 'error':
        console.error('Real-time API error:', data);
        this.events.onError?.({
          type: 'api_error',
          message: data.error.message || 'Unknown API error',
          context: {
            provider: 'openai',
            operation: 'realtime_api',
            timestamp: new Date(),
          },
          retryable: false,
        });
        break;
    }
  }

  /**
   * Wait for WebSocket connection
   */
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.websocket) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.websocket.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.websocket.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('WebSocket connection failed'));
      };
    });
  }

  /**
   * Configure real-time session
   */
  private async configureSession(options: { instructions?: string; voice?: OpenAIVoiceId }): Promise<void> {
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        voice: options.voice || this.config.voice,
        instructions: options.instructions || this.config.instructions || 'You are a helpful assistant.',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.6,
          prefix_padding_ms: 300,
          silence_duration_ms: 1200,
        },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1',
        },
      },
    };

    this.sendMessage(sessionConfig);
  }

  /**
   * Send message via WebSocket
   */
  private sendMessage(message: any): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  /**
   * Send audio data via WebSocket
   */
  private sendAudioData(audioData: Int16Array): void {
    const base64Audio = this.int16ArrayToBase64(audioData);
    this.sendMessage({
      type: 'input_audio_buffer.append',
      audio: base64Audio,
    });
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Check browser support
   */
  private checkBrowserSupport(): boolean {
    return !!(
      window.WebSocket &&
      window.AudioContext &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    );
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<BrowserRealtimeState>): void {
    const previousStatus = this.state.connectionStatus;
    this.state = { ...this.state, ...updates };
    
    if (updates.connectionStatus && updates.connectionStatus !== previousStatus) {
      this.events.onConnectionChange?.(updates.connectionStatus);
    }

    if (updates.userSpeaking !== undefined) {
      this.events.onUserSpeaking?.(updates.userSpeaking);
    }

    if (updates.aiSpeaking !== undefined) {
      this.events.onAiSpeaking?.(updates.aiSpeaking);
    }
  }

  /**
   * Calculate audio level
   */
  private calculateAudioLevel(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Convert Float32Array to Int16Array
   */
  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      int16Array[i] = Math.max(-32768, Math.min(32767, float32Array[i] * 32768));
    }
    return int16Array;
  }

  /**
   * Convert Int16Array to base64
   */
  private int16ArrayToBase64(int16Array: Int16Array): string {
    const bytes = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 to Int16Array
   */
  private base64ToInt16Array(base64: string): Int16Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }

  // ==========================================
  // EVENT REGISTRATION
  // ==========================================

  on<K extends keyof BrowserRealtimeEvents>(
    event: K,
    handler: BrowserRealtimeEvents[K]
  ): void {
    this.events[event] = handler;
  }

  off<K extends keyof BrowserRealtimeEvents>(event: K): void {
    delete this.events[event];
  }

  // ==========================================
  // GETTERS
  // ==========================================

  getState(): BrowserRealtimeState {
    return { ...this.state };
  }

  getConnectionStatus(): BrowserRealtimeState['connectionStatus'] {
    return this.state.connectionStatus;
  }

  isSessionActive(): boolean {
    return this.state.sessionActive && this.state.connectionStatus === 'connected';
  }

  isReady(): boolean {
    return this.isInitialized && this.state.connectionStatus === 'connected';
  }
}

// ==========================================
// FACTORY FUNCTION
// ==========================================

/**
 * Create a browser-compatible real-time voice client
 */
export function createBrowserRealtimeVoice(
  voiceConfig?: Partial<VoiceConfig>
): BrowserRealtimeVoice {
  const envConfig = getEnhancedVoiceEnvironmentConfig();
  
  if (!envConfig.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is required for real-time voice');
  }

  const config: BrowserRealtimeConfig = {
    apiKey: envConfig.openai.apiKey,
    model: envConfig.realtime.model,
    voice: (voiceConfig?.voiceId as OpenAIVoiceId) || envConfig.realtime.defaultVoice,
    temperature: envConfig.realtime.temperature,
    maxTokens: envConfig.realtime.maxTokens,
  };

  return new BrowserRealtimeVoice(config);
}