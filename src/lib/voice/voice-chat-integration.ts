// src/lib/voice/voice-chat-integration.ts
// Voice-Chat Integration Utilities
// Provides helper functions for integrating voice functionality with chat flow

import { type Message } from '@/hooks/use-chat';
import {
  VoiceConfig,
  VoicePreferences,
  VoiceProvider,
  VoiceQuality,
  OpenAIVoiceId,
  AgentVoiceProfile,
} from './voice-types';
import { createAgentVoiceConfig, applyVoicePreset } from './voice-config';

// ==========================================
// CHAT MESSAGE PROCESSING
// ==========================================

/**
 * Determine if a message should be auto-played
 */
export function shouldAutoPlayMessage(
  message: Message,
  preferences: VoicePreferences | null,
  lastProcessedMessageId: string | null
): boolean {
  // Basic validation
  if (!message || !preferences) return false;
  
  // Check voice settings
  if (!preferences.voiceEnabled || !preferences.voiceAutoplay) return false;
  
  // Only auto-play assistant messages
  if (message.role !== 'assistant') return false;
  
  // Don't replay the same message
  if (message.id === lastProcessedMessageId) return false;
  
  // Only substantial content
  if (message.content.trim().length < 10) return false;
  
  // Don't play while streaming
  if (message.metadata?.isStreaming) return false;
  
  // (Removed redundant system message check as 'system' is not a valid role here)
  
  return true;
}

/**
 * Process message content for optimal voice synthesis
 */
export function processMessageForVoice(
  message: Message,
  options: {
    maxLength?: number;
    removeMarkdown?: boolean;
    cleanFormatting?: boolean;
    addPauses?: boolean;
  } = {}
): string {
  const {
    maxLength = 5000,
    removeMarkdown = true,
    cleanFormatting = true,
    addPauses = true,
  } = options;
  
  let content = message.content;
  
  // Basic content validation
  if (!content || typeof content !== 'string') {
    return '';
  }
  
  // Remove markdown formatting for cleaner speech
  if (removeMarkdown) {
    content = removeMarkdownFormatting(content);
  }
  
  // Clean up formatting for better speech
  if (cleanFormatting) {
    content = cleanContentForSpeech(content);
  }
  
  // Add natural pauses for better speech flow
  if (addPauses) {
    content = addNaturalPauses(content);
  }
  
  // Truncate if too long
  if (content.length > maxLength) {
    content = truncateForSpeech(content, maxLength);
  }
  
  return content.trim();
}

/**
 * Remove markdown formatting for cleaner speech
 */
function removeMarkdownFormatting(text: string): string {
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, ' [code block] ')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove headers
    .replace(/#{1,6}\s+/g, '')
    // Remove links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bullet points
    .replace(/^[•\-\*]\s+/gm, '')
    // Remove numbered lists
    .replace(/^\d+\.\s+/gm, '');
}

/**
 * Clean content for better speech synthesis
 */
function cleanContentForSpeech(text: string): string {
  return text
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Replace multiple newlines with single newline
    .replace(/\n+/g, '\n')
    // Remove excessive punctuation
    .replace(/[!]{2,}/g, '!')
    .replace(/[?]{2,}/g, '?')
    .replace(/[.]{3,}/g, '...')
    // Replace some symbols with spoken equivalents
    .replace(/&/g, ' and ')
    .replace(/@/g, ' at ')
    .replace(/#/g, ' hashtag ')
    .replace(/\$/g, ' dollars ')
    .replace(/%/g, ' percent ')
    // Remove extra punctuation at the end
    .replace(/[.,;:!?]+$/, '');
}

/**
 * Add natural pauses for better speech flow
 */
function addNaturalPauses(text: string): string {
  return text
    // Add pause after sentences
    .replace(/([.!?])\s+/g, '$1 ')
    // Add pause after commas
    .replace(/,\s+/g, ', ')
    // Add pause after colons
    .replace(/:\s+/g, ': ')
    // Add pause between paragraphs
    .replace(/\n\s*\n/g, '\n\n');
}

/**
 * Truncate text for speech while preserving sentence boundaries
 */
function truncateForSpeech(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  // Try to truncate at sentence boundary
  const sentences = text.split(/[.!?]+/);
  let truncated = '';
  
  for (const sentence of sentences) {
    const withSentence = truncated + sentence + '.';
    if (withSentence.length > maxLength) {
      break;
    }
    truncated = withSentence;
  }
  
  // If no sentences fit, truncate at word boundary
  if (!truncated) {
    const words = text.split(' ');
    for (const word of words) {
      const withWord = truncated + ' ' + word;
      if (withWord.length > maxLength) {
        break;
      }
      truncated = withWord;
    }
    truncated += '...';
  }
  
  return truncated.trim();
}

// ==========================================
// AGENT-SPECIFIC VOICE HANDLING
// ==========================================

/**
 * Get voice configuration for specific agent
 */
export function getAgentVoiceConfig(
  agentName: string | undefined,
  baseConfig: VoiceConfig,
  userPreferences: VoicePreferences
): VoiceConfig {
  if (!agentName) return baseConfig;
  
  // Map agent names to agent IDs
  const agentId = mapAgentNameToId(agentName);
  
  // Create agent-specific configuration
  const agentConfig = createAgentVoiceConfig(
    agentId,
    baseConfig,
    userPreferences.voiceLanguage
  );
  
  return agentConfig;
}

/**
 * Map agent display names to agent IDs
 */
function mapAgentNameToId(agentName: string): string {
  const mapping: Record<string, string> = {
    'Smart Router': 'router',
    'Intelligent Router': 'router',
    'Digital Mentor': 'digital-mentor',
    'Finance Guide': 'finance-guide',
    'Health Coach': 'health-coach',
    // Add more mappings as needed
  };
  
  return mapping[agentName] || 'router';
}

/**
 * Get recommended voice for agent and language
 */
export function getRecommendedVoiceForAgent(
  agentName: string | undefined,
  language: string = 'en'
): OpenAIVoiceId {
  const agentId = agentName ? mapAgentNameToId(agentName) : 'router';
  
  // Agent-specific voice recommendations
  const agentVoiceMapping: Record<string, OpenAIVoiceId> = {
    'router': 'alloy',        // Neutral, professional
    'digital-mentor': 'nova', // Friendly, encouraging
    'finance-guide': 'onyx',  // Authoritative, trustworthy
    'health-coach': 'shimmer', // Warm, caring
  };
  
  return agentVoiceMapping[agentId] || 'alloy';
}

// ==========================================
// VOICE STATE MANAGEMENT
// ==========================================

/**
 * Determine if voice should be interrupted by user action
 */
export function shouldInterruptVoice(
  action: 'typing' | 'speaking' | 'navigation' | 'newMessage',
  currentVoiceState: {
    isPlaying: boolean;
    isPaused: boolean;
    currentText?: string;
  },
  userPreferences: VoicePreferences
): boolean {
  // Don't interrupt if nothing is playing
  if (!currentVoiceState.isPlaying) return false;
  
  // Don't interrupt if user disabled interruptions
  if (!userPreferences.voiceInterruptionsEnabled) return false;
  
  switch (action) {
    case 'typing':
      // Interrupt when user starts typing a new message
      return true;
      
    case 'speaking':
      // Interrupt when user starts voice input
      return true;
      
    case 'newMessage':
      // Interrupt when user sends a new message
      return true;
      
    case 'navigation':
      // Interrupt when user navigates away
      return true;
      
    default:
      return false;
  }
}

/**
 * Calculate voice playback priority for message queue
 */
export function calculateVoicePriority(
  message: Message,
  context: {
    isLastMessage: boolean;
    userIsTyping: boolean;
    hasUserAttention: boolean;
  }
): number {
  let priority = 0;
  
  // Base priority by message type
  if (message.role === 'assistant') priority += 10;
  if (message.role === 'user') priority += 1; // Usually don't speak user messages
  
  // Boost priority for recent messages
  if (context.isLastMessage) priority += 20;
  
  // Reduce priority if user is busy
  if (context.userIsTyping) priority -= 15;
  if (!context.hasUserAttention) priority -= 10;
  
  // Boost priority for important content
  if (message.content.includes('important') || message.content.includes('urgent')) {
    priority += 5;
  }
  
  // Reduce priority for very long messages
  if (message.content.length > 1000) priority -= 5;
  
  return Math.max(0, priority);
}

// ==========================================
// VOICE SESSION MANAGEMENT
// ==========================================

/**
 * Generate conversation-specific voice session configuration
 */
export function createChatVoiceSessionConfig(
  conversationId: string,
  userId: string,
  preferences: VoicePreferences,
  options: {
    agentId?: string;
    messageCount?: number;
    isFirstSession?: boolean;
  } = {}
): {
  sessionId: string;
  config: VoiceConfig;
  metadata: Record<string, any>;
} {
  const sessionId = `chat_${conversationId}_${Date.now()}`;
  
  // Create base configuration from preferences
  const baseConfig: VoiceConfig = {
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
    inputMode: 'push_to_talk',
    microphoneSensitivity: 0.6,
    noiseSuppression: true,
    agentOverrides: {},
  };
  
  // Apply agent-specific configuration if provided
  const config = options.agentId 
    ? createAgentVoiceConfig(options.agentId, baseConfig, preferences.voiceLanguage)
    : baseConfig;
  
  // Session metadata
  const metadata = {
    conversationId,
    userId,
    agentId: options.agentId,
    messageCount: options.messageCount || 0,
    isFirstSession: options.isFirstSession || false,
    createdAt: new Date().toISOString(),
    preferences: {
      autoplay: preferences.voiceAutoplay,
      interruptionsEnabled: preferences.voiceInterruptionsEnabled,
      quality: preferences.voiceQuality,
    },
  };
  
  return { sessionId, config, metadata };
}

/**
 * Determine optimal voice settings for chat context
 */
export function optimizeVoiceForChatContext(
  baseConfig: VoiceConfig,
  context: {
    messageCount: number;
    conversationLength: number; // in minutes
    userAttentionLevel: 'high' | 'medium' | 'low';
    deviceType: 'mobile' | 'desktop' | 'tablet';
    networkQuality: 'good' | 'fair' | 'poor';
  }
): VoiceConfig {
  const optimized = { ...baseConfig };
  
  // Optimize for attention level
  if (context.userAttentionLevel === 'low') {
    optimized.speed = Math.max(0.8, optimized.speed - 0.1); // Slower for better comprehension
    optimized.autoplay = false; // Don't auto-play when user isn't focused
  }
  
  // Optimize for device
  if (context.deviceType === 'mobile') {
    optimized.quality = 'standard'; // Preserve battery
    optimized.latencyMode = 'low'; // Better for mobile networks
  }
  
  // Optimize for network
  if (context.networkQuality === 'poor') {
    optimized.quality = 'standard';
    optimized.latencyMode = 'low';
  }
  
  // Optimize for long conversations
  if (context.conversationLength > 30) {
    optimized.speed = Math.min(1.2, optimized.speed + 0.1); // Slightly faster for efficiency
  }
  
  return optimized;
}

// ==========================================
// VOICE ANALYTICS & INSIGHTS
// ==========================================

/**
 * Generate voice usage insights for chat session
 */
export function generateVoiceInsights(
  messages: Message[],
  voiceEvents: Array<{
    type: 'play' | 'pause' | 'stop' | 'interrupt';
    messageId: string;
    timestamp: Date;
    duration?: number;
  }>
): {
  totalMessages: number;
  voiceEnabledMessages: number;
  playbackDuration: number;
  interruptionRate: number;
  mostPlayedAgent: string | null;
  averageMessageLength: number;
  suggestions: string[];
} {
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  
  // Calculate basic metrics
  const totalMessages = assistantMessages.length;
  const voiceEnabledMessages = voiceEvents.filter(e => e.type === 'play').length;
  const playbackDuration = voiceEvents
    .filter(e => e.type === 'play' && e.duration)
    .reduce((sum, e) => sum + (e.duration || 0), 0);
  
  // Calculate interruption rate
  const playEvents = voiceEvents.filter(e => e.type === 'play').length;
  const interruptEvents = voiceEvents.filter(e => e.type === 'interrupt').length;
  const interruptionRate = playEvents > 0 ? interruptEvents / playEvents : 0;
  
  // Find most played agent
  const agentPlayCounts: Record<string, number> = {};
  voiceEvents
    .filter(e => e.type === 'play')
    .forEach(event => {
      const message = messages.find(m => m.id === event.messageId);
      if (message?.agentName) {
        agentPlayCounts[message.agentName] = (agentPlayCounts[message.agentName] || 0) + 1;
      }
    });
  
  const mostPlayedAgent = Object.keys(agentPlayCounts).length > 0
    ? Object.entries(agentPlayCounts).sort(([,a], [,b]) => b - a)[0][0]
    : null;
  
  // Calculate average message length
  const averageMessageLength = assistantMessages.length > 0
    ? assistantMessages.reduce((sum, m) => sum + m.content.length, 0) / assistantMessages.length
    : 0;
  
  // Generate suggestions
  const suggestions: string[] = [];
  
  if (interruptionRate > 0.3) {
    suggestions.push('Consider slower speech speed for better comprehension');
  }
  
  if (voiceEnabledMessages / totalMessages < 0.5) {
    suggestions.push('Try enabling auto-play to hear more responses');
  }
  
  if (averageMessageLength > 500) {
    suggestions.push('Voice works best with shorter, focused responses');
  }
  
  return {
    totalMessages,
    voiceEnabledMessages,
    playbackDuration,
    interruptionRate,
    mostPlayedAgent,
    averageMessageLength,
    suggestions,
  };
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Check if voice feature is available in current environment
 */
export function isVoiceAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for required APIs
  const hasAudioContext = 'AudioContext' in window || 'webkitAudioContext' in window;
  const hasMediaDevices = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
  const hasFetch = 'fetch' in window;
  
  return hasAudioContext && hasMediaDevices && hasFetch;
}

/**
 * Estimate speech duration for text
 */
export function estimateSpeechDuration(
  text: string,
  speed: number = 1.0,
  wordsPerMinute: number = 150
): number {
  const words = text.split(/\s+/).length;
  const adjustedWpm = wordsPerMinute * speed;
  const durationMinutes = words / adjustedWpm;
  return Math.max(0.1, durationMinutes * 60); // At least 0.1 seconds
}

/**
 * Generate unique voice session ID
 */
export function generateVoiceSessionId(
  prefix: string = 'voice',
  context?: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return context 
    ? `${prefix}_${context}_${timestamp}_${random}`
    : `${prefix}_${timestamp}_${random}`;
}

/**
 * Validate voice configuration for chat use
 */
export function validateVoiceConfigForChat(
  config: VoiceConfig
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!config.provider) errors.push('Voice provider is required');
  if (!config.voiceId) errors.push('Voice ID is required');
  if (!config.language) errors.push('Language is required');
  
  // Validate speed
  if (config.speed < 0.25 || config.speed > 4.0) {
    errors.push('Voice speed must be between 0.25 and 4.0');
  }
  
  // Warnings for suboptimal settings
  if (config.speed > 2.0) {
    warnings.push('Very fast speech may be difficult to understand');
  }
  
  if (config.quality === 'standard' && config.latencyMode === 'quality') {
    warnings.push('Quality latency mode may not improve standard quality audio');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}