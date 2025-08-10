// src/components/chat/chat-input-composer.tsx
'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, 
  Mic, 
  MicOff, 
  Loader2, 
  Square,
  Pause,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoicePreferences } from '@/hooks/use-voice-preferences';

// ==========================================
// INTERFACES
// ==========================================

interface ChatInputComposerProps {
  onSubmit: (message: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  voiceEnabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  maxLength?: number;
}

interface VoiceRecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  isPaused: boolean;
  duration: number;
  error: string | null;
}

// ==========================================
// CHAT INPUT COMPOSER COMPONENT
// ==========================================

export function ChatInputComposer({
  onSubmit,
  disabled = false,
  placeholder = "Type a message...",
  voiceEnabled = false,
  className,
  autoFocus = true,
  maxLength = 4000,
}: ChatInputComposerProps) {
  
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceRecordingState>({
    isRecording: false,
    isProcessing: false,
    isPaused: false,
    duration: 0,
    error: null,
  });

  // ==========================================
  // REFS AND HOOKS
  // ==========================================
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { preferences } = useVoicePreferences();

  // ==========================================
  // COMPUTED VALUES
  // ==========================================
  
  const canSubmit = input.trim().length > 0 && !disabled && !isSubmitting;
  const isVoiceAvailable = voiceEnabled && 'MediaRecorder' in window;
  const isRecordingActive = voiceState.isRecording || voiceState.isProcessing;
  
  const effectivePlaceholder = isVoiceAvailable && preferences?.voiceInputEnabled
    ? "Type a message or use voice input..."
    : placeholder;

  // ==========================================
  // TEXT INPUT HANDLERS
  // ==========================================
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setInput(value);
    }
  }, [maxLength]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) {
        handleSubmit();
      }
    }
  }, [canSubmit, handleSubmit]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    const message = input.trim();
    setIsSubmitting(true);
    
    try {
      await onSubmit(message);
      setInput('');
      
      // Reset textarea height after clearing
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }, 0);
      
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSubmitting(false);
      textareaRef.current?.focus();
    }
  }, [canSubmit, input, onSubmit]);

  // ==========================================
  // VOICE INPUT HANDLERS
  // ==========================================
  
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setVoiceState(prev => ({ ...prev, duration: 0 }));
  }, []);
  
  const startVoiceRecording = useCallback(async () => {
    if (!isVoiceAvailable || voiceState.isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setVoiceState(prev => ({ ...prev, isRecording: false, isProcessing: true }));
        
        try {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          
          // Convert blob to base64 (matching API expectation)
          const reader = new FileReader();
          reader.onload = async () => {
            const base64Audio = reader.result as string;
            
            try {
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

              if (!response.ok) {
                throw new Error('Transcription failed');
              }

              const result = await response.json();
              const transcript = result.transcript;
          
          if (transcript?.trim()) {
            setInput(prev => prev + (prev ? ' ' : '') + transcript.trim());
            textareaRef.current?.focus();
          }

        } catch (error) {
          console.error('Voice transcription error:', error);
          setVoiceState(prev => ({ 
            ...prev, 
            error: 'Failed to transcribe voice. Please try again.' 
          }));
        } finally {
          setVoiceState(prev => ({ ...prev, isProcessing: false }));
          cleanup();
        }
      };

      mediaRecorder.start();
      setVoiceState(prev => ({ ...prev, isRecording: true, error: null }));

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setVoiceState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

    } catch (error) {
      console.error('Failed to start voice recording:', error);
      setVoiceState(prev => ({ 
        ...prev, 
        error: 'Microphone access denied. Please enable microphone permissions.' 
      }));
    }
  }, [isVoiceAvailable, voiceState.isRecording]);

  const stopVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current && voiceState.isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [voiceState.isRecording]);

  // ==========================================
  // EFFECTS
  // ==========================================
  
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Clear voice error after 5 seconds
  useEffect(() => {
    if (voiceState.error) {
      const timer = setTimeout(() => {
        setVoiceState(prev => ({ ...prev, error: null }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [voiceState.error]);

  // ==========================================
  // RENDER VOICE BUTTON
  // ==========================================
  
  const renderVoiceButton = () => {
    if (!isVoiceAvailable) return null;

    const isActive = voiceState.isRecording;
    const isLoading = voiceState.isProcessing;

    return (
      <Button
        type="button"
        variant={isActive ? "destructive" : "ghost"}
        size="sm"
        className={cn(
          "h-10 w-10 p-0 shrink-0 transition-all duration-200",
          isActive && "animate-pulse shadow-lg shadow-red-500/25",
          isLoading && "bg-blue-600 hover:bg-blue-700"
        )}
        onClick={isActive ? stopVoiceRecording : startVoiceRecording}
        disabled={disabled || isLoading}
        title={
          isLoading ? "Processing voice..." :
          isActive ? "Stop recording" : 
          "Start voice recording"
        }
        aria-label={
          isLoading ? "Processing voice input" :
          isActive ? "Stop voice recording" : 
          "Start voice recording"
        }
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <Square className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>
    );
  };

  // ==========================================
  // RENDER COMPONENT
  // ==========================================
  
  return (
    <div className={cn("w-full", className)}>
      
      {/* Voice Error Display */}
      {voiceState.error && (
        <div className="mb-3 px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-700 dark:text-red-300">{voiceState.error}</p>
        </div>
      )}

      {/* Voice Recording Status */}
      {(voiceState.isRecording || voiceState.isProcessing) && (
        <div className="mb-3 px-3 py-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex items-center gap-2">
            {voiceState.isRecording ? (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  Recording... {Math.floor(voiceState.duration / 60)}:{(voiceState.duration % 60).toString().padStart(2, '0')}
                </span>
              </>
            ) : (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  Processing voice input...
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Input Container */}
      <div className="relative flex items-end gap-2 p-3 bg-background border border-input rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-ring">
        
        {/* Textarea */}
        <div className="flex-1 min-w-0">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={effectivePlaceholder}
            disabled={disabled || isSubmitting}
            autoResize
            minRows={1}
            maxRows={5}
            className="border-0 shadow-none resize-none focus-visible:ring-0 p-0 min-h-[40px]"
            aria-label="Message input"
          />
          
          {/* Character Counter */}
          {input.length > maxLength * 0.8 && (
            <div className="text-xs text-muted-foreground mt-1 text-right">
              {input.length}/{maxLength}
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-1 pb-1">
          
          {/* Voice Button */}
          {renderVoiceButton()}

          {/* Send Button */}
          <Button
            type="submit"
            size="sm"
            className="h-10 w-10 p-0 shrink-0"
            onClick={handleSubmit}
            disabled={!canSubmit}
            title={canSubmit ? "Send message (Enter)" : "Type a message to send"}
            aria-label="Send message"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
          
        </div>
      </div>

      {/* Usage Hints */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          {isVoiceAvailable && (
            <span>🎤 Voice input available</span>
          )}
          <span>Press Enter to send • Shift+Enter for new line</span>
        </div>
        {input.length > 0 && (
          <span>{input.length} characters</span>
        )}
      </div>
      
    </div>
  );
}