// // src/hooks/use-mastra-voice.ts
// // React hook for Mastra Real-time Voice integration

// 'use client';

// import { useState, useCallback, useEffect, useRef } from 'react';
// import { useUser } from '@clerk/nextjs';
// import { useVoicePreferences } from './use-voice-preferences';
// import { 
//   SmartlyteRealtimeVoice, 
//   createRealtimeVoiceClient,
//   validateRealtimeSupport,
//   type RealtimeVoiceState,
//   type RealtimeSessionOptions,
//   type RealtimeVoiceEvents 
// } from '@/lib/mastra/realtime-voice';
// import { 
//   BrowserAudioManager, 
//   createBrowserAudioManager,
//   type AudioPlaybackOptions 
// } from '@/lib/mastra/browser-audio';
// import { 
//   globalVoiceEvents,
//   emitVoiceEvent,
//   createTranscriptEvent,
//   createSpeakingEvent,
//   createErrorEvent,
//   VoiceEvent
// } from '@/lib/mastra/voice-events';
// import {
//   VoiceState,
//   VoiceError,
//   VoiceSessionStats,
// } from '@/lib/voice/voice-types'; 
// // ==========================================
// // TYPES & INTERFACES
// // ==========================================


// export interface MastraVoiceState {
//   // Connection & Session
//   connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
//   sessionActive: boolean;
//   sessionId: string | null;
//   isReady: boolean;
  
//   // Audio State
//   userSpeaking: boolean;
//   aiSpeaking: boolean;
//   audioLevel: number;
//   isListening: boolean;
  
//   // System State
//   isInitialized: boolean;
//   isSupported: boolean;
//   hasPermissions: boolean;
  
//   // Error State
//   error: string | null;
//   lastActivity: Date | null;
// }

// export interface MastraVoiceOptions {
//   conversationId?: string;
//   instructions?: string;
//   voiceId?: string;
//   autoStart?: boolean;
//   enableFallback?: boolean;
// }

// export interface UseMastraVoiceReturn {
//   // State
//   state: MastraVoiceState;
//   isConnected: boolean;
//   isSessionActive: boolean;
//   canSpeak: boolean;
  
//   // Actions - Session Management
//   initializeVoice: () => Promise<void>;
//   startSession: (options?: MastraVoiceOptions) => Promise<void>;
//   endSession: () => Promise<void>;
  
//   // Actions - Communication
//   speak: (text: string, interrupt?: boolean) => Promise<void>;
//   startListening: () => Promise<void>;
//   stopListening: () => Promise<void>;
  
//   // Actions - Configuration
//   updateInstructions: (instructions: string) => Promise<void>;
//   updateVoice: (voiceId: string) => Promise<void>;
  
//   // Utilities
//   clearError: () => void;
//   checkSupport: () => Promise<{ supported: boolean; errors: string[] }>;
  
//   // Event Handlers (for custom integration)
//   onTranscript: (handler: (text: string, role: 'user' | 'assistant') => void) => () => void;
//   onAudioLevel: (handler: (level: number) => void) => () => void;
//   onError: (handler: (error: VoiceError) => void) => () => void;
// }

// // ==========================================
// // MAIN HOOK
// // ==========================================

// /**
//  * React hook for Mastra Real-time Voice integration
//  * 
//  * Integrates with your existing voice preferences and provides real-time
//  * speech-to-speech communication as a replacement for the TTS/STT flow
//  */
// export function useMastraVoice(): UseMastraVoiceReturn {
//   const { user, isLoaded } = useUser();
//   const { preferences, isVoiceEnabled } = useVoicePreferences();
  
//   // Core state
//   const [state, setState] = useState<MastraVoiceState>({
//     connectionStatus: 'disconnected',
//     sessionActive: false,
//     sessionId: null,
//     isReady: false,
//     userSpeaking: false,
//     aiSpeaking: false,
//     audioLevel: 0,
//     isListening: false,
//     isInitialized: false,
//     isSupported: false,
//     hasPermissions: false,
//     error: null,
//     lastActivity: null,
//   });

//   // Refs for client instances
//   const voiceClientRef = useRef<SmartlyteRealtimeVoice | null>(null);
//   const audioManagerRef = useRef<BrowserAudioManager | null>(null);
//   const isInitializingRef = useRef(false);

//   /**
//    * Clear any existing errors
//    */
//   const clearError = useCallback(() => {
//     setState(prev => ({ ...prev, error: null }));
//   }, []);

//   /**
//    * Update state helper
//    */
//   const updateState = useCallback((updates: Partial<MastraVoiceState>) => {
//     setState(prev => ({ ...prev, ...updates }));
//   }, []);

//   /**
//    * Check browser and device support for real-time voice
//    */
//   const checkSupport = useCallback(async (): Promise<{ supported: boolean; errors: string[] }> => {
//     try {
//       const support = validateRealtimeSupport();
      
//       updateState({ 
//         isSupported: support.supported,
//         hasPermissions: support.supported 
//       });
      
//       return { 
//         supported: support.supported, 
//         errors: support.errors 
//       };
      
//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Support check failed';
//       updateState({ error: errorMessage, isSupported: false });
//       return { supported: false, errors: [errorMessage] };
//     }
//   }, [updateState]);

//   /**
//    * Initialize the Mastra voice client and audio manager
//    */
//   const initializeVoice = useCallback(async (): Promise<void> => {
//     if (isInitializingRef.current || state.isInitialized) {
//       console.log('🎤 Voice already initialized or initializing');
//       return;
//     }

//     if (!user || !isLoaded || !preferences) {
//       console.log('🔄 User/preferences not ready for voice initialization');
//       return;
//     }

//     if (!isVoiceEnabled || !preferences.voiceEnabled) {
//       console.log('🔇 Voice disabled in preferences');
//       return;
//     }

//     try {
//       isInitializingRef.current = true;
//       updateState({ error: null });

//       console.log('🎤 Initializing Mastra real-time voice client...');

//       // Check support first
//       const support = await checkSupport();
//       if (!support.supported) {
//         throw new Error(`Real-time voice not supported: ${support.errors.join(', ')}`);
//       }

//       // Initialize audio manager
//       console.log('🔊 Creating browser audio manager...');
//       audioManagerRef.current = createBrowserAudioManager({
//         enableVisualization: preferences.voiceVisualizationEnabled ?? true,
//       });
//       await audioManagerRef.current.initialize();

//       // Initialize voice client
//       console.log('🎤 Creating real-time voice client...');
//       voiceClientRef.current = createRealtimeVoiceClient({
//         voiceId: preferences.preferredVoice || 'alloy',
//         language: preferences.voiceLanguage || 'en',
//         speed: preferences.voiceSpeed || 1.0,
//       });

//       // Set up event handlers
//       setupEventHandlers();

//       // Initialize the client
//       await voiceClientRef.current.initialize();

//       updateState({ 
//         isInitialized: true,
//         isReady: true 
//       });

//       console.log('✅ Mastra real-time voice client initialized successfully');

//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Failed to initialize voice';
//       console.error('❌ Voice initialization failed:', error);
      
//       updateState({ 
//         error: errorMessage,
//         isInitialized: false,
//         isReady: false 
//       });

//       // Emit error event
//       emitVoiceEvent(createErrorEvent({
//         type: 'api_error',
//         message: errorMessage,
//         context: {
//           provider: 'openai',
//           operation: 'initialization',
//           timestamp: new Date(),
//         },
//         retryable: true,
//       }));

//       throw error;
      
//     } finally {
//       isInitializingRef.current = false;
//     }
//   }, [user, isLoaded, preferences, isVoiceEnabled, state.isInitialized, updateState, checkSupport]);

//   /**
//    * Set up event handlers for the voice client
//    */
//   const setupEventHandlers = useCallback(() => {
//     if (!voiceClientRef.current) return;

//     const client = voiceClientRef.current;

//     // Connection status changes
//     client.on('onConnectionChange', (status) => {
//       updateState({ connectionStatus: status });
//       console.log(`🔗 Connection status changed: ${status}`);
//     });

//     // User speaking events
//     client.on('onUserSpeaking', (speaking) => {
//       updateState({ userSpeaking: speaking });
      
//       // Emit voice events
//       emitVoiceEvent(createSpeakingEvent(
//         speaking ? 'user_speaking_start' : 'user_speaking_end',
//         state.sessionId || undefined
//       ));
      
//       console.log(`🎤 User ${speaking ? 'started' : 'stopped'} speaking`);
//     });

//     // AI speaking events
//     client.on('onAiSpeaking', (speaking) => {
//       updateState({ aiSpeaking: speaking });
      
//       // Emit voice events
//       emitVoiceEvent(createSpeakingEvent(
//         speaking ? 'ai_speaking_start' : 'ai_speaking_end',
//         state.sessionId || undefined
//       ));
      
//       console.log(`🤖 AI ${speaking ? 'started' : 'stopped'} speaking`);
//     });

//     // Audio level updates
//     client.on('onAudioLevel', (level) => {
//       updateState({ audioLevel: level });
//     });

//     // Transcript events
//     client.on('onTranscript', (text, role) => {
//       console.log(`📝 Transcript (${role}): ${text}`);
      
//       // Emit transcript event
//       emitVoiceEvent(createTranscriptEvent(
//         text,
//         role,
//         state.sessionId || undefined
//       ));
//     });

//     // Audio data events
//     client.on('onAudioData', async (audioData) => {
//       if (audioManagerRef.current) {
//         try {
//           await audioManagerRef.current.playPCMAudio(audioData, {
//             volume: preferences?.voiceSpeed || 1.0,
//             onStart: () => updateState({ aiSpeaking: true }),
//             onEnd: () => updateState({ aiSpeaking: false }),
//           });
//         } catch (error) {
//           console.error('Audio playback error:', error);
//         }
//       }
//     });

//     // Error events
//     client.on('onError', (error) => {
//       console.error('🚨 Voice client error:', error);
//       updateState({ error: error.message });
      
//       // Emit error event
//       emitVoiceEvent(createErrorEvent(error, state.sessionId || undefined));
//     });

//     // Session updates
//     client.on('onSessionUpdate', (sessionId) => {
//       updateState({ sessionId, lastActivity: new Date() });
//       console.log(`📅 Session updated: ${sessionId}`);
//     });

//   }, [updateState, preferences, state.sessionId]);

//   /**
//    * Start a real-time voice session
//    */
//   const startSession = useCallback(async (options: MastraVoiceOptions = {}): Promise<void> => {
//     if (!state.isInitialized) {
//       await initializeVoice();
//     }

//     if (!voiceClientRef.current) {
//       throw new Error('Voice client not initialized');
//     }

//     try {
//       console.log('🚀 Starting real-time voice session...');
      
//       const sessionOptions: RealtimeSessionOptions = {
//         conversationId: options.conversationId,
//         instructions: options.instructions,
//         voice: (options.voiceId as any) || preferences?.preferredVoice || 'alloy',
//         autoStart: options.autoStart !== false,
//       };

//       await voiceClientRef.current.connect(sessionOptions);
      
//       updateState({ 
//         sessionActive: true,
//         isListening: sessionOptions.autoStart !== false,
//         lastActivity: new Date() 
//       });

//       console.log('✅ Real-time voice session started');

//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Failed to start session';
//       console.error('❌ Failed to start voice session:', error);
      
//       updateState({ error: errorMessage });
//       throw new Error(`Failed to start voice session: ${errorMessage}`);
//     }
//   }, [state.isInitialized, initializeVoice, preferences, updateState]);

//   /**
//    * End the current voice session
//    */
//   const endSession = useCallback(async (): Promise<void> => {
//     if (!voiceClientRef.current || !state.sessionActive) {
//       console.log('🔇 No active voice session to end');
//       return;
//     }

//     try {
//       console.log('🛑 Ending real-time voice session...');
      
//       await voiceClientRef.current.disconnect();
      
//       updateState({ 
//         sessionActive: false,
//         isListening: false,
//         userSpeaking: false,
//         aiSpeaking: false,
//         sessionId: null,
//         audioLevel: 0 
//       });

//       console.log('✅ Real-time voice session ended');

//     } catch (error) {
//       console.error('❌ Error ending voice session:', error);
//       updateState({ error: error instanceof Error ? error.message : 'Failed to end session' });
//     }
//   }, [state.sessionActive, updateState]);

//   /**
//    * Speak text using real-time voice
//    */
//   const speak = useCallback(async (text: string, interrupt: boolean = false): Promise<void> => {
//     if (!voiceClientRef.current || !state.sessionActive) {
//       throw new Error('Voice session not active');
//     }

//     try {
//       console.log(`🗣️ Speaking text: "${text.substring(0, 50)}..."`);
      
//       await voiceClientRef.current.speak(text);
//       updateState({ lastActivity: new Date() });

//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Failed to speak';
//       console.error('❌ Failed to speak:', error);
//       updateState({ error: errorMessage });
//       throw new Error(`Failed to speak: ${errorMessage}`);
//     }
//   }, [state.sessionActive, updateState]);

//   /**
//    * Start listening for user input
//    */
//   const startListening = useCallback(async (): Promise<void> => {
//     if (!voiceClientRef.current || !state.sessionActive) {
//       throw new Error('Voice session not active');
//     }

//     try {
//       console.log('🎤 Starting to listen...');
      
//       await voiceClientRef.current.startListening();
//       updateState({ isListening: true, lastActivity: new Date() });

//     } catch (error) {
//       const errorMessage = error instanceof Error ? error.message : 'Failed to start listening';
//       console.error('❌ Failed to start listening:', error);
//       updateState({ error: errorMessage });
//       throw new Error(`Failed to start listening: ${errorMessage}`);
//     }
//   }, [state.sessionActive, updateState]);

//   /**
//    * Stop listening for user input
//    */
//   const stopListening = useCallback(async (): Promise<void> => {
//     if (!voiceClientRef.current) {
//       return;
//     }

//     try {
//       console.log('🔇 Stopping listening...');
      
//       await voiceClientRef.current.stopListening();
//       updateState({ isListening: false, userSpeaking: false, audioLevel: 0 });

//     } catch (error) {
//       console.error('❌ Error stopping listening:', error);
//     }
//   }, [updateState]);

//   /**
//    * Update session instructions
//    */
//   const updateInstructions = useCallback(async (instructions: string): Promise<void> => {
//     if (!voiceClientRef.current || !state.sessionActive) {
//       throw new Error('Voice session not active');
//     }

//     try {
//       await voiceClientRef.current.updateConfig({ instructions });
//       console.log('⚙️ Session instructions updated');
//     } catch (error) {
//       console.error('❌ Failed to update instructions:', error);
//       throw error;
//     }
//   }, [state.sessionActive]);

//   /**
//    * Update voice settings
//    */
//   const updateVoice = useCallback(async (voiceId: string): Promise<void> => {
//     if (!voiceClientRef.current || !state.sessionActive) {
//       throw new Error('Voice session not active');
//     }

//     try {
//       await voiceClientRef.current.updateConfig({ voice: voiceId as any });
//       console.log(`🎵 Voice updated to: ${voiceId}`);
//     } catch (error) {
//       console.error('❌ Failed to update voice:', error);
//       throw error;
//     }
//   }, [state.sessionActive]);

//   // ==========================================
//   // EVENT SUBSCRIPTION HELPERS
//   // ==========================================

//     const onTranscript = useCallback((handler: (text: string, role: 'user' | 'assistant') => void) => {
//     return globalVoiceEvents.on('transcript_received', (event: VoiceEvent) => {
//         // Check if the event is of the correct type
//         if ('text' in event && 'role' in event) {
//         handler(event.text, event.role);
//         } else {
//         console.error("Received event does not have the expected properties:", event);
//         }
//     });
//     }, []);

//   const onAudioLevel = useCallback((handler: (level: number) => void) => {
//     return globalVoiceEvents.on('audio_level_changed', (event) => {
//       if ('level' in event && typeof event.level === 'number') {
//         handler(event.level);
//       } else {
//         console.error("Received audio_level_changed event without 'level' property:", event);
//       }
//     });
//   }, []);

//   const onError = useCallback((handler: (error: VoiceError) => void) => {
//     return globalVoiceEvents.on('error_occurred', (event) => {
//       if ('error' in event) {
//         handler(event.error);
//       } else {
//         console.error("Received error_occurred event without 'error' property:", event);
//       }
//     });
//   }, []);

//   // ==========================================
//   // CLEANUP EFFECTS
//   // ==========================================

//   // Auto-initialize when conditions are met
//   useEffect(() => {
//     if (
//       user && 
//       isLoaded && 
//       preferences && 
//       isVoiceEnabled && 
//       preferences.voiceEnabled && 
//       !state.isInitialized && 
//       !isInitializingRef.current
//     ) {
//       console.log('🎤 Auto-initializing voice client...');
//       initializeVoice().catch(error => {
//         console.error('Auto-initialization failed:', error);
//       });
//     }
//   }, [user, isLoaded, preferences, isVoiceEnabled, state.isInitialized, initializeVoice]);

//   // Cleanup on unmount
//   useEffect(() => {
//     return () => {
//       console.log('🧹 Cleaning up Mastra voice client...');
      
//       // End session
//       if (state.sessionActive && voiceClientRef.current) {
//         voiceClientRef.current.disconnect().catch(console.error);
//       }
      
//       // Dispose audio manager
//       if (audioManagerRef.current) {
//         audioManagerRef.current.dispose();
//       }
      
//       // Clear refs
//       voiceClientRef.current = null;
//       audioManagerRef.current = null;
//     };
//   }, [state.sessionActive]);

//   // ==========================================
//   // RETURN INTERFACE
//   // ==========================================

//   return {
//     // State
//     state,
//     isConnected: state.connectionStatus === 'connected',
//     isSessionActive: state.sessionActive,
//     canSpeak: state.sessionActive && state.connectionStatus === 'connected' && !state.aiSpeaking,
    
//     // Actions - Session Management
//     initializeVoice,
//     startSession,
//     endSession,
    
//     // Actions - Communication  
//     speak,
//     startListening,
//     stopListening,
    
//     // Actions - Configuration
//     updateInstructions,
//     updateVoice,
    
//     // Utilities
//     clearError,
//     checkSupport,
    
//     // Event Handlers
//     onTranscript,
//     onAudioLevel,
//     onError,
//   };
// }
// src/hooks/use-mastra-voice.ts
// React hook for Mastra Real-time Voice integration

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useVoicePreferences } from './use-voice-preferences';
import { 
  BrowserRealtimeVoice, 
  createBrowserRealtimeVoice,
  type BrowserRealtimeState,
  type BrowserRealtimeEvents 
} from '@/lib/mastra/browser-realtime-voice';
import { 
  BrowserAudioManager, 
  createBrowserAudioManager,
  type AudioPlaybackOptions 
} from '@/lib/mastra/browser-audio';
import { 
  globalVoiceEvents,
  emitVoiceEvent,
  createTranscriptEvent,
  createSpeakingEvent,
  createErrorEvent,
  VoiceEvent
} from '@/lib/mastra/voice-events';
import {
  VoiceState,
  VoiceError,
  VoiceSessionStats,
} from '@/lib/voice/voice-types';

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface MastraVoiceState {
  // Connection & Session
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  sessionActive: boolean;
  sessionId: string | null;
  isReady: boolean;
  
  // Audio State
  userSpeaking: boolean;
  aiSpeaking: boolean;
  audioLevel: number;
  isListening: boolean;
  
  // System State
  isInitialized: boolean;
  isSupported: boolean;
  hasPermissions: boolean;
  
  // Error State
  error: string | null;
  lastActivity: Date | null;
}

export interface MastraVoiceOptions {
  conversationId?: string;
  instructions?: string;
  voiceId?: string;
  autoStart?: boolean;
  enableFallback?: boolean;
}

export interface UseMastraVoiceReturn {
  // State
  state: MastraVoiceState;
  isConnected: boolean;
  isSessionActive: boolean;
  canSpeak: boolean;
  
  // Actions - Session Management
  initializeVoice: () => Promise<void>;
  startSession: (options?: MastraVoiceOptions) => Promise<void>;
  endSession: () => Promise<void>;
  
  // Actions - Communication
  speak: (text: string, interrupt?: boolean) => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  
  // Actions - Configuration
  updateInstructions: (instructions: string) => Promise<void>;
  updateVoice: (voiceId: string) => Promise<void>;
  
  // Utilities
  clearError: () => void;
  checkSupport: () => Promise<{ supported: boolean; errors: string[] }>;
  
  // Event Handlers (for custom integration)
  onTranscript: (handler: (text: string, role: 'user' | 'assistant') => void) => () => void;
  onAudioLevel: (handler: (level: number) => void) => () => void;
  onError: (handler: (error: VoiceError) => void) => () => void;
}

// ==========================================
// MAIN HOOK
// ==========================================

/**
 * React hook for Mastra Real-time Voice integration
 * 
 * Integrates with your existing voice preferences and provides real-time
 * speech-to-speech communication as a replacement for the TTS/STT flow
 */
export function useMastraVoice(): UseMastraVoiceReturn {
  const { user, isLoaded } = useUser();
  const { preferences, isVoiceEnabled } = useVoicePreferences();
  
  // Core state
  const [state, setState] = useState<MastraVoiceState>({
    connectionStatus: 'disconnected',
    sessionActive: false,
    sessionId: null,
    isReady: false,
    userSpeaking: false,
    aiSpeaking: false,
    audioLevel: 0,
    isListening: false,
    isInitialized: false,
    isSupported: false,
    hasPermissions: false,
    error: null,
    lastActivity: null,
  });

  // Refs for client instances
  const voiceClientRef = useRef<BrowserRealtimeVoice | null>(null);
  const audioManagerRef = useRef<BrowserAudioManager | null>(null);
  const isInitializingRef = useRef(false);

  /**
   * Clear any existing errors
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Update state helper
   */
  const updateState = useCallback((updates: Partial<MastraVoiceState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Check browser and device support for real-time voice
   */
  const checkSupport = useCallback(async (): Promise<{ supported: boolean; errors: string[] }> => {
    try {
      const errors: string[] = [];
      
      // Check browser APIs
      if (!window.WebSocket) {
        errors.push('WebSocket API not available');
      }
      
      if (!window.AudioContext && !(window as any).webkitAudioContext) {
        errors.push('Web Audio API not available');
      }
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        errors.push('MediaDevices API not available');
      }
      
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        errors.push('HTTPS required for microphone access');
      }
      
      const supported = errors.length === 0;
      
      updateState({ 
        isSupported: supported,
        hasPermissions: supported 
      });
      
      return { supported, errors };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Support check failed';
      updateState({ error: errorMessage, isSupported: false });
      return { supported: false, errors: [errorMessage] };
    }
  }, [updateState]);

  /**
   * Initialize the Mastra voice client and audio manager
   */
  const initializeVoice = useCallback(async (): Promise<void> => {
    if (isInitializingRef.current || state.isInitialized) {
      console.log('🎤 Voice already initialized or initializing');
      return;
    }

    if (!user || !isLoaded || !preferences) {
      console.log('🔄 User/preferences not ready for voice initialization');
      return;
    }

    if (!isVoiceEnabled || !preferences.voiceEnabled) {
      console.log('🔇 Voice disabled in preferences');
      return;
    }

    try {
      isInitializingRef.current = true;
      updateState({ error: null });

      console.log('🎤 Initializing Mastra real-time voice client...');

      // Check support first
      const support = await checkSupport();
      if (!support.supported) {
        throw new Error(`Real-time voice not supported: ${support.errors.join(', ')}`);
      }

      // Initialize audio manager
      console.log('🔊 Creating browser audio manager...');
      audioManagerRef.current = createBrowserAudioManager({
        enableVisualization: preferences.voiceVisualizationEnabled ?? true,
      });
      await audioManagerRef.current.initialize();

      // Initialize voice client
      console.log('🎤 Creating browser real-time voice client...');
      voiceClientRef.current = createBrowserRealtimeVoice({
        voiceId: preferences.preferredVoice || 'alloy',
        language: preferences.voiceLanguage || 'en',
        speed: preferences.voiceSpeed || 1.0,
      });

      // Set up event handlers
      setupEventHandlers();

      // Initialize the client
      await voiceClientRef.current.initialize();

      updateState({ 
        isInitialized: true,
        isReady: true 
      });

      console.log('✅ Mastra real-time voice client initialized successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize voice';
      console.error('❌ Voice initialization failed:', error);
      
      updateState({ 
        error: errorMessage,
        isInitialized: false,
        isReady: false 
      });

      // Emit error event
      emitVoiceEvent(createErrorEvent({
        type: 'api_error',
        message: errorMessage,
        context: {
          provider: 'openai',
          operation: 'initialization',
          timestamp: new Date(),
        },
        retryable: true,
      }));

      throw error;
      
    } finally {
      isInitializingRef.current = false;
    }
  }, [user, isLoaded, preferences, isVoiceEnabled, state.isInitialized, updateState, checkSupport]);

  /**
   * Set up event handlers for the voice client
   */
  const setupEventHandlers = useCallback(() => {
    if (!voiceClientRef.current) return;

    const client = voiceClientRef.current;

    // Connection status changes
    client.on('onConnectionChange', (status) => {
      updateState({ connectionStatus: status });
      console.log(`🔗 Connection status changed: ${status}`);
    });

    // User speaking events
    client.on('onUserSpeaking', (speaking) => {
      updateState({ userSpeaking: speaking });
      
      // Emit voice events
      emitVoiceEvent(createSpeakingEvent(
        speaking ? 'user_speaking_start' : 'user_speaking_end',
        state.sessionId || undefined
      ));
      
      console.log(`🎤 User ${speaking ? 'started' : 'stopped'} speaking`);
    });

    // AI speaking events
    client.on('onAiSpeaking', (speaking) => {
      updateState({ aiSpeaking: speaking });
      
      // Emit voice events
      emitVoiceEvent(createSpeakingEvent(
        speaking ? 'ai_speaking_start' : 'ai_speaking_end',
        state.sessionId || undefined
      ));
      
      console.log(`🤖 AI ${speaking ? 'started' : 'stopped'} speaking`);
    });

    // Audio level updates
    client.on('onAudioLevel', (level) => {
      updateState({ audioLevel: level });
    });

    // Transcript events
    client.on('onTranscript', (text, role) => {
      console.log(`📝 Transcript (${role}): ${text}`);
      
      // Emit transcript event
      emitVoiceEvent(createTranscriptEvent(
        text,
        role,
        state.sessionId || undefined
      ));
    });

    // Audio data events
    client.on('onAudioData', async (audioData) => {
      if (audioManagerRef.current) {
        try {
          await audioManagerRef.current.playPCMAudio(audioData, {
            volume: preferences?.voiceSpeed || 1.0,
            onStart: () => updateState({ aiSpeaking: true }),
            onEnd: () => updateState({ aiSpeaking: false }),
          });
        } catch (error) {
          console.error('Audio playback error:', error);
        }
      }
    });

    // Error events
    client.on('onError', (error) => {
      console.error('🚨 Voice client error:', error);
      updateState({ error: error.message });
      
      // Emit error event
      emitVoiceEvent(createErrorEvent(error, state.sessionId || undefined));
    });

    // Session updates
    client.on('onSessionUpdate', (sessionId) => {
      updateState({ sessionId, lastActivity: new Date() });
      console.log(`📅 Session updated: ${sessionId}`);
    });

  }, [updateState, preferences, state.sessionId]);

  /**
   * Start a real-time voice session
   */
  const startSession = useCallback(async (options: MastraVoiceOptions = {}): Promise<void> => {
    if (!state.isInitialized) {
      await initializeVoice();
    }

    if (!voiceClientRef.current) {
      throw new Error('Voice client not initialized');
    }

    try {
      console.log('🚀 Starting real-time voice session...');
      
      const sessionOptions = {
        instructions: options.instructions,
        voice: (options.voiceId as any) || preferences?.preferredVoice || 'alloy',
      };

      await voiceClientRef.current.connect(sessionOptions);
      
      updateState({ 
        sessionActive: true,
        isListening: options.autoStart !== false,
        lastActivity: new Date() 
      });

      console.log('✅ Real-time voice session started');

      // Auto-start listening if requested
      if (options.autoStart !== false) {
        await voiceClientRef.current.startListening();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start session';
      console.error('❌ Failed to start voice session:', error);
      
      updateState({ error: errorMessage });
      throw new Error(`Failed to start voice session: ${errorMessage}`);
    }
  }, [state.isInitialized, initializeVoice, preferences, updateState]);

  /**
   * End the current voice session
   */
  const endSession = useCallback(async (): Promise<void> => {
    if (!voiceClientRef.current || !state.sessionActive) {
      console.log('🔇 No active voice session to end');
      return;
    }

    try {
      console.log('🛑 Ending real-time voice session...');
      
      await voiceClientRef.current.disconnect();
      
      updateState({ 
        sessionActive: false,
        isListening: false,
        userSpeaking: false,
        aiSpeaking: false,
        sessionId: null,
        audioLevel: 0 
      });

      console.log('✅ Real-time voice session ended');

    } catch (error) {
      console.error('❌ Error ending voice session:', error);
      updateState({ error: error instanceof Error ? error.message : 'Failed to end session' });
    }
  }, [state.sessionActive, updateState]);

  /**
   * Speak text using real-time voice
   */
  const speak = useCallback(async (text: string, interrupt: boolean = false): Promise<void> => {
    if (!voiceClientRef.current || !state.sessionActive) {
      throw new Error('Voice session not active');
    }

    try {
      console.log(`🗣️ Speaking text: "${text.substring(0, 50)}..."`);
      
      await voiceClientRef.current.speak(text);
      updateState({ lastActivity: new Date() });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to speak';
      console.error('❌ Failed to speak:', error);
      updateState({ error: errorMessage });
      throw new Error(`Failed to speak: ${errorMessage}`);
    }
  }, [state.sessionActive, updateState]);

  /**
   * Start listening for user input
   */
  const startListening = useCallback(async (): Promise<void> => {
    if (!voiceClientRef.current || !state.sessionActive) {
      throw new Error('Voice session not active');
    }

    try {
      console.log('🎤 Starting to listen...');
      
      await voiceClientRef.current.startListening();
      updateState({ isListening: true, lastActivity: new Date() });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start listening';
      console.error('❌ Failed to start listening:', error);
      updateState({ error: errorMessage });
      throw new Error(`Failed to start listening: ${errorMessage}`);
    }
  }, [state.sessionActive, updateState]);

  /**
   * Stop listening for user input
   */
  const stopListening = useCallback(async (): Promise<void> => {
    if (!voiceClientRef.current) {
      return;
    }

    try {
      console.log('🔇 Stopping listening...');
      
      await voiceClientRef.current.stopListening();
      updateState({ isListening: false, userSpeaking: false, audioLevel: 0 });

    } catch (error) {
      console.error('❌ Error stopping listening:', error);
    }
  }, [updateState]);

  /**
   * Update session instructions
   */
  const updateInstructions = useCallback(async (instructions: string): Promise<void> => {
    if (!voiceClientRef.current || !state.sessionActive) {
      throw new Error('Voice session not active');
    }

    try {
      // For browser client, we'd need to reconnect with new instructions
      console.log('⚙️ Instructions update requested (requires reconnection)');
      // TODO: Implement reconnection with new instructions
    } catch (error) {
      console.error('❌ Failed to update instructions:', error);
      throw error;
    }
  }, [state.sessionActive]);

  /**
   * Update voice settings
   */
  const updateVoice = useCallback(async (voiceId: string): Promise<void> => {
    if (!voiceClientRef.current || !state.sessionActive) {
      throw new Error('Voice session not active');
    }

    try {
      // For browser client, we'd need to reconnect with new voice
      console.log(`🎵 Voice update requested (requires reconnection): ${voiceId}`);
      // TODO: Implement reconnection with new voice
    } catch (error) {
      console.error('❌ Failed to update voice:', error);
      throw error;
    }
  }, [state.sessionActive]);

  // ==========================================
  // EVENT SUBSCRIPTION HELPERS
  // ==========================================

    const onTranscript = useCallback((handler: (text: string, role: 'user' | 'assistant') => void) => {
    return globalVoiceEvents.on('transcript_received', (event: VoiceEvent) => {
        // Check if the event is of the correct type
        if ('text' in event && 'role' in event) {
        handler(event.text, event.role);
        } else {
        console.error("Received event does not have the expected properties:", event);
        }
    });
    }, []);

  const onAudioLevel = useCallback((handler: (level: number) => void) => {
    return globalVoiceEvents.on('audio_level_changed', (event) => {
      if ('level' in event && typeof event.level === 'number') {
        handler(event.level);
      } else {
        console.error("Received audio_level_changed event without 'level' property:", event);
      }
    });
  }, []);

  const onError = useCallback((handler: (error: VoiceError) => void) => {
    return globalVoiceEvents.on('error_occurred', (event) => {
      if ('error' in event) {
        handler(event.error);
      } else {
        console.error("Received error_occurred event without 'error' property:", event);
      }
    });
  }, []);

  // ==========================================
  // CLEANUP EFFECTS
  // ==========================================

  // Auto-initialize when conditions are met
  useEffect(() => {
    if (
      user && 
      isLoaded && 
      preferences && 
      isVoiceEnabled && 
      preferences.voiceEnabled && 
      !state.isInitialized && 
      !isInitializingRef.current
    ) {
      console.log('🎤 Auto-initializing voice client...');
      initializeVoice().catch(error => {
        console.error('Auto-initialization failed:', error);
      });
    }
  }, [user, isLoaded, preferences, isVoiceEnabled, state.isInitialized, initializeVoice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up Mastra voice client...');
      
      // End session
      if (state.sessionActive && voiceClientRef.current) {
        voiceClientRef.current.disconnect().catch(console.error);
      }
      
      // Dispose audio manager
      if (audioManagerRef.current) {
        audioManagerRef.current.dispose();
      }
      
      // Clear refs
      voiceClientRef.current = null;
      audioManagerRef.current = null;
    };
  }, [state.sessionActive]);

  // ==========================================
  // RETURN INTERFACE
  // ==========================================

  return {
    // State
    state,
    isConnected: state.connectionStatus === 'connected',
    isSessionActive: state.sessionActive,
    canSpeak: state.sessionActive && state.connectionStatus === 'connected' && !state.aiSpeaking,
    
    // Actions - Session Management
    initializeVoice,
    startSession,
    endSession,
    
    // Actions - Communication  
    speak,
    startListening,
    stopListening,
    
    // Actions - Configuration
    updateInstructions,
    updateVoice,
    
    // Utilities
    clearError,
    checkSupport,
    
    // Event Handlers
    onTranscript,
    onAudioLevel,
    onError,
  };
}