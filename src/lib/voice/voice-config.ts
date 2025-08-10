// src/lib/voice/voice-config.ts
// Enhanced voice configuration with Mastra Real-time support

import {
  VoiceConfig,
  VoicePreferences,
  OpenAIVoiceId,
  OpenAIRealtimeConfig,
  OpenAITTSConfig,
  VoiceProvider,
  VoiceQuality,
  VoiceLatencyMode,
  AgentVoiceProfile,
  DEFAULT_VOICE_CONFIG,
  OPENAI_VOICES,
  LANGUAGE_VOICE_MAPPING,
  AGENT_VOICE_MAPPING,
  VOICE_QUALITY_CONFIGS,
  getRecommendedVoice,
  getAgentDefaultVoice,
  isOpenAIVoiceId,
} from './voice-types';

// ==========================================
// ENHANCED ENVIRONMENT CONFIGURATION
// ==========================================

/**
 * Real-time voice specific configuration
 */
export interface RealtimeVoiceConfig {
  enabled: boolean;
  model: string;
  defaultVoice: OpenAIVoiceId;
  temperature: number;
  maxTokens: number;
  vadSettings: {
    threshold: number;
    silenceDurationMs: number;
    prefixPaddingMs: number;
  };
  websocket: {
    timeout: number;
    reconnectAttempts: number;
    heartbeatInterval: number;
  };
  audio: {
    format: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
    sampleRate: number;
    bufferSize: number;
  };
  session: {
    maxDuration: number;
    requireAuth: boolean;
    maxDailySessions: number;
  };
  debug: {
    enabled: boolean;
    logAudioEvents: boolean;
    enableMetrics: boolean;
  };
}

/**
 * Enhanced voice environment configuration with real-time support
 */
export interface EnhancedVoiceEnvironmentConfig {
  openai: {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
    maxRetries?: number;
  };
  features: {
    realtimeEnabled: boolean;
    ttsEnabled: boolean;
    sttEnabled: boolean;
    voiceVisualizationEnabled: boolean;
    fallbackEnabled: boolean;
  };
  limits: {
    maxSessionDuration: number;
    maxMessageLength: number;
    maxConcurrentSessions: number;
    dailyUsageLimit: number;
  };
  audio: {
    sampleRate: number;
    channelCount: number;
    bufferSize: number;
    maxRecordingDuration: number;
  };
  // 🆕 NEW: Real-time specific configuration
  realtime: RealtimeVoiceConfig;
}

/**
 * Get enhanced environment configuration with real-time support
 */
export function getEnhancedVoiceEnvironmentConfig(): EnhancedVoiceEnvironmentConfig {
  // Base configuration (your existing setup)
  const baseConfig = {
    openai: {
      apiKey: "key",
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      timeout: parseInt(process.env.VOICE_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.VOICE_MAX_RETRIES || '3'),
    },
    features: {
      realtimeEnabled : true, 
      ttsEnabled: process.env.VOICE_TTS_ENABLED !== 'false',
      sttEnabled: process.env.VOICE_STT_ENABLED !== 'false',
      voiceVisualizationEnabled: process.env.VOICE_VISUALIZATION_ENABLED !== 'false',
      fallbackEnabled: process.env.VOICE_FALLBACK_ENABLED !== 'false', // 🆕 NEW
    },
    limits: {
      maxSessionDuration: parseInt(process.env.VOICE_MAX_SESSION_DURATION || '1800'),
      maxMessageLength: parseInt(process.env.VOICE_MAX_MESSAGE_LENGTH || '4000'),
      maxConcurrentSessions: parseInt(process.env.VOICE_MAX_CONCURRENT_SESSIONS || '5'),
      dailyUsageLimit: parseInt(process.env.VOICE_DAILY_LIMIT || '1000'),
    },
    audio: {
      sampleRate: parseInt(process.env.VOICE_SAMPLE_RATE || '24000'),
      channelCount: parseInt(process.env.VOICE_CHANNEL_COUNT || '1'),
      bufferSize: parseInt(process.env.VOICE_BUFFER_SIZE || '4096'),
      maxRecordingDuration: parseInt(process.env.VOICE_MAX_RECORDING_DURATION || '300'),
    },
  };

  // 🆕 NEW: Real-time configuration
  const realtimeConfig: RealtimeVoiceConfig = {
    enabled: true,
    model: process.env.REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-12-17',
    defaultVoice: (process.env.REALTIME_VOICE_DEFAULT as OpenAIVoiceId) || 'alloy',
    temperature: parseFloat(process.env.REALTIME_TEMPERATURE || '0.8'),
    maxTokens: parseInt(process.env.REALTIME_MAX_TOKENS || '1000'),
    vadSettings: {
      threshold: parseFloat(process.env.REALTIME_VAD_THRESHOLD || '0.6'),
      silenceDurationMs: parseInt(process.env.REALTIME_VAD_SILENCE_DURATION || '1200'),
      prefixPaddingMs: parseInt(process.env.REALTIME_VAD_PREFIX_PADDING || '300'),
    },
    websocket: {
      timeout: parseInt(process.env.REALTIME_WS_TIMEOUT || '30000'),
      reconnectAttempts: parseInt(process.env.REALTIME_WS_RECONNECT_ATTEMPTS || '3'),
      heartbeatInterval: parseInt(process.env.REALTIME_WS_HEARTBEAT_INTERVAL || '10000'),
    },
    audio: {
      format: (process.env.REALTIME_AUDIO_FORMAT as any) || 'pcm16',
      sampleRate: parseInt(process.env.REALTIME_SAMPLE_RATE || '24000'),
      bufferSize: parseInt(process.env.REALTIME_BUFFER_SIZE || '4096'),
    },
    session: {
      maxDuration: parseInt(process.env.REALTIME_SESSION_TTL || '1800'),
      requireAuth: process.env.REALTIME_REQUIRE_AUTH !== 'false',
      maxDailySessions: parseInt(process.env.REALTIME_MAX_DAILY_SESSIONS || '100'),
    },
    debug: {
      enabled: process.env.REALTIME_DEBUG_MODE === 'true',
      logAudioEvents: process.env.REALTIME_LOG_AUDIO_EVENTS === 'true',
      enableMetrics: process.env.REALTIME_ENABLE_METRICS !== 'false',
    },
  };

  return {
    ...baseConfig,
    realtime: realtimeConfig,
  };
}

// ==========================================
// REAL-TIME CONFIGURATION FACTORIES
// ==========================================

/**
 * Create Mastra OpenAI Realtime configuration
 */
export function createMastraRealtimeConfig(
  voice: OpenAIVoiceId = 'alloy',
  options?: Partial<OpenAIRealtimeConfig>
): OpenAIRealtimeConfig {
  const envConfig = getEnhancedVoiceEnvironmentConfig();
  const realtimeConfig = envConfig.realtime;
  
  return {
    model: realtimeConfig.model,
    voice: voice || realtimeConfig.defaultVoice,
    temperature: realtimeConfig.temperature,
    maxTokens: realtimeConfig.maxTokens,
    vadSettings: {
      threshold: realtimeConfig.vadSettings.threshold,
      prefixPaddingMs: realtimeConfig.vadSettings.prefixPaddingMs,
      silenceDurationMs: realtimeConfig.vadSettings.silenceDurationMs,
    },
    audioFormat: realtimeConfig.audio.format,
    sampleRate: realtimeConfig.audio.sampleRate,
    ...options,
  };
}

/**
 * Create voice configuration optimized for real-time use
 */
export function createRealtimeOptimizedVoiceConfig(
  preferences?: Partial<VoicePreferences>
): VoiceConfig {
  const envConfig = getEnhancedVoiceEnvironmentConfig();
  const defaultConfig = DEFAULT_VOICE_CONFIG;
  
  // Optimize for real-time performance
  const realtimeOptimizations: Partial<VoiceConfig> = {
    latencyMode: 'low',
    quality: 'standard', // Use standard quality for lower latency
    inputMode: 'continuous', // Enable continuous listening
    interruptionsEnabled: true, // Allow interruptions
    microphoneSensitivity: 0.6, // Balanced sensitivity
    noiseSuppression: true, // Enable noise suppression
  };

  return {
    ...defaultConfig,
    ...realtimeOptimizations,
    // Apply user preferences last
    ...(preferences && {
      enabled: preferences.voiceEnabled ?? true,
      provider: preferences.voiceProvider ?? 'openai',
      voiceId: preferences.preferredVoice ?? envConfig.realtime.defaultVoice,
      language: preferences.voiceLanguage ?? 'en',
      speed: preferences.voiceSpeed ?? 1.0,
      autoplay: preferences.voiceAutoplay ?? true,
      outputEnabled: preferences.voiceOutputEnabled ?? true,
      visualizationEnabled: preferences.voiceVisualizationEnabled ?? true,
    }),
  };
}

// ==========================================
// CONFIGURATION VALIDATION
// ==========================================

/**
 * Validate real-time voice configuration
 */
export interface RealtimeConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  readyForRealtime: boolean;
}

/**
 * Validate configuration for real-time voice
 */
export function validateRealtimeConfig(): RealtimeConfigValidationResult {
  const config = getEnhancedVoiceEnvironmentConfig();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables
  if (!config.openai.apiKey) {
    errors.push('OPENAI_API_KEY is required for real-time voice');
  }

  if (!config.realtime.enabled) {
    warnings.push('Real-time voice is disabled (VOICE_REALTIME_ENABLED=false)');
  }

  // Validate real-time model
  if (!config.realtime.model.includes('realtime')) {
    errors.push(`Invalid real-time model: ${config.realtime.model}`);
  }

  // Validate voice ID
  if (!isOpenAIVoiceId(config.realtime.defaultVoice)) {
    errors.push(`Invalid default voice: ${config.realtime.defaultVoice}`);
  }

  // Performance warnings
  if (config.realtime.vadSettings.threshold < 0.3 || config.realtime.vadSettings.threshold > 0.9) {
    warnings.push('VAD threshold should be between 0.3 and 0.9 for optimal performance');
  }

  if (config.realtime.audio.bufferSize < 2048 || config.realtime.audio.bufferSize > 8192) {
    warnings.push('Audio buffer size should be between 2048 and 8192 for stable performance');
  }

  // Check for HTTPS requirement (in browser environment)
  if (typeof window !== 'undefined' && location.protocol !== 'https:' && location.hostname !== 'localhost') {
    errors.push('HTTPS is required for microphone access in production');
  }

  const readyForRealtime = errors.length === 0 && config.realtime.enabled && !!config.openai.apiKey;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    readyForRealtime,
  };
}

/**
 * Get configuration status for debugging
 */
export function getConfigurationStatus() {
  const config = getEnhancedVoiceEnvironmentConfig();
  const validation = validateRealtimeConfig();
  
  return {
    environment: {
      hasApiKey: !!config.openai.apiKey,
      realtimeEnabled: config.realtime.enabled,
      fallbackEnabled: config.features.fallbackEnabled,
      debugMode: config.realtime.debug.enabled,
    },
    audio: {
      sampleRate: config.realtime.audio.sampleRate,
      bufferSize: config.realtime.audio.bufferSize,
      format: config.realtime.audio.format,
    },
    session: {
      maxDuration: config.realtime.session.maxDuration,
      requireAuth: config.realtime.session.requireAuth,
      maxDailySessions: config.realtime.session.maxDailySessions,
    },
    validation,
    recommendations: validation.warnings.length > 0 ? validation.warnings : [
      'Configuration looks good! Ready for real-time voice.',
    ],
  };
}

// ==========================================
// BACKWARD COMPATIBILITY
// ==========================================

/**
 * Legacy function - now enhanced with real-time support
 * @deprecated Use getEnhancedVoiceEnvironmentConfig instead
 */
export function getVoiceEnvironmentConfig() {
  const enhanced = getEnhancedVoiceEnvironmentConfig();
  // Return the original interface for backward compatibility
  return {
    openai: enhanced.openai,
    features: enhanced.features,
    limits: enhanced.limits,
    audio: enhanced.audio,
  };
}
// Add these exports to the END of your existing src/lib/voice/voice-config.ts file

// ==========================================
// EXPORTS FOR VOICE MANAGER COMPATIBILITY
// ==========================================

/**
 * Create OpenAI TTS configuration (required by voice-manager.ts)
 */
export function createOpenAITTSConfig(
  voice: OpenAIVoiceId = 'alloy',
  quality: VoiceQuality = 'standard',
  speed: number = 1.0
): OpenAITTSConfig {
  const qualityConfig = VOICE_QUALITY_CONFIGS[quality];
  
  return {
    model: qualityConfig.model as 'tts-1' | 'tts-1-hd',
    voice,
    speed: Math.max(0.25, Math.min(4.0, speed)), // Clamp between 0.25 and 4.0
    responseFormat: 'mp3',
  };
}

/**
 * Validate voice configuration (required by voice-manager.ts)
 */
export function validateVoiceConfig(config: VoiceConfig): VoiceConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Validate provider
  if (!['openai', 'elevenlabs', 'playai', 'google', 'azure'].includes(config.provider)) {
    errors.push(`Unsupported voice provider: ${config.provider}`);
  }

  // Validate OpenAI voice ID
  if (config.provider === 'openai' && !isOpenAIVoiceId(config.voiceId)) {
    errors.push(`Invalid OpenAI voice ID: ${config.voiceId}`);
    suggestions.push('Use one of: alloy, nova, shimmer, echo, fable, onyx');
  }

  // Validate speed
  if (config.speed < 0.25 || config.speed > 4.0) {
    errors.push(`Voice speed must be between 0.25 and 4.0, got: ${config.speed}`);
  }

  // Validate language
  if (!config.language || config.language.length < 2) {
    errors.push('Language must be specified (e.g., "en", "es", "fr")');
  }

  // Performance warnings
  if (config.quality === 'hd' && config.latencyMode === 'low') {
    warnings.push('HD quality with low latency may cause increased delays');
    suggestions.push('Consider using standard quality for low latency mode');
  }

  if (config.speed > 1.5 && config.quality === 'hd') {
    warnings.push('High speed with HD quality may affect voice naturalness');
  }

  // Accessibility suggestions
  if (config.speed > 1.3) {
    suggestions.push('Consider slower speeds for better accessibility');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

// Also need this interface for validation
export interface VoiceConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}