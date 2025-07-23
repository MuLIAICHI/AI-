// src/lib/voice/voice-types.ts
// Foundation types and constants for voice integration

// ==========================================
// CORE VOICE INTERFACES
// ==========================================

/**
 * Supported voice providers
 */
export type VoiceProvider = 'openai' | 'elevenlabs' | 'playai' | 'google' | 'azure';

/**
 * Voice quality settings
 */
export type VoiceQuality = 'standard' | 'hd';

/**
 * Voice latency optimization modes
 */
export type VoiceLatencyMode = 'low' | 'balanced' | 'quality';

/**
 * Types of voice sessions for analytics
 */
export type VoiceSessionType = 'tts_only' | 'stt_only' | 'realtime' | 'mixed';

/**
 * Voice processing states
 */
export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

/**
 * Voice input modes
 */
export type VoiceInputMode = 'push_to_talk' | 'continuous' | 'voice_activation';

// ==========================================
// OPENAI VOICE TYPES
// ==========================================

/**
 * Available OpenAI voices with personality descriptions
 */
export type OpenAIVoiceId = 'alloy' | 'nova' | 'shimmer' | 'echo' | 'fable' | 'onyx';

/**
 * OpenAI voice characteristics
 */
export interface OpenAIVoiceProfile {
  id: OpenAIVoiceId;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  personality: string;
  description: string;
  bestFor: string[];
  tone: string;
  accent: string;
}

/**
 * OpenAI Realtime API configuration
 */
export interface OpenAIRealtimeConfig {
  model: string;
  voice: OpenAIVoiceId;
  temperature?: number;
  maxTokens?: number;
  vadSettings?: {
    threshold: number;
    prefixPaddingMs: number;
    silenceDurationMs: number;
  };
  audioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  sampleRate?: number;
}

/**
 * OpenAI TTS configuration
 */
export interface OpenAITTSConfig {
  model: 'tts-1' | 'tts-1-hd';
  voice: OpenAIVoiceId;
  speed?: number; // 0.25 to 4.0
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
}

// ==========================================
// VOICE CONFIGURATION INTERFACES
// ==========================================

/**
 * Complete voice configuration for a user
 */
export interface VoiceConfig {
  // Basic settings
  enabled: boolean;
  provider: VoiceProvider;
  voiceId: string;
  language: string;
  
  // Quality and performance
  speed: number; // 0.5 to 2.0
  quality: VoiceQuality;
  latencyMode: VoiceLatencyMode;
  
  // Behavior settings
  autoplay: boolean;
  inputEnabled: boolean;
  outputEnabled: boolean;
  interruptionsEnabled: boolean;
  visualizationEnabled: boolean;
  
  // Input settings
  inputMode: VoiceInputMode;
  microphoneSensitivity: number; // 0.0 to 1.0
  noiseSuppression: boolean;
  
  // Agent-specific overrides
  agentOverrides?: Record<string, Partial<VoiceConfig>>;
}

/**
 * Voice preferences from database (mapped to VoiceConfig)
 */
export interface VoicePreferences {
  voiceEnabled: boolean;
  voiceLanguage: string;
  voiceSpeed: number;
  voiceProvider: VoiceProvider;
  preferredVoice: string;
  voiceAutoplay: boolean;
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;
  voiceInterruptionsEnabled: boolean;
  voiceVisualizationEnabled: boolean;
  voiceQuality: VoiceQuality;
  voiceLatencyMode: VoiceLatencyMode;
}

// ==========================================
// VOICE SESSION INTERFACES
// ==========================================

/**
 * Voice session metadata
 */
export interface VoiceSessionInfo {
  id: string;
  userId: string;
  conversationId: string;
  sessionType: VoiceSessionType;
  provider: VoiceProvider;
  language: string;
  voiceId?: string;
  startedAt: Date;
  endedAt?: Date;
}

/**
 * Voice session statistics
 */
export interface VoiceSessionStats {
  totalDuration: number;
  messagesCount: number;
  userSpeechDuration: number;
  agentSpeechDuration: number;
  interruptionsCount: number;
  averageLatency: number;
  errorCount: number;
  successRate: number;
}

/**
 * Real-time voice session state
 */
export interface VoiceSessionState {
  sessionId: string;
  isActive: boolean;
  currentState: VoiceState;
  isConnected: boolean;
  isMuted: boolean;
  volume: number; // 0.0 to 1.0
  
  // Current audio info
  isUserSpeaking: boolean;
  isAgentSpeaking: boolean;
  audioLevel: number; // 0.0 to 1.0
  
  // Session metrics
  sessionDuration: number;
  messageCount: number;
  lastActivity: Date;
}

// ==========================================
// AUDIO PROCESSING INTERFACES
// ==========================================

/**
 * Audio stream configuration
 */
export interface AudioStreamConfig {
  sampleRate: number;
  channelCount: number;
  bitDepth: number;
  format: 'pcm' | 'mp3' | 'wav' | 'ogg';
  bufferSize?: number;
}

/**
 * Audio metadata for messages
 */
export interface AudioMetadata {
  duration: number;
  format: string;
  bitrate?: number;
  fileSize?: number;
  language?: string;
  voiceId?: string;
  provider?: VoiceProvider;
  processingTime?: number;
  isRealtime?: boolean;
  interruptedAt?: number;
}

/**
 * Voice activity detection result
 */
export interface VoiceActivityResult {
  isSpeaking: boolean;
  confidence: number; // 0.0 to 1.0
  audioLevel: number; // 0.0 to 1.0
  timestamp: number;
}

// ==========================================
// ERROR HANDLING TYPES
// ==========================================

/**
 * Voice-related error types
 */
export type VoiceErrorType = 
  | 'permission_denied'
  | 'microphone_unavailable'
  | 'network_error'
  | 'api_error'
  | 'audio_processing_error'
  | 'unsupported_format'
  | 'rate_limit_exceeded'
  | 'invalid_configuration'
  | 'connection_lost'
  | 'timeout_error';

/**
 * Voice error with context
 */
export interface VoiceError {
  type: VoiceErrorType;
  message: string;
  code?: string;
  context?: {
    provider?: VoiceProvider;
    operation?: string;
    timestamp?: Date;
    details?: Record<string, any>;
  };
  retryable: boolean;
  suggestedAction?: string;
}

// ==========================================
// AGENT-SPECIFIC VOICE TYPES
// ==========================================

/**
 * Voice personality configuration for agents
 */
export interface AgentVoiceProfile {
  agentId: string;
  voiceId: string;
  personality: {
    tone: string; // "friendly", "professional", "encouraging"
    pace: 'slow' | 'normal' | 'fast';
    emphasis: 'subtle' | 'moderate' | 'strong';
    pauseBehavior: 'minimal' | 'natural' | 'deliberate';
  };
  instructions: {
    speakingStyle: string;
    specialHandling?: string[];
    pronunciationGuide?: Record<string, string>;
  };
}

/**
 * Voice routing information
 */
export interface VoiceRoutingContext {
  fromAgent?: string;
  toAgent: string;
  transitionMessage?: string;
  voiceSettings?: Partial<VoiceConfig>;
  language?: string;
}

// ==========================================
// CONSTANTS AND ENUMS
// ==========================================

/**
 * Default voice configurations
 */
export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  enabled: false,
  provider: 'openai',
  voiceId: 'alloy',
  language: 'en',
  speed: 1.0,
  quality: 'standard',
  latencyMode: 'balanced',
  autoplay: true,
  inputEnabled: true,
  outputEnabled: true,
  interruptionsEnabled: true,
  visualizationEnabled: true,
  inputMode: 'push_to_talk',
  microphoneSensitivity: 0.6,
  noiseSuppression: true,
};

/**
 * OpenAI voice profiles with personality information
 */
export const OPENAI_VOICES: Record<OpenAIVoiceId, OpenAIVoiceProfile> = {
  alloy: {
    id: 'alloy',
    name: 'Alloy',
    gender: 'neutral',
    personality: 'balanced and versatile',
    description: 'A balanced voice suitable for most interactions',
    bestFor: ['general use', 'tutorials', 'explanations'],
    tone: 'neutral and clear',
    accent: 'american',
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    gender: 'female',
    personality: 'warm and friendly',
    description: 'Warm and approachable voice, great for learning',
    bestFor: ['education', 'onboarding', 'support'],
    tone: 'friendly and encouraging',
    accent: 'american',
  },
  shimmer: {
    id: 'shimmer',
    name: 'Shimmer',
    gender: 'female',
    personality: 'energetic and upbeat',
    description: 'Bright and energetic voice for engaging conversations',
    bestFor: ['motivation', 'interactive content', 'young audiences'],
    tone: 'upbeat and enthusiastic',
    accent: 'american',
  },
  echo: {
    id: 'echo',
    name: 'Echo',
    gender: 'male',
    personality: 'calm and authoritative',
    description: 'Deep and authoritative voice for professional contexts',
    bestFor: ['business', 'formal presentations', 'serious topics'],
    tone: 'professional and confident',
    accent: 'american',
  },
  fable: {
    id: 'fable',
    name: 'Fable',
    gender: 'male',
    personality: 'wise and thoughtful',
    description: 'Thoughtful voice perfect for storytelling and guidance',
    bestFor: ['storytelling', 'wisdom sharing', 'guidance'],
    tone: 'thoughtful and wise',
    accent: 'american',
  },
  onyx: {
    id: 'onyx',
    name: 'Onyx',
    gender: 'male',
    personality: 'strong and confident',
    description: 'Strong and confident voice for leadership contexts',
    bestFor: ['leadership', 'decision making', 'challenges'],
    tone: 'strong and decisive',
    accent: 'american',
  },
};

/**
 * Language to voice ID mapping for international support
 */
export const LANGUAGE_VOICE_MAPPING: Record<string, {
  primary: OpenAIVoiceId;
  alternatives: OpenAIVoiceId[];
  rtlSupport?: boolean;
}> = {
  'en': { primary: 'alloy', alternatives: ['nova', 'shimmer', 'echo', 'fable', 'onyx'] },
  'es': { primary: 'nova', alternatives: ['alloy', 'shimmer'] },
  'fr': { primary: 'shimmer', alternatives: ['nova', 'alloy'] },
  'de': { primary: 'echo', alternatives: ['fable', 'alloy'] },
  'it': { primary: 'nova', alternatives: ['shimmer', 'alloy'] },
  'zh': { primary: 'alloy', alternatives: ['nova', 'echo'] },
  'ar': { primary: 'fable', alternatives: ['echo', 'onyx'], rtlSupport: true },
  'hi': { primary: 'nova', alternatives: ['alloy', 'shimmer'] },
};

/**
 * Agent to voice personality mapping
 */
export const AGENT_VOICE_MAPPING: Record<string, {
  defaultVoice: OpenAIVoiceId;
  personality: AgentVoiceProfile['personality'];
  alternatives: OpenAIVoiceId[];
}> = {
  router: {
    defaultVoice: 'alloy',
    personality: { tone: 'helpful', pace: 'normal', emphasis: 'moderate', pauseBehavior: 'natural' },
    alternatives: ['nova', 'echo'],
  },
  'digital-mentor': {
    defaultVoice: 'nova',
    personality: { tone: 'patient', pace: 'slow', emphasis: 'moderate', pauseBehavior: 'deliberate' },
    alternatives: ['alloy', 'shimmer'],
  },
  'finance-guide': {
    defaultVoice: 'echo',
    personality: { tone: 'professional', pace: 'normal', emphasis: 'strong', pauseBehavior: 'natural' },
    alternatives: ['fable', 'alloy'],
  },
  'health-coach': {
    defaultVoice: 'shimmer',
    personality: { tone: 'encouraging', pace: 'normal', emphasis: 'moderate', pauseBehavior: 'natural' },
    alternatives: ['nova', 'alloy'],
  },
};

/**
 * Voice quality to configuration mapping
 */
export const VOICE_QUALITY_CONFIGS: Record<VoiceQuality, {
  model: string;
  bitrate: number;
  latency: 'low' | 'medium' | 'high';
  cost: 'low' | 'medium' | 'high';
}> = {
  standard: {
    model: 'tts-1',
    bitrate: 128,
    latency: 'low',
    cost: 'low',
  },
  hd: {
    model: 'tts-1-hd',
    bitrate: 320,
    latency: 'medium',
    cost: 'medium',
  },
};

/**
 * Voice error messages with user-friendly descriptions
 */
export const VOICE_ERROR_MESSAGES: Record<VoiceErrorType, {
  title: string;
  description: string;
  suggestedAction: string;
}> = {
  permission_denied: {
    title: 'Microphone Permission Required',
    description: 'Please allow microphone access to use voice features.',
    suggestedAction: 'Click "Allow" when prompted for microphone permissions.',
  },
  microphone_unavailable: {
    title: 'Microphone Not Available',
    description: 'No microphone detected on your device.',
    suggestedAction: 'Please connect a microphone and refresh the page.',
  },
  network_error: {
    title: 'Connection Problem',
    description: 'Unable to connect to voice services.',
    suggestedAction: 'Check your internet connection and try again.',
  },
  api_error: {
    title: 'Voice Service Error',
    description: 'The voice service is temporarily unavailable.',
    suggestedAction: 'Please try again in a few moments.',
  },
  audio_processing_error: {
    title: 'Audio Processing Failed',
    description: 'Unable to process the audio input or output.',
    suggestedAction: 'Try using text input instead, or refresh the page.',
  },
  unsupported_format: {
    title: 'Unsupported Audio Format',
    description: 'Your browser does not support the required audio format.',
    suggestedAction: 'Please update your browser or try a different one.',
  },
  rate_limit_exceeded: {
    title: 'Too Many Requests',
    description: 'Voice service rate limit exceeded.',
    suggestedAction: 'Please wait a moment before trying voice features again.',
  },
  invalid_configuration: {
    title: 'Configuration Error',
    description: 'Voice settings are invalid.',
    suggestedAction: 'Please reset your voice settings and try again.',
  },
  connection_lost: {
    title: 'Connection Lost',
    description: 'Voice connection was interrupted.',
    suggestedAction: 'Reconnecting automatically...',
  },
  timeout_error: {
    title: 'Request Timeout',
    description: 'Voice request took too long to complete.',
    suggestedAction: 'Please try again with a shorter message.',
  },
};

// ==========================================
// UTILITY TYPES
// ==========================================

/**
 * Type guard for voice errors
 */
export function isVoiceError(error: any): error is VoiceError {
  return error && 
         typeof error.type === 'string' && 
         typeof error.message === 'string' &&
         typeof error.retryable === 'boolean';
}

/**
 * Type guard for OpenAI voice IDs
 */
export function isOpenAIVoiceId(voiceId: string): voiceId is OpenAIVoiceId {
  return ['alloy', 'nova', 'shimmer', 'echo', 'fable', 'onyx'].includes(voiceId);
}

/**
 * Helper to get voice profile by ID
 */
export function getVoiceProfile(voiceId: string): OpenAIVoiceProfile | null {
  return isOpenAIVoiceId(voiceId) ? OPENAI_VOICES[voiceId] : null;
}

/**
 * Helper to get recommended voice for language
 */
export function getRecommendedVoice(language: string): OpenAIVoiceId {
  const mapping = LANGUAGE_VOICE_MAPPING[language];
  return mapping ? mapping.primary : 'alloy';
}

/**
 * Helper to get agent's default voice
 */
export function getAgentDefaultVoice(agentId: string): OpenAIVoiceId {
  const mapping = AGENT_VOICE_MAPPING[agentId];
  return mapping ? mapping.defaultVoice : 'alloy';
}
