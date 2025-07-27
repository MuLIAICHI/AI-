// src/components/chat/voice-input-controls.tsx - AUTO-SEND VERSION
'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Volume2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Trash2,
  Languages,
  Send,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoicePreferences } from '@/hooks/use-voice-preferences';

// ==========================================
// INTERFACES
// ==========================================

interface VoiceInputControlsProps {
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
  // 🚀 ENHANCED: Streamlined voice experience
  autoSend?: boolean;
  onAutoSend?: (transcript: string) => Promise<void>;
  showTranscript?: boolean;
  minConfidence?: number;
  silentMode?: boolean; // 🚀 NEW: Pure voice-to-voice mode
}

interface VoiceRecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  transcript: string;
  confidence: number;
  isAutoSending: boolean; // 🚀 NEW: Track auto-send state
}

// ==========================================
// VOICE INPUT CONTROLS COMPONENT - ENHANCED
// ==========================================

export function VoiceInputControls({
  onTranscript,
  onError,
  disabled = false,
  className,
  // 🚀 ENHANCED: Streamlined voice defaults
  autoSend = true,
  onAutoSend,
  showTranscript = false, // 🚀 CHANGED: Default to hidden for streamlined experience
  minConfidence = 0.6,    // 🚀 CHANGED: Lower threshold for faster response
  silentMode = true,      // 🚀 NEW: Default to silent mode
}: VoiceInputControlsProps) {
  const { preferences, isVoiceEnabled } = useVoicePreferences();
  
  // Recording state
  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    isProcessing: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
    transcript: '',
    confidence: 0,
    isAutoSending: false, // 🚀 NEW
  });

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Check if voice input is available and enabled
  const isVoiceInputAvailable = useMemo(() => {
    return (
      !disabled &&
      isVoiceEnabled &&
      preferences?.voiceInputEnabled &&
      'mediaDevices' in navigator &&
      'getUserMedia' in navigator.mediaDevices
    );
  }, [disabled, isVoiceEnabled, preferences?.voiceInputEnabled]);

  // Audio level monitoring
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const level = average / 255; // Normalize to 0-1

    setState(prev => ({ ...prev, audioLevel: level }));
    
    if (state.isRecording && !state.isPaused) {
      animationRef.current = requestAnimationFrame(monitorAudioLevel);
    }
  }, [state.isRecording, state.isPaused]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      streamRef.current = stream;

      // Set up audio analysis
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Set up media recorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        await processRecording();
      };

      // Start recording
      mediaRecorderRef.current.start();
      
      setState(prev => ({
        ...prev,
        isRecording: true,
        duration: 0,
        transcript: '',
        confidence: 0,
        isAutoSending: false,
      }));

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      // Start audio level monitoring
      monitorAudioLevel();

      console.log('🎤 Voice recording started');

    } catch (error) {
      console.error('Error starting voice recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      onError?.(errorMessage);
      
      if (error instanceof Error && error.name === 'NotAllowedError') {
        onError?.('Microphone permission denied. Please allow microphone access to use voice input.');
      }
    }
  }, [monitorAudioLevel, onError]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      setState(prev => ({ ...prev, isRecording: false, isProcessing: true }));
      console.log('🎤 Voice recording stopped, processing...');
    }

    // Clean up timers and animation
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [state.isRecording]);

  // 🚀 STREAMLINED: Process recorded audio with silent auto-send
  const processRecording = useCallback(async () => {
    try {
      if (audioChunksRef.current.length === 0) {
        setState(prev => ({ ...prev, isProcessing: false }));
        return;
      }

      console.log('🔄 Processing audio for transcription...');
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      
      // Convert to base64 for API
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = reader.result as string;
        
        try {
          // Call speech-to-text API
          const response = await fetch('/api/voice/transcribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audio: base64Audio,
              language: preferences?.voiceLanguage || 'en',
            }),
          });

          const result = await response.json();
          
          if (result.success && result.transcript) {
            const transcript = result.transcript.trim();
            const confidence = result.confidence || 0;
            
            console.log('✅ Transcription successful:', { transcript, confidence });
            
            // 🚀 STREAMLINED: Update state but don't show transcript in silent mode
            setState(prev => ({
              ...prev,
              transcript: silentMode ? '' : transcript, // Don't store transcript in silent mode
              confidence,
              isProcessing: false,
            }));
            
            // Always call onTranscript for backward compatibility
            onTranscript(transcript);
            
            // 🚀 STREAMLINED: Auto-send immediately in silent mode (ignore confidence)
            if (silentMode && autoSend && onAutoSend) {
              console.log('🚀 SILENT MODE: Auto-sending transcript immediately...', {
                transcript,
                confidence,
                silentMode,
                autoSend,
                ignoreConfidence: true
              });
              setState(prev => ({ ...prev, isAutoSending: true }));
              
              try {
                await onAutoSend(transcript);
                console.log('✅ SILENT MODE: Auto-send successful');
                
                // Clear all state immediately in silent mode
                setState(prev => ({
                  ...prev,
                  transcript: '',
                  confidence: 0,
                  isAutoSending: false,
                }));
                
              } catch (autoSendError) {
                console.error('❌ SILENT MODE: Auto-send failed:', autoSendError);
                setState(prev => ({ ...prev, isAutoSending: false }));
                onError?.('Failed to send message to AI. Please try again.');
              }
            }
            // 🚀 LEGACY: Normal mode with transcript display
            else if (autoSend && onAutoSend && confidence >= minConfidence) {
              console.log('🚀 Auto-sending transcript to AI...');
              setState(prev => ({ ...prev, isAutoSending: true }));
              
              try {
                await onAutoSend(transcript);
                console.log('✅ Auto-send successful');
                
                // Clear transcript after successful send
                setTimeout(() => {
                  setState(prev => ({
                    ...prev,
                    transcript: '',
                    confidence: 0,
                    isAutoSending: false,
                  }));
                }, 1000);
                
              } catch (autoSendError) {
                console.error('❌ Auto-send failed:', autoSendError);
                setState(prev => ({ ...prev, isAutoSending: false }));
                onError?.('Failed to send message to AI. Please try again.');
              }
            } else if (autoSend && confidence < minConfidence) {
              console.warn('⚠️ Confidence too low for auto-send:', confidence);
              setState(prev => ({ ...prev, isAutoSending: false }));
            }
            
          } else {
            throw new Error(result.error || 'Transcription failed');
          }
        } catch (error) {
          console.error('Error transcribing audio:', error);
          setState(prev => ({ ...prev, isProcessing: false, isAutoSending: false }));
          onError?.('Failed to transcribe audio. Please try again.');
        }
      };
      
      reader.readAsDataURL(audioBlob);
      
    } catch (error) {
      console.error('Error processing recording:', error);
      setState(prev => ({ ...prev, isProcessing: false, isAutoSending: false }));
      onError?.('Failed to process recording. Please try again.');
    }
  }, [preferences?.voiceLanguage, onTranscript, autoSend, onAutoSend, minConfidence, silentMode, onError]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [state.isRecording, startRecording, stopRecording]);

  // 🚀 NEW: Manual send (if auto-send fails or disabled)
  const handleManualSend = useCallback(async () => {
    if (state.transcript && onAutoSend) {
      setState(prev => ({ ...prev, isAutoSending: true }));
      
      try {
        await onAutoSend(state.transcript);
        console.log('✅ Manual send successful');
        
        // Clear transcript after successful send
        setState(prev => ({
          ...prev,
          transcript: '',
          confidence: 0,
          isAutoSending: false,
        }));
        
      } catch (error) {
        console.error('❌ Manual send failed:', error);
        setState(prev => ({ ...prev, isAutoSending: false }));
        onError?.('Failed to send message to AI. Please try again.');
      }
    }
  }, [state.transcript, onAutoSend, onError]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcript: '',
      confidence: 0,
      isAutoSending: false,
    }));
  }, []);

  // Format duration
  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.isRecording) {
        stopRecording();
      }
    };
  }, [state.isRecording, stopRecording]);

  // Don't render if voice input is not available
  if (!isVoiceInputAvailable) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      
      {/* 🚀 STREAMLINED: Main Controls with Minimal Status */}
      <div className="flex items-center justify-center gap-4">
        
        {/* 🚀 STREAMLINED: Primary Voice Button */}
        <div className="relative">
          <Button
            variant={state.isRecording ? "destructive" : "default"}
            size="lg"
            onClick={toggleRecording}
            disabled={disabled || state.isProcessing || state.isAutoSending}
            className={cn(
              "relative overflow-hidden transition-all duration-200 min-w-[140px] h-12",
              state.isRecording && "animate-pulse shadow-xl shadow-red-500/30",
              (state.isProcessing || state.isAutoSending) && "bg-blue-600 hover:bg-blue-700"
            )}
            title={
              state.isRecording ? "Stop speaking" : 
              state.isProcessing ? "Processing your speech..." :
              state.isAutoSending ? "Sending to AI..." :
              "Start speaking"
            }
          >
            {state.isAutoSending ? (
              <>
                <Send className="h-5 w-5 mr-2 animate-pulse" />
                <span className="font-medium">Sending to AI...</span>
              </>
            ) : state.isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="font-medium">Processing...</span>
              </>
            ) : state.isRecording ? (
              <>
                <Square className="h-5 w-5 mr-2" />
                <span className="font-medium">Stop Speaking</span>
              </>
            ) : (
              <>
                <Mic className="h-5 w-5 mr-2" />
                <span className="font-medium">Start Speaking</span>
              </>
            )}

            {/* Audio level indicator overlay */}
            {state.isRecording && (
              <div
                className="absolute inset-0 bg-white/10 transition-all duration-100 pointer-events-none"
                style={{ opacity: state.audioLevel * 0.7 }}
              />
            )}
          </Button>
        </div>

        {/* 🚀 STREAMLINED: Minimal Status Indicators */}
        {(state.isRecording || state.isProcessing || state.isAutoSending) && (
          <div className="flex items-center gap-3">
            
            {/* Recording Duration */}
            {state.isRecording && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  {formatDuration(state.duration)}
                </span>
              </div>
            )}
            
            {/* Processing Status */}
            {state.isProcessing && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Converting speech...
                </span>
              </div>
            )}
            
            {/* Auto-sending Status */}
            {state.isAutoSending && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <Send className="h-4 w-4 text-green-600 animate-pulse" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Sending to AI...
                </span>
              </div>
            )}

            {/* Audio Level Visualization */}
            {state.isRecording && (
              <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 dark:bg-gray-950/20 rounded-lg">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1 h-4 bg-gray-300 rounded-full transition-all duration-100",
                      state.audioLevel > (i * 0.2) && "bg-green-500 h-5"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings (only show in non-silent mode) */}
        {!silentMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Voice Input Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Languages className="h-4 w-4 mr-2" />
                Language: {preferences?.voiceLanguage || 'English'}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Volume2 className="h-4 w-4 mr-2" />
                Mode: {silentMode ? 'Silent' : 'Interactive'}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MessageSquare className="h-4 w-4 mr-2" />
                Min Confidence: {Math.round(minConfidence * 100)}%
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* 🚀 STRICTLY SILENT: Never show transcript in silent mode */}
      {!silentMode && showTranscript && state.transcript && (
        <Card className={cn(
          "border-2 transition-all duration-200",
          state.confidence >= minConfidence 
            ? "border-green-200 bg-green-50 dark:bg-green-950/20" 
            : "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              
              {/* Transcript Content */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {state.isAutoSending ? (
                    <Badge variant="default" className="bg-blue-600">
                      <Send className="h-3 w-3 mr-1" />
                      Sending to AI...
                    </Badge>
                  ) : state.confidence >= minConfidence ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      High Confidence ({Math.round(state.confidence * 100)}%)
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Low Confidence ({Math.round(state.confidence * 100)}%)
                    </Badge>
                  )}
                </div>
                
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                  "{state.transcript}"
                </p>
                
                {/* Auto-send Status */}
                {autoSend && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    {state.isAutoSending 
                      ? "🚀 Automatically sending to AI..." 
                      : state.confidence >= minConfidence
                        ? "✅ Automatically sent to AI!"
                        : `⚠️ Confidence too low (${Math.round(state.confidence * 100)}%) - manual send required`
                    }
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                
                {/* Manual Send (if auto-send failed or disabled) */}
                {(!autoSend || state.confidence < minConfidence) && !state.isAutoSending && (
                  <Button
                    size="sm"
                    onClick={handleManualSend}
                    disabled={!state.transcript || state.isAutoSending}
                    className="min-w-[80px]"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Send
                  </Button>
                )}
                
                {/* Clear Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearTranscript}
                  disabled={state.isAutoSending}
                  className="min-w-[80px]"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 🚀 STREAMLINED: Simple Status Messages for Silent Mode */}
      {silentMode && !state.isRecording && !state.isProcessing && !state.isAutoSending && (
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            🎤 Click "Start Speaking" and talk naturally - I'll send your message to the AI automatically
          </p>
        </div>
      )}

      {/* Error Messages */}
      {autoSend && !onAutoSend && (
        <div className="text-xs text-amber-600 dark:text-amber-400 text-center">
          ⚠️ Auto-send enabled but no send handler provided
        </div>
      )}
    </div>
  );
}