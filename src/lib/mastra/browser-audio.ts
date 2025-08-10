// src/lib/mastra/browser-audio.ts
// Browser-based audio utilities for real-time voice playback

import { AudioMetadata } from '@/lib/voice/voice-types';

// ==========================================
// INTERFACES & TYPES
// ==========================================

export interface AudioPlaybackOptions {
  volume?: number; // 0.0 to 1.0
  interrupt?: boolean; // Stop current playback
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface AudioVisualizationData {
  frequencies: Uint8Array;
  waveform: Uint8Array;
  volume: number;
  peak: number;
}

export interface BrowserAudioConfig {
  sampleRate: number;
  bufferSize: number;
  enableVisualization: boolean;
  maxConcurrentSources: number;
}

// ==========================================
// BROWSER AUDIO MANAGER
// ==========================================

/**
 * BrowserAudioManager - Handles real-time audio playback in the browser
 * 
 * Features:
 * - PCM audio playback from Mastra real-time voice
 * - Volume control and mixing
 * - Audio visualization data
 * - Multiple concurrent audio sources
 * - Interruption and seamless switching
 */
export class BrowserAudioManager {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private currentSources: AudioBufferSourceNode[] = [];
  private config: BrowserAudioConfig;
  private isInitialized: boolean = false;
  private visualizationData: AudioVisualizationData | null = null;
  private animationFrameId: number | null = null;

  constructor(config?: Partial<BrowserAudioConfig>) {
    this.config = {
      sampleRate: 24000,
      bufferSize: 4096,
      enableVisualization: true,
      maxConcurrentSources: 3,
      ...config,
    };
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  /**
   * Initialize the audio context and nodes
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔊 Browser audio manager already initialized');
      return;
    }

    try {
      console.log('🔊 Initializing browser audio manager...');
      
      // Create audio context with optimal settings
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate,
        latencyHint: 'interactive', // Optimize for low latency
      });

      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;
      this.gainNode.connect(this.audioContext.destination);

      // Create analyser node for visualization if enabled
      if (this.config.enableVisualization) {
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 256;
        this.analyserNode.smoothingTimeConstant = 0.8;
        this.analyserNode.connect(this.gainNode);
        
        // Start visualization loop
        this.startVisualization();
      }

      // Resume audio context if suspended (required by browser policies)
      if (this.audioContext.state === 'suspended') {
        await this.resumeAudioContext();
      }

      this.isInitialized = true;
      console.log('✅ Browser audio manager initialized');
      
    } catch (error) {
      console.error('Failed to initialize audio manager:', error);
      throw new Error(`Audio initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resume audio context (required after user interaction)
   */
  async resumeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('🔊 Audio context resumed');
      } catch (error) {
        console.error('Failed to resume audio context:', error);
        throw error;
      }
    }
  }

  // ==========================================
  // AUDIO PLAYBACK
  // ==========================================

  /**
   * Play PCM audio data from Mastra real-time voice
   */
  async playPCMAudio(audioData: Int16Array, options: AudioPlaybackOptions = {}): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.audioContext || !this.gainNode) {
      throw new Error('Audio context not initialized');
    }

    try {
      // Interrupt current playback if requested
      if (options.interrupt) {
        this.stopAllSources();
      }

      // Limit concurrent sources
      if (this.currentSources.length >= this.config.maxConcurrentSources) {
        this.stopOldestSource();
      }

      // Create audio buffer from PCM data
      const buffer = await this.createAudioBufferFromPCM(audioData);
      
      // Create and configure audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      
      // Connect to audio graph
      const targetNode = this.analyserNode || this.gainNode;
      source.connect(targetNode);

      // Set up event handlers
      source.onended = () => {
        this.removeSource(source);
        options.onEnd?.();
      };

      // Apply volume if specified
      if (options.volume !== undefined) {
        const volumeGain = this.audioContext.createGain();
        volumeGain.gain.value = Math.max(0, Math.min(1, options.volume));
        source.disconnect();
        source.connect(volumeGain);
        volumeGain.connect(targetNode);
      }

      // Start playback
      source.start();
      this.currentSources.push(source);
      
      options.onStart?.();
      
      console.log(`🔊 Playing PCM audio: ${audioData.length} samples`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Audio playback failed';
      console.error('PCM audio playback error:', error);
      options.onError?.(new Error(errorMessage));
      throw new Error(`Failed to play PCM audio: ${errorMessage}`);
    }
  }

  /**
   * Play standard audio data (MP3, WAV, etc.)
   */
  async playAudioBlob(audioBlob: Blob, options: AudioPlaybackOptions = {}): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.audioContext || !this.gainNode) {
      throw new Error('Audio context not initialized');
    }

    try {
      // Interrupt current playback if requested
      if (options.interrupt) {
        this.stopAllSources();
      }

      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode audio data
      const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Create and configure audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      
      // Connect to audio graph
      const targetNode = this.analyserNode || this.gainNode;
      source.connect(targetNode);

      // Set up event handlers
      source.onended = () => {
        this.removeSource(source);
        options.onEnd?.();
      };

      // Apply volume if specified
      if (options.volume !== undefined) {
        const volumeGain = this.audioContext.createGain();
        volumeGain.gain.value = Math.max(0, Math.min(1, options.volume));
        source.disconnect();
        source.connect(volumeGain);
        volumeGain.connect(targetNode);
      }

      // Start playback
      source.start();
      this.currentSources.push(source);
      
      options.onStart?.();
      
      console.log(`🔊 Playing audio blob: ${buffer.duration.toFixed(2)}s`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Audio playback failed';
      console.error('Audio blob playback error:', error);
      options.onError?.(new Error(errorMessage));
      throw new Error(`Failed to play audio blob: ${errorMessage}`);
    }
  }

  // ==========================================
  // PLAYBACK CONTROL
  // ==========================================

  /**
   * Stop all currently playing audio
   */
  stopAllSources(): void {
    this.currentSources.forEach(source => {
      try {
        source.stop();
      } catch (error) {
        // Source may already be stopped
      }
    });
    this.currentSources = [];
    console.log('🔇 Stopped all audio sources');
  }

  /**
   * Stop the oldest playing audio source
   */
  private stopOldestSource(): void {
    if (this.currentSources.length > 0) {
      const oldestSource = this.currentSources.shift();
      if (oldestSource) {
        try {
          oldestSource.stop();
        } catch (error) {
          // Source may already be stopped
        }
      }
    }
  }

  /**
   * Remove a source from the active sources list
   */
  private removeSource(source: AudioBufferSourceNode): void {
    const index = this.currentSources.indexOf(source);
    if (index > -1) {
      this.currentSources.splice(index, 1);
    }
  }

  // ==========================================
  // VOLUME & SETTINGS
  // ==========================================

  /**
   * Set master volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      this.gainNode.gain.value = clampedVolume;
      console.log(`🔊 Volume set to: ${Math.round(clampedVolume * 100)}%`);
    }
  }

  /**
   * Get current master volume
   */
  getVolume(): number {
    return this.gainNode?.gain.value || 0;
  }

  /**
   * Mute/unmute audio
   */
  setMuted(muted: boolean): void {
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : 1;
      console.log(`🔊 Audio ${muted ? 'muted' : 'unmuted'}`);
    }
  }

  // ==========================================
  // VISUALIZATION
  // ==========================================

  /**
   * Start audio visualization data collection
   */
  private startVisualization(): void {
    if (!this.analyserNode) return;

    const updateVisualization = () => {
      if (!this.analyserNode) return;

      // Get frequency data
      const frequencies = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.analyserNode.getByteFrequencyData(frequencies);

      // Get waveform data
      const waveform = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.analyserNode.getByteTimeDomainData(waveform);

      // Calculate volume and peak
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < frequencies.length; i++) {
        sum += frequencies[i];
        peak = Math.max(peak, frequencies[i]);
      }
      const volume = sum / frequencies.length / 255;

      this.visualizationData = {
        frequencies,
        waveform,
        volume,
        peak: peak / 255,
      };

      this.animationFrameId = requestAnimationFrame(updateVisualization);
    };

    updateVisualization();
  }

  /**
   * Get current visualization data
   */
  getVisualizationData(): AudioVisualizationData | null {
    return this.visualizationData;
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Create AudioBuffer from PCM Int16Array data
   */
  private async createAudioBufferFromPCM(pcmData: Int16Array): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    // Create audio buffer
    const buffer = this.audioContext.createBuffer(
      1, // mono
      pcmData.length,
      this.config.sampleRate
    );

    // Get channel data and convert Int16 to Float32
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768; // Convert Int16 to Float32 (-1 to 1)
    }

    return buffer;
  }

  /**
   * Get audio metadata from buffer
   */
  getAudioMetadata(buffer: AudioBuffer): AudioMetadata {
    return {
      duration: buffer.duration,
      format: 'pcm',
      fileSize: buffer.length * buffer.numberOfChannels * 4, // Float32 = 4 bytes
      isRealtime: true,
      processingTime: 0, // Real-time, no processing delay
    };
  }

  /**
   * Check if audio is currently playing
   */
  isPlaying(): boolean {
    return this.currentSources.length > 0;
  }

  /**
   * Get number of active audio sources
   */
  getActiveSourceCount(): number {
    return this.currentSources.length;
  }

  /**
   * Get audio context state
   */
  getAudioContextState(): AudioContextState | null {
    return this.audioContext?.state || null;
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  /**
   * Dispose of the audio manager and clean up resources
   */
  dispose(): void {
    console.log('🔊 Disposing browser audio manager...');

    // Stop visualization
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop all sources
    this.stopAllSources();

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(error => {
        console.error('Error closing audio context:', error);
      });
    }

    // Reset state
    this.audioContext = null;
    this.gainNode = null;
    this.analyserNode = null;
    this.currentSources = [];
    this.visualizationData = null;
    this.isInitialized = false;

    console.log('✅ Browser audio manager disposed');
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Check if Web Audio API is supported
 */
export function isWebAudioSupported(): boolean {
  return !!(window.AudioContext || (window as any).webkitAudioContext);
}

/**
 * Get optimal audio configuration for the current device
 */
export function getOptimalAudioConfig(): BrowserAudioConfig {
  // Detect device capabilities
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isLowEnd = navigator.hardwareConcurrency <= 2;

  return {
    sampleRate: isMobile ? 22050 : 24000, // Lower sample rate for mobile
    bufferSize: isLowEnd ? 2048 : 4096, // Smaller buffer for low-end devices
    enableVisualization: !isLowEnd, // Disable visualization on low-end devices
    maxConcurrentSources: isMobile ? 2 : 3, // Fewer sources on mobile
  };
}

/**
 * Request audio permissions and test playback capability
 */
export async function testAudioCapability(): Promise<{
  supported: boolean;
  permissions: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let supported = true;
  let permissions = true;

  try {
    // Check Web Audio API support
    if (!isWebAudioSupported()) {
      supported = false;
      errors.push('Web Audio API not supported');
    }

    // Test audio context creation
    const testContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Test audio context resumption (permission check)
    if (testContext.state === 'suspended') {
      try {
        await testContext.resume();
      } catch (error) {
        permissions = false;
        errors.push('Audio permission denied or not available');
      }
    }

    // Clean up test context
    await testContext.close();
    
  } catch (error) {
    supported = false;
    errors.push(`Audio capability test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { supported, permissions, errors };
}

/**
 * Create a browser audio manager with optimal configuration
 */
export function createBrowserAudioManager(config?: Partial<BrowserAudioConfig>): BrowserAudioManager {
  const optimalConfig = getOptimalAudioConfig();
  return new BrowserAudioManager({ ...optimalConfig, ...config });
}