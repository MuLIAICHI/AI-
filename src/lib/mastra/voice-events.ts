// src/lib/mastra/voice-events.ts
// Event management and coordination for real-time voice interactions

import { VoiceError, VoiceState } from '@/lib/voice/voice-types';

// ==========================================
// EVENT TYPES & INTERFACES
// ==========================================

export type VoiceEventType = 
  | 'connection_changed'
  | 'session_started'
  | 'session_ended'
  | 'user_speaking_start'
  | 'user_speaking_end'
  | 'ai_speaking_start' 
  | 'ai_speaking_end'
  | 'transcript_received'
  | 'audio_received'
  | 'audio_level_changed'
  | 'error_occurred'
  | 'state_changed'
  | 'volume_changed'
  | 'interruption_detected'
  | 'session_timeout_warning'
  | 'session_timeout';

export interface BaseVoiceEvent {
  type: VoiceEventType;
  timestamp: Date;
  sessionId?: string;
}

export interface ConnectionChangedEvent extends BaseVoiceEvent {
  type: 'connection_changed';
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  previousStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export interface SessionEvent extends BaseVoiceEvent {
  type: 'session_started' | 'session_ended';
  sessionId: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface SpeakingEvent extends BaseVoiceEvent {
  type: 'user_speaking_start' | 'user_speaking_end' | 'ai_speaking_start' | 'ai_speaking_end';
  audioLevel?: number;
  duration?: number;
}

export interface TranscriptEvent extends BaseVoiceEvent {
  type: 'transcript_received';
  text: string;
  role: 'user' | 'assistant';
  confidence?: number;
  isFinal?: boolean;
}

export interface AudioEvent extends BaseVoiceEvent {
  type: 'audio_received';
  audioData: Int16Array;
  format: string;
  sampleRate: number;
}

export interface AudioLevelEvent extends BaseVoiceEvent {
  type: 'audio_level_changed';
  level: number; // 0.0 to 1.0
  peak: number;
  source: 'user' | 'ai';
}

export interface ErrorEvent extends BaseVoiceEvent {
  type: 'error_occurred';
  error: VoiceError;
  context?: string;
  recoverable: boolean;
}

export interface StateChangedEvent extends BaseVoiceEvent {
  type: 'state_changed';
  newState: VoiceState;
  previousState: VoiceState;
}

export interface VolumeChangedEvent extends BaseVoiceEvent {
  type: 'volume_changed';
  volume: number;
  muted: boolean;
}

export interface InterruptionEvent extends BaseVoiceEvent {
  type: 'interruption_detected';
  interruptedBy: 'user' | 'system';
  aiSpeechRemaining?: number;
}

export interface TimeoutEvent extends BaseVoiceEvent {
  type: 'session_timeout_warning' | 'session_timeout';
  remainingTime?: number;
  maxDuration: number;
}

export type VoiceEvent = 
  | ConnectionChangedEvent
  | SessionEvent
  | SpeakingEvent
  | TranscriptEvent
  | AudioEvent
  | AudioLevelEvent
  | ErrorEvent
  | StateChangedEvent
  | VolumeChangedEvent
  | InterruptionEvent
  | TimeoutEvent;

export type VoiceEventHandler<T extends VoiceEvent = VoiceEvent> = (event: T) => void;

// ==========================================
// EVENT EMITTER CLASS
// ==========================================

/**
 * VoiceEventEmitter - Manages real-time voice events with type safety
 * 
 * Features:
 * - Type-safe event handling
 * - Event filtering and aggregation
 * - Automatic cleanup and memory management
 * - Event replay for debugging
 * - Performance monitoring
 */
export class VoiceEventEmitter {
  private handlers: Map<VoiceEventType, Set<VoiceEventHandler>> = new Map();
  private eventHistory: VoiceEvent[] = [];
  private maxHistorySize: number = 100;
  private isRecording: boolean = true;
  private performanceMetrics: Map<VoiceEventType, { count: number; avgProcessingTime: number }> = new Map();

  constructor(options?: { maxHistorySize?: number; recordHistory?: boolean }) {
    this.maxHistorySize = options?.maxHistorySize || 100;
    this.isRecording = options?.recordHistory !== false;
  }

  // ==========================================
  // EVENT SUBSCRIPTION
  // ==========================================

  /**
   * Subscribe to a specific event type
   */
  on<T extends VoiceEvent>(
    eventType: T['type'],
    handler: VoiceEventHandler<T>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    this.handlers.get(eventType)!.add(handler as VoiceEventHandler);
    
    // Return unsubscribe function
    return () => this.off(eventType, handler);
  }

  /**
   * Subscribe to multiple event types with the same handler
   */
  onMultiple<T extends VoiceEvent>(
    eventTypes: T['type'][],
    handler: VoiceEventHandler<T>
  ): () => void {
    const unsubscribeFunctions = eventTypes.map(type => this.on(type, handler));
    
    // Return function to unsubscribe from all
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }

  /**
   * Subscribe to an event only once
   */
  once<T extends VoiceEvent>(
    eventType: T['type'],
    handler: VoiceEventHandler<T>
  ): () => void {
    const onceHandler = (event: T) => {
      handler(event);
      this.off(eventType, onceHandler);
    };
    
    return this.on(eventType, onceHandler);
  }

  /**
   * Unsubscribe from an event
   */
  off<T extends VoiceEvent>(
    eventType: T['type'],
    handler: VoiceEventHandler<T>
  ): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler as VoiceEventHandler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  /**
   * Unsubscribe from all events of a type
   */
  offAll(eventType: VoiceEventType): void {
    this.handlers.delete(eventType);
  }

  /**
   * Clear all event handlers
   */
  clear(): void {
    this.handlers.clear();
    this.eventHistory = [];
    this.performanceMetrics.clear();
  }

  // ==========================================
  // EVENT EMISSION
  // ==========================================

  /**
   * Emit an event to all subscribers
   */
  emit<T extends VoiceEvent>(event: T): void {
    const startTime = performance.now();
    
    // Record event in history
    if (this.isRecording) {
      this.addToHistory(event);
    }

    // Get handlers for this event type
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // Execute all handlers
    let handlerCount = 0;
    handlers.forEach(handler => {
      try {
        handler(event);
        handlerCount++;
      } catch (error) {
        console.error(`Error in voice event handler for ${event.type}:`, error);
      }
    });

    // Update performance metrics
    const processingTime = performance.now() - startTime;
    this.updateMetrics(event.type, processingTime);

    console.log(`🎤 Voice event emitted: ${event.type} (${handlerCount} handlers, ${processingTime.toFixed(2)}ms)`);
  }

  /**
   * Emit multiple events in sequence
   */
  emitBatch(events: VoiceEvent[]): void {
    events.forEach(event => this.emit(event));
  }

  // ==========================================
  // EVENT FILTERING & QUERYING
  // ==========================================

  /**
   * Get events from history by type
   */
  getEventHistory<T extends VoiceEvent>(
    eventType?: T['type'],
    limit?: number
  ): T[] {
    let filteredEvents = this.eventHistory;
    
    if (eventType) {
      filteredEvents = this.eventHistory.filter(event => event.type === eventType);
    }
    
    if (limit) {
      filteredEvents = filteredEvents.slice(-limit);
    }
    
    return filteredEvents as T[];
  }

  /**
   * Get events from a specific session
   */
  getSessionEvents(sessionId: string): VoiceEvent[] {
    return this.eventHistory.filter(event => event.sessionId === sessionId);
  }

  /**
   * Get events within a time range
   */
  getEventsInTimeRange(startTime: Date, endTime: Date): VoiceEvent[] {
    return this.eventHistory.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  /**
   * Get the last event of a specific type
   */
  getLastEvent<T extends VoiceEvent>(eventType: T['type']): T | null {
    for (let i = this.eventHistory.length - 1; i >= 0; i--) {
      const event = this.eventHistory[i];
      if (event.type === eventType) {
        return event as T;
      }
    }
    return null;
  }

  // ==========================================
  // EVENT AGGREGATION & ANALYTICS
  // ==========================================

  /**
   * Get event counts by type
   */
  getEventCounts(): Record<VoiceEventType, number> {
    const counts: Partial<Record<VoiceEventType, number>> = {};
    
    this.eventHistory.forEach(event => {
      counts[event.type] = (counts[event.type] || 0) + 1;
    });
    
    return counts as Record<VoiceEventType, number>;
  }

  /**
   * Get speaking time statistics
   */
  getSpeakingStats(sessionId?: string): {
    userSpeakingTime: number;
    aiSpeakingTime: number;
    totalSpeakingTime: number;
    speakingRatio: number;
  } {
    let events = this.eventHistory;
    if (sessionId) {
      events = events.filter(event => event.sessionId === sessionId);
    }

    let userSpeakingTime = 0;
    let aiSpeakingTime = 0;
    let currentUserStart: Date | null = null;
    let currentAiStart: Date | null = null;

    events.forEach(event => {
      switch (event.type) {
        case 'user_speaking_start':
          currentUserStart = event.timestamp;
          break;
        case 'user_speaking_end':
          if (currentUserStart) {
            userSpeakingTime += event.timestamp.getTime() - currentUserStart.getTime();
            currentUserStart = null;
          }
          break;
        case 'ai_speaking_start':
          currentAiStart = event.timestamp;
          break;
        case 'ai_speaking_end':
          if (currentAiStart) {
            aiSpeakingTime += event.timestamp.getTime() - currentAiStart.getTime();
            currentAiStart = null;
          }
          break;
      }
    });

    const totalSpeakingTime = userSpeakingTime + aiSpeakingTime;
    const speakingRatio = totalSpeakingTime > 0 ? userSpeakingTime / totalSpeakingTime : 0;

    return {
      userSpeakingTime,
      aiSpeakingTime,
      totalSpeakingTime,
      speakingRatio,
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): Record<VoiceEventType, { count: number; avgProcessingTime: number }> {
    return Object.fromEntries(this.performanceMetrics) as Record<VoiceEventType, { count: number; avgProcessingTime: number }>;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recoverableErrors: number;
    criticalErrors: number;
  } {
    const errorEvents = this.getEventHistory<ErrorEvent>('error_occurred');
    const errorsByType: Record<string, number> = {};
    let recoverableErrors = 0;
    let criticalErrors = 0;

    errorEvents.forEach(event => {
      const errorType = event.error.type || 'unknown';
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      
      if (event.recoverable) {
        recoverableErrors++;
      } else {
        criticalErrors++;
      }
    });

    return {
      totalErrors: errorEvents.length,
      errorsByType,
      recoverableErrors,
      criticalErrors,
    };
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Add event to history with size management
   */
  private addToHistory(event: VoiceEvent): void {
    this.eventHistory.push(event);
    
    // Trim history if it exceeds max size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(eventType: VoiceEventType, processingTime: number): void {
    const current = this.performanceMetrics.get(eventType);
    
    if (current) {
      const newCount = current.count + 1;
      const newAvg = (current.avgProcessingTime * current.count + processingTime) / newCount;
      this.performanceMetrics.set(eventType, { count: newCount, avgProcessingTime: newAvg });
    } else {
      this.performanceMetrics.set(eventType, { count: 1, avgProcessingTime: processingTime });
    }
  }

  /**
   * Check if there are any handlers for an event type
   */
  hasHandlers(eventType: VoiceEventType): boolean {
    const handlers = this.handlers.get(eventType);
    return handlers ? handlers.size > 0 : false;
  }

  /**
   * Get number of handlers for an event type
   */
  getHandlerCount(eventType: VoiceEventType): number {
    const handlers = this.handlers.get(eventType);
    return handlers ? handlers.size : 0;
  }

  /**
   * Enable/disable event recording
   */
  setRecording(enabled: boolean): void {
    this.isRecording = enabled;
    if (!enabled) {
      this.eventHistory = [];
    }
  }

  /**
   * Export event history for debugging
   */
  exportEventHistory(): string {
    return JSON.stringify(this.eventHistory, null, 2);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }
}

// ==========================================
// EVENT HELPER FUNCTIONS
// ==========================================

/**
 * Create a connection changed event
 */
export function createConnectionEvent(
  status: ConnectionChangedEvent['status'],
  previousStatus: ConnectionChangedEvent['previousStatus'],
  sessionId?: string
): ConnectionChangedEvent {
  return {
    type: 'connection_changed',
    timestamp: new Date(),
    status,
    previousStatus,
    sessionId,
  };
}

/**
 * Create a speaking event
 */
export function createSpeakingEvent(
  type: 'user_speaking_start' | 'user_speaking_end' | 'ai_speaking_start' | 'ai_speaking_end',
  sessionId?: string,
  audioLevel?: number,
  duration?: number
): SpeakingEvent {
  return {
    type,
    timestamp: new Date(),
    sessionId,
    audioLevel,
    duration,
  };
}

/**
 * Create a transcript event
 */
export function createTranscriptEvent(
  text: string,
  role: 'user' | 'assistant',
  sessionId?: string,
  confidence?: number,
  isFinal?: boolean
): TranscriptEvent {
  return {
    type: 'transcript_received',
    timestamp: new Date(),
    sessionId,
    text,
    role,
    confidence,
    isFinal,
  };
}

/**
 * Create an error event
 */
export function createErrorEvent(
  error: VoiceError,
  sessionId?: string,
  context?: string,
  recoverable: boolean = true
): ErrorEvent {
  return {
    type: 'error_occurred',
    timestamp: new Date(),
    sessionId,
    error,
    context,
    recoverable,
  };
}

/**
 * Create an audio level event
 */
export function createAudioLevelEvent(
  level: number,
  peak: number,
  source: 'user' | 'ai',
  sessionId?: string
): AudioLevelEvent {
  return {
    type: 'audio_level_changed',
    timestamp: new Date(),
    sessionId,
    level,
    peak,
    source,
  };
}

// ==========================================
// GLOBAL EVENT EMITTER INSTANCE
// ==========================================

/**
 * Global voice event emitter instance
 * Use this for application-wide voice event coordination
 */
export const globalVoiceEvents = new VoiceEventEmitter({
  maxHistorySize: 200,
  recordHistory: true,
});

/**
 * Convenience function to emit events to the global emitter
 */
export function emitVoiceEvent<T extends VoiceEvent>(event: T): void {
  globalVoiceEvents.emit(event);
}

/**
 * Convenience function to subscribe to global voice events
 */
export function onVoiceEvent<T extends VoiceEvent>(
  eventType: T['type'],
  handler: VoiceEventHandler<T>
): () => void {
  return globalVoiceEvents.on(eventType, handler);
}