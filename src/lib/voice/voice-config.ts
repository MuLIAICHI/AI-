// src/lib/voice/voice-config.ts
// Voice provider configurations and setup helpers

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
// ENVIRONMENT CONFIGURATION
// ==========================================

/**
 * Voice service environment configuration
 */
export interface VoiceEnvironmentConfig {
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
  };
  limits: {
    maxSessionDuration: number; // seconds
    maxMessageLength: number; // characters
    maxConcurrentSessions: number;
    dailyUsageLimit: number; // API calls
  };
  audio: {
    sampleRate: number;
    channelCount: number;
    bufferSize: number;
    maxRecordingDuration: number; // seconds
  };
}

/**
 * Get environment configuration with defaults
 */
export function getVoiceEnvironmentConfig(): VoiceEnvironmentConfig {
  return {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      timeout: parseInt(process.env.VOICE_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.VOICE_MAX_RETRIES || '3'),
    },
    features: {
      realtimeEnabled: process.env.VOICE_REALTIME_ENABLED === 'true',
      ttsEnabled: process.env.VOICE_TTS_ENABLED !== 'false', // default true
      sttEnabled: process.env.VOICE_STT_ENABLED !== 'false', // default true
      voiceVisualizationEnabled: process.env.VOICE_VISUALIZATION_ENABLED !== 'false', // default true
    },
    limits: {
      maxSessionDuration: parseInt(process.env.VOICE_MAX_SESSION_DURATION || '1800'), // 30 minutes
      maxMessageLength: parseInt(process.env.VOICE_MAX_MESSAGE_LENGTH || '4000'),
      maxConcurrentSessions: parseInt(process.env.VOICE_MAX_CONCURRENT_SESSIONS || '5'),
      dailyUsageLimit: parseInt(process.env.VOICE_DAILY_LIMIT || '1000'),
    },
    audio: {
      sampleRate: parseInt(process.env.VOICE_SAMPLE_RATE || '24000'),
      channelCount: parseInt(process.env.VOICE_CHANNEL_COUNT || '1'),
      bufferSize: parseInt(process.env.VOICE_BUFFER_SIZE || '4096'),
      maxRecordingDuration: parseInt(process.env.VOICE_MAX_RECORDING_DURATION || '300'), // 5 minutes
    },
  };
}

// ==========================================
// OPENAI PROVIDER CONFIGURATIONS
// ==========================================

/**
 * OpenAI Realtime API configuration factory
 */
export function createOpenAIRealtimeConfig(
  voice: OpenAIVoiceId = 'alloy',
  options?: Partial<OpenAIRealtimeConfig>
): OpenAIRealtimeConfig {
  const envConfig = getVoiceEnvironmentConfig();
  
  return {
    model: 'gpt-4o-realtime-preview-2024-12-17',
    voice,
    temperature: 0.8,
    maxTokens: 1000,
    vadSettings: {
      threshold: 0.6,
      prefixPaddingMs: 300,
      silenceDurationMs: 1200,
    },
    audioFormat: 'pcm16',
    sampleRate: envConfig.audio.sampleRate,
    ...options,
  };
}

/**
 * OpenAI TTS configuration factory
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
 * OpenAI Whisper (STT) configuration
 */
export interface OpenAISTTConfig {
  model: 'whisper-1';
  language?: string;
  prompt?: string;
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

/**
 * Create OpenAI STT configuration
 */
export function createOpenAISTTConfig(
  language?: string,
  options?: Partial<OpenAISTTConfig>
): OpenAISTTConfig {
  return {
    model: 'whisper-1',
    language,
    responseFormat: 'json',
    temperature: 0.0,
    ...options,
  };
}

// ==========================================
// VOICE CONFIGURATION FACTORIES
// ==========================================

/**
 * Create default voice configuration for a user
 */
export function createDefaultVoiceConfig(
  language: string = 'en',
  preferences?: Partial<VoicePreferences>
): VoiceConfig {
  const recommendedVoice = getRecommendedVoice(language);
  
  // 🔧 FIX: Create complete config object with proper defaults
  const config: VoiceConfig = {
    ...DEFAULT_VOICE_CONFIG,
    language,
    voiceId: recommendedVoice,
  };

  // 🔧 FIX: Only apply preferences if they exist, with explicit default fallbacks
  if (preferences) {
    return {
      ...config,
      // Each property gets explicit fallback to avoid undefined values
      enabled: preferences.voiceEnabled ?? config.enabled,
      provider: preferences.voiceProvider ?? config.provider,
      voiceId: preferences.preferredVoice ?? config.voiceId,
      language: preferences.voiceLanguage ?? config.language,
      speed: preferences.voiceSpeed ?? config.speed,
      quality: preferences.voiceQuality ?? config.quality,
      latencyMode: preferences.voiceLatencyMode ?? config.latencyMode,
      autoplay: preferences.voiceAutoplay ?? config.autoplay,
      inputEnabled: preferences.voiceInputEnabled ?? config.inputEnabled,
      outputEnabled: preferences.voiceOutputEnabled ?? config.outputEnabled,
      interruptionsEnabled: preferences.voiceInterruptionsEnabled ?? config.interruptionsEnabled,
      visualizationEnabled: preferences.voiceVisualizationEnabled ?? config.visualizationEnabled,
    };
  }

  return config;
}


/**
 * Create voice configuration for specific agent
 */
export function createAgentVoiceConfig(
  agentId: string,
  baseConfig: VoiceConfig,
  language?: string
): VoiceConfig {
  const agentMapping = AGENT_VOICE_MAPPING[agentId];
  if (!agentMapping) {
    return baseConfig;
  }

  const voiceId = language 
    ? getRecommendedVoice(language) 
    : agentMapping.defaultVoice;

  // 🔧 FIX: Create new config with explicit type safety
  const agentConfig: VoiceConfig = {
    ...baseConfig,
    voiceId,
  };

  // 🔧 FIX: Handle agent overrides safely
  const agentOverrides = baseConfig.agentOverrides?.[agentId];
  if (agentOverrides) {
    // Apply each override property explicitly to maintain type safety
    return {
      ...agentConfig,
      enabled: agentOverrides.enabled ?? agentConfig.enabled,
      provider: agentOverrides.provider ?? agentConfig.provider,
      voiceId: agentOverrides.voiceId ?? agentConfig.voiceId,
      language: agentOverrides.language ?? agentConfig.language,
      speed: agentOverrides.speed ?? agentConfig.speed,
      quality: agentOverrides.quality ?? agentConfig.quality,
      latencyMode: agentOverrides.latencyMode ?? agentConfig.latencyMode,
      autoplay: agentOverrides.autoplay ?? agentConfig.autoplay,
      inputEnabled: agentOverrides.inputEnabled ?? agentConfig.inputEnabled,
      outputEnabled: agentOverrides.outputEnabled ?? agentConfig.outputEnabled,
      interruptionsEnabled: agentOverrides.interruptionsEnabled ?? agentConfig.interruptionsEnabled,
      visualizationEnabled: agentOverrides.visualizationEnabled ?? agentConfig.visualizationEnabled,
      inputMode: agentOverrides.inputMode ?? agentConfig.inputMode,
      microphoneSensitivity: agentOverrides.microphoneSensitivity ?? agentConfig.microphoneSensitivity,
      noiseSuppression: agentOverrides.noiseSuppression ?? agentConfig.noiseSuppression,
      agentOverrides: agentOverrides.agentOverrides ?? agentConfig.agentOverrides,
    };
  }

  return agentConfig;
}

/**
 * Convert database preferences to VoiceConfig
 */
export function voicePreferencesToConfig(
  preferences: VoicePreferences,
  language?: string
): VoiceConfig {
  return {
    enabled: preferences.voiceEnabled,
    provider: preferences.voiceProvider,
    voiceId: preferences.preferredVoice,
    language: language || preferences.voiceLanguage,
    speed: preferences.voiceSpeed,
    quality: preferences.voiceQuality,
    latencyMode: preferences.voiceLatencyMode,
    autoplay: preferences.voiceAutoplay,
    inputEnabled: preferences.voiceInputEnabled,
    outputEnabled: preferences.voiceOutputEnabled,
    interruptionsEnabled: preferences.voiceInterruptionsEnabled,
    visualizationEnabled: preferences.voiceVisualizationEnabled,
    inputMode: 'push_to_talk', // Default, not stored in DB yet
    microphoneSensitivity: 0.6, // Default, not stored in DB yet
    noiseSuppression: true, // Default, not stored in DB yet
  };
}

/**
 * Convert VoiceConfig to database preferences format
 */
export function voiceConfigToPreferences(config: VoiceConfig): Partial<VoicePreferences> {
  return {
    voiceEnabled: config.enabled,
    voiceLanguage: config.language,
    voiceSpeed: config.speed,
    voiceProvider: config.provider,
    preferredVoice: config.voiceId,
    voiceAutoplay: config.autoplay,
    voiceInputEnabled: config.inputEnabled,
    voiceOutputEnabled: config.outputEnabled,
    voiceInterruptionsEnabled: config.interruptionsEnabled,
    voiceVisualizationEnabled: config.visualizationEnabled,
    voiceQuality: config.quality,
    voiceLatencyMode: config.latencyMode,
  };
}

// ==========================================
// AGENT VOICE PROFILES
// ==========================================

/**
 * Create complete voice profile for an agent
 */
export function createAgentVoiceProfile(
  agentId: string,
  language: string = 'en',
  customVoice?: OpenAIVoiceId
): AgentVoiceProfile {
  const agentMapping = AGENT_VOICE_MAPPING[agentId];
  const voiceId = customVoice || 
                  (agentMapping ? agentMapping.defaultVoice : getRecommendedVoice(language));

  // Agent-specific instructions
  const agentInstructions: Record<string, AgentVoiceProfile['instructions']> = {
    router: {
      speakingStyle: 'Speak clearly and concisely. Use a helpful and intelligent tone. Pause briefly before introducing specialist agents.',
      specialHandling: ['agent_transitions', 'routing_explanations'],
      pronunciationGuide: {
        'Smartlyte': 'SMART-lite',
        'AI': 'A-I',
      },
    },
    'digital-mentor': {
      speakingStyle: 'Speak slowly and patiently. Break down complex concepts. Use encouraging language and check for understanding.',
      specialHandling: ['step_by_step_instructions', 'technical_terms', 'safety_warnings'],
      pronunciationGuide: {
        'WiFi': 'WYE-fye',
        'URL': 'U-R-L',
        'HTTP': 'H-T-T-P',
        'Gmail': 'JEE-mail',
      },
    },
    'finance-guide': {
      speakingStyle: 'Speak with confidence and authority. Use professional terminology but explain clearly. Emphasize important financial advice.',
      specialHandling: ['financial_figures', 'risk_warnings', 'legal_disclaimers'],
      pronunciationGuide: {
        'API': 'A-P-I',
        'ROI': 'R-O-I',
        'APR': 'A-P-R',
      },
    },
    'health-coach': {
      speakingStyle: 'Use a warm, encouraging tone. Speak with care and empathy. Emphasize positive health behaviors.',
      specialHandling: ['health_disclaimers', 'measurement_units', 'medical_terms'],
      pronunciationGuide: {
        'BMI': 'B-M-I',
        'cardio': 'CAR-dee-oh',
      },
    },
  };

  return {
    agentId,
    voiceId,
    personality: agentMapping ? agentMapping.personality : {
      tone: 'helpful',
      pace: 'normal',
      emphasis: 'moderate',
      pauseBehavior: 'natural',
    },
    instructions: agentInstructions[agentId] || agentInstructions.router,
  };
}

// ==========================================
// VOICE PRESET CONFIGURATIONS
// ==========================================

/**
 * Predefined voice presets for different use cases
 */
export interface VoicePresetConfig {
  id: string;
  name: string;
  description: string;
  config: Partial<VoiceConfig>;
  isSystemPreset: boolean;
  tags: string[];
}

/**
 * Built-in voice presets
 */
export const VOICE_PRESETS: VoicePresetConfig[] = [
  {
    id: 'learning_mode',
    name: 'Learning Mode',
    description: 'Optimized for educational content with clear, patient delivery',
    config: {
      speed: 0.9,
      quality: 'hd',
      latencyMode: 'quality',
      interruptionsEnabled: true,
      visualizationEnabled: true,
    },
    isSystemPreset: true,
    tags: ['education', 'slow', 'clear'],
  },
  {
    id: 'quick_responses',
    name: 'Quick Responses',
    description: 'Fast, efficient voice interactions with minimal latency',
    config: {
      speed: 1.2,
      quality: 'standard',
      latencyMode: 'low',
      interruptionsEnabled: true,
      visualizationEnabled: false,
    },
    isSystemPreset: true,
    tags: ['fast', 'efficient', 'low-latency'],
  },
  {
    id: 'accessibility',
    name: 'Accessibility',
    description: 'Enhanced for users with hearing or processing difficulties',
    config: {
      speed: 0.8,
      quality: 'hd',
      latencyMode: 'quality',
      interruptionsEnabled: false,
      visualizationEnabled: true,
    },
    isSystemPreset: true,
    tags: ['accessibility', 'clear', 'slow'],
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Formal tone suitable for business and professional contexts',
    config: {
      speed: 1.0,
      quality: 'hd',
      latencyMode: 'balanced',
      voiceId: 'echo', // Professional male voice
    },
    isSystemPreset: true,
    tags: ['business', 'formal', 'professional'],
  },
  {
    id: 'casual',
    name: 'Casual',
    description: 'Friendly and relaxed for informal conversations',
    config: {
      speed: 1.1,
      quality: 'standard',
      latencyMode: 'balanced',
      voiceId: 'nova', // Friendly female voice
    },
    isSystemPreset: true,
    tags: ['casual', 'friendly', 'relaxed'],
  },
];

/**
 * Get voice preset by ID
 */
export function getVoicePreset(presetId: string): VoicePresetConfig | null {
  return VOICE_PRESETS.find(preset => preset.id === presetId) || null;
}

/**
 * Apply voice preset to configuration
 */
export function applyVoicePreset(
  baseConfig: VoiceConfig,
  presetId: string
): VoiceConfig {
  const preset = getVoicePreset(presetId);
  if (!preset) {
    return baseConfig;
  }

  // 🔧 FIX: Apply preset config with explicit property handling
  const presetConfig = preset.config;
  
  return {
    ...baseConfig,
    // Apply each preset property explicitly with fallbacks
    enabled: presetConfig.enabled ?? baseConfig.enabled,
    provider: presetConfig.provider ?? baseConfig.provider,
    voiceId: presetConfig.voiceId ?? baseConfig.voiceId,
    language: presetConfig.language ?? baseConfig.language,
    speed: presetConfig.speed ?? baseConfig.speed,
    quality: presetConfig.quality ?? baseConfig.quality,
    latencyMode: presetConfig.latencyMode ?? baseConfig.latencyMode,
    autoplay: presetConfig.autoplay ?? baseConfig.autoplay,
    inputEnabled: presetConfig.inputEnabled ?? baseConfig.inputEnabled,
    outputEnabled: presetConfig.outputEnabled ?? baseConfig.outputEnabled,
    interruptionsEnabled: presetConfig.interruptionsEnabled ?? baseConfig.interruptionsEnabled,
    visualizationEnabled: presetConfig.visualizationEnabled ?? baseConfig.visualizationEnabled,
    inputMode: presetConfig.inputMode ?? baseConfig.inputMode,
    microphoneSensitivity: presetConfig.microphoneSensitivity ?? baseConfig.microphoneSensitivity,
    noiseSuppression: presetConfig.noiseSuppression ?? baseConfig.noiseSuppression,
    agentOverrides: presetConfig.agentOverrides ?? baseConfig.agentOverrides,
  };
}

// ==========================================
// CONFIGURATION VALIDATION
// ==========================================

/**
 * Validate voice configuration
 */
export interface VoiceConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Validate a voice configuration
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

// ==========================================
// CONFIGURATION UTILITIES
// ==========================================

/**
 * Optimize voice configuration for device/network
 */
export function optimizeVoiceConfigForEnvironment(
  config: VoiceConfig,
  environment: {
    deviceType: 'mobile' | 'desktop' | 'tablet';
    networkType: 'slow' | 'fast' | 'unknown';
    batteryLevel?: number; // 0-1 for mobile devices
  }
): VoiceConfig {
  const optimized = { ...config };

  // Mobile optimizations
  if (environment.deviceType === 'mobile') {
    // Conserve battery
    if (environment.batteryLevel && environment.batteryLevel < 0.2) {
      optimized.quality = 'standard';
      optimized.visualizationEnabled = false;
    }
    
    // Touch-friendly input mode
    optimized.inputMode = 'push_to_talk';
  }

  // Network optimizations
  if (environment.networkType === 'slow') {
    optimized.quality = 'standard';
    optimized.latencyMode = 'low';
  }

  return optimized;
}

/**
 * Get recommended voice configuration for specific use case
 */
export function getRecommendedConfigForUseCase(
  useCase: 'learning' | 'business' | 'casual' | 'accessibility',
  language: string = 'en'
): VoiceConfig {
  const baseConfig = createDefaultVoiceConfig(language);

  switch (useCase) {
    case 'learning':
      return applyVoicePreset(baseConfig, 'learning_mode');
    case 'business':
      return applyVoicePreset(baseConfig, 'professional');
    case 'casual':
      return applyVoicePreset(baseConfig, 'casual');
    case 'accessibility':
      return applyVoicePreset(baseConfig, 'accessibility');
    default:
      return baseConfig;
  }
}

/**
 * Merge voice configurations with precedence
 */
export function mergeVoiceConfigs(
  base: VoiceConfig,
  ...overrides: Partial<VoiceConfig>[]
): VoiceConfig {
  return overrides.reduce<VoiceConfig>(
    (merged, override) => {
      // 🔧 FIX: Apply each override property explicitly
      return {
        ...merged,
        enabled: override.enabled ?? merged.enabled,
        provider: override.provider ?? merged.provider,
        voiceId: override.voiceId ?? merged.voiceId,
        language: override.language ?? merged.language,
        speed: override.speed ?? merged.speed,
        quality: override.quality ?? merged.quality,
        latencyMode: override.latencyMode ?? merged.latencyMode,
        autoplay: override.autoplay ?? merged.autoplay,
        inputEnabled: override.inputEnabled ?? merged.inputEnabled,
        outputEnabled: override.outputEnabled ?? merged.outputEnabled,
        interruptionsEnabled: override.interruptionsEnabled ?? merged.interruptionsEnabled,
        visualizationEnabled: override.visualizationEnabled ?? merged.visualizationEnabled,
        inputMode: override.inputMode ?? merged.inputMode,
        microphoneSensitivity: override.microphoneSensitivity ?? merged.microphoneSensitivity,
        noiseSuppression: override.noiseSuppression ?? merged.noiseSuppression,
        agentOverrides: override.agentOverrides ?? merged.agentOverrides,
      };
    },
    base
  );
}

/**
 * Clone voice configuration
 */
export function cloneVoiceConfig(config: VoiceConfig): VoiceConfig {
  return JSON.parse(JSON.stringify(config));
}
