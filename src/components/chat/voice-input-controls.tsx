// src/components/chat/voice-input-controls.tsx - FIXED VERSION
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
}

interface VoiceRecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  transcript: string;
  confidence: number;
}

// ==========================================
// VOICE INPUT CONTROLS COMPONENT
// ==========================================

export function VoiceInputControls({
  onTranscript,
  onError,
  disabled = false,
  className,
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
      'getUserMedia' in navigator.mediaDevices &&
      ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
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
          noiseSuppression: true, // Use default browser setting instead of preferences
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
      }));

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      // Start audio level monitoring
      monitorAudioLevel();

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

  // Process recorded audio
  const processRecording = useCallback(async () => {
    try {
      if (audioChunksRef.current.length === 0) {
        setState(prev => ({ ...prev, isProcessing: false }));
        return;
      }

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
            setState(prev => ({
              ...prev,
              transcript: result.transcript,
              confidence: result.confidence || 0,
              isProcessing: false,
            }));
            
            // Send transcript to parent
            onTranscript(result.transcript);
          } else {
            throw new Error(result.error || 'Transcription failed');
          }
        } catch (error) {
          console.error('Error transcribing audio:', error);
          setState(prev => ({ ...prev, isProcessing: false }));
          onError?.('Failed to transcribe audio. Please try again.');
        }
      };
      
      reader.readAsDataURL(audioBlob);
      
    } catch (error) {
      console.error('Error processing recording:', error);
      setState(prev => ({ ...prev, isProcessing: false }));
      onError?.('Failed to process recording. Please try again.');
    }
  }, [preferences?.voiceLanguage, onTranscript, onError]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [state.isRecording, startRecording, stopRecording]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcript: '',
      confidence: 0,
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
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Main Controls */}
      <div className="flex items-center gap-2">
        {/* Record/Stop Button */}
        <div className="relative">
          <Button
            variant={state.isRecording ? "destructive" : "outline"}
            size="sm"
            onClick={toggleRecording}
            disabled={disabled || state.isProcessing}
            className={cn(
              "relative overflow-hidden transition-all duration-200",
              state.isRecording && "animate-pulse"
            )}
            title={state.isRecording ? "Stop voice recording" : "Start voice recording"}
          >
            {state.isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : state.isRecording ? (
              <Square className="h-4 w-4 mr-1" />
            ) : (
              <Mic className="h-4 w-4 mr-1" />
            )}
            
            <span className="text-xs">
              {state.isProcessing 
                ? "Processing..." 
                : state.isRecording 
                  ? "Stop" 
                  : "Voice"
              }
            </span>

            {/* Audio level indicator */}
            {state.isRecording && (
              <div
                className="absolute inset-0 bg-red-600/20 transition-all duration-100"
                style={{ opacity: state.audioLevel }}
              />
            )}
          </Button>
        </div>

        {/* Duration & Status */}
        {(state.isRecording || state.isProcessing) && (
          <div className="flex items-center gap-2">
            <Badge variant={state.isRecording ? "destructive" : "secondary"}>
              {state.isRecording ? (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1" />
                  {formatDuration(state.duration)}
                </>
              ) : (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Processing
                </>
              )}
            </Badge>

            {/* Audio level visualization */}
            {state.isRecording && (
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1 h-4 bg-gray-300 transition-all duration-100",
                      state.audioLevel > (i * 0.2) && "bg-green-500"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Voice Input Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Languages className="h-4 w-4 mr-2" />
              Language: {preferences?.voiceLanguage || 'English'}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Volume2 className="h-4 w-4 mr-2" />
              Noise Suppression: On
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={clearTranscript}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Transcript
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Transcript Display */}
      {state.transcript && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    Voice Transcript
                  </span>
                  {state.confidence > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {Math.round(state.confidence * 100)}% confident
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-green-700 dark:text-green-300 leading-relaxed">
                  "{state.transcript}"
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearTranscript}
                className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}