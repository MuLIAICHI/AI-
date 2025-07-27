'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChat, type Message } from '@/hooks/use-chat';
import { MessageItem } from './message-item';
import { VoiceInputControls } from './voice-input-controls';
import { VoiceSettingsPanel } from '../settings/voice-settings-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Loader2, 
  Bot, 
  Sparkles, 
  MessageSquare,
  Computer,
  DollarSign,
  Heart,
  Zap,
  Target,
  BookOpen,
  AlertCircle,
  RefreshCw,
  User,
  Volume2,
  VolumeX,
  Settings,
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoicePreferences } from '@/hooks/use-voice-preferences';
import { useVoice } from '@/hooks/use-voice';

// ==========================================
// INTERFACES
// ==========================================

interface ChatWindowProps {
  className?: string;
  showWelcome?: boolean;
  enableVoice?: boolean;
}

// ==========================================
// VOICE STATUS INDICATOR COMPONENT
// ==========================================

function VoiceStatusIndicator() {
  const { 
    isPlaying, 
    isPaused, 
    isLoading: voiceLoading, 
    currentText, 
    sessionActive,
    stop 
  } = useVoice();
  const { preferences } = useVoicePreferences();

  // Don't show if voice is disabled
  if (!preferences?.voiceEnabled) {
    return null;
  }

  // Currently speaking
  if (isPlaying && currentText) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/20 rounded-full text-blue-700 dark:text-blue-300 text-sm">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span>🎵 Playing</span>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={stop}
          className="h-5 w-5 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/50"
          title="Stop playback"
        >
          <Square className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Loading voice
  if (voiceLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 dark:bg-orange-950/20 rounded-full text-orange-700 dark:text-orange-300 text-sm">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>🎤 Loading voice...</span>
      </div>
    );
  }

  // Paused
  if (isPaused) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-yellow-50 dark:bg-yellow-950/20 rounded-full text-yellow-700 dark:text-yellow-300 text-sm">
        <Pause className="h-3 w-3" />
        <span>⏸️ Paused</span>
      </div>
    );
  }

  // Session active - ready to speak
  if (sessionActive) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-950/20 rounded-full text-green-700 dark:text-green-300 text-sm">
        <Volume2 className="h-3 w-3" />
        <span>🎤 Voice ready</span>
      </div>
    );
  }

  return null;
}

// ==========================================
// VOICE CHAT ORCHESTRATOR
// ==========================================

/**
 * Handles auto-play and voice coordination for the chat
 */
function useVoiceChatOrchestrator() {
  const { messages } = useChat();
  const { preferences } = useVoicePreferences();
  const { speak, isPlaying, stop } = useVoice();
  
  // Track last processed message to avoid re-playing
  const lastProcessedMessageRef = useRef<string | null>(null);
  
  // Auto-play new AI messages
  useEffect(() => {
    console.log('🔍 Auto-play check:', {
      voiceEnabled: preferences?.voiceEnabled,
      voiceAutoplay: preferences?.voiceAutoplay,
      messagesCount: messages.length
    });
    
    if (!preferences?.voiceEnabled || !preferences?.voiceAutoplay) {
      console.log('❌ Auto-play disabled:', { 
        voiceEnabled: preferences?.voiceEnabled, 
        voiceAutoplay: preferences?.voiceAutoplay 
      });
      return;
    }

    // Get the last assistant message (ignore system messages)
    const lastAssistantMessage = [...messages]
      .reverse()
      .find(msg => msg.role === 'assistant');

    console.log('🔍 Last assistant message:', {
      id: lastAssistantMessage?.id,
      processed: lastProcessedMessageRef.current,
      content: lastAssistantMessage?.content?.substring(0, 50) + '...',
      isStreaming: lastAssistantMessage?.metadata?.isStreaming
    });

    // If we have a new assistant message that hasn't been processed
    if (
      lastAssistantMessage && 
      lastAssistantMessage.id !== lastProcessedMessageRef.current &&
      lastAssistantMessage.content.trim().length > 10 && // Only substantial content
      !lastAssistantMessage.metadata?.isStreaming // Don't play while streaming
    ) {
      
      console.log('🎤 Auto-playing new AI message:', lastAssistantMessage.id);
      
      // Mark as processed
      lastProcessedMessageRef.current = lastAssistantMessage.id;
      
      // Auto-play the message
      speak({
        text: lastAssistantMessage.content,
        voiceId: preferences.preferredVoice,
        speed: preferences.voiceSpeed || 1.0,
        interrupt: true, // Stop any current playback
        onStart: () => console.log('🎵 Auto-play started for:', lastAssistantMessage.id),
        onComplete: () => console.log('✅ Auto-play completed for:', lastAssistantMessage.id),
        onError: (error) => console.error('❌ Auto-play error for:', lastAssistantMessage.id, error),
      }).catch(error => {
        console.error('Failed to auto-play message:', error);
      });
    } else {
      console.log('❌ Auto-play skipped - no new message or already processed');
    }
  }, [messages, preferences?.voiceEnabled, preferences?.voiceAutoplay, preferences?.preferredVoice, preferences?.voiceSpeed, speak]);

  // Stop voice when user starts typing (interrupt for new input)
  const handleUserTyping = useCallback(() => {
    if (isPlaying) {
      console.log('🛑 Stopping voice due to user typing');
      stop();
    }
  }, [isPlaying, stop]);

  return {
    handleUserTyping,
  };
}

// ==========================================
// MAIN CHAT WINDOW COMPONENT
// ==========================================

export function ChatWindow({ 
  className, 
  showWelcome = false,
  enableVoice = true,
}: ChatWindowProps) {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearError,
    retryLastMessage,
  } = useChat();

  const { isVoiceEnabled, preferences } = useVoicePreferences();
  const { startSession, endSession, sessionActive } = useVoice();

  // Voice chat orchestration
  const { handleUserTyping } = useVoiceChatOrchestrator();

  // Local input state
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice functionality enabled check
  const voiceEnabled = enableVoice && isVoiceEnabled && preferences?.voiceEnabled;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Start voice session when component mounts if voice is enabled
  useEffect(() => {
    if (voiceEnabled && !sessionActive) {
      startSession({ autoStart: true });
    }

    return () => {
      if (sessionActive) {
        endSession();
      }
    };
  }, [voiceEnabled, sessionActive, startSession, endSession]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const messageContent = input.trim();
    setInput('');
    setIsStreaming(true);
    
    // Stop any current voice playback when user sends a message
    handleUserTyping();
    
    try {
      await sendMessage(messageContent);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsStreaming(false);
    }
  };

  // Handle input change with typing detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    
    // If user starts typing and voice is playing, interrupt it
    if (e.target.value.length > 0) {
      handleUserTyping();
    }
  };

  // Handle voice transcript (fallback - auto-send bypasses this)
  const handleVoiceTranscript = (transcript: string) => {
    // Only fill input if auto-send is disabled or failed
    console.log('📝 Voice transcript received (fallback):', transcript);
    setInput(transcript);
    setVoiceError(null);
    inputRef.current?.focus();
  };

  // 🚀 NEW: Handle auto-send from voice input
  const handleVoiceAutoSend = useCallback(async (transcript: string) => {
    console.log('🚀 Auto-sending voice transcript:', transcript);
    
    // Clear any existing voice error
    setVoiceError(null);
    
    // Stop any current voice playback when user sends a message
    handleUserTyping();
    
    // Send message directly to AI (bypassing input field)
    try {
      await sendMessage(transcript);
      console.log('✅ Voice message auto-sent successfully');
    } catch (error) {
      console.error('❌ Failed to auto-send voice message:', error);
      
      // Fallback: put transcript in input field for manual send
      setInput(transcript);
      inputRef.current?.focus();
      
      // Show error
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      setVoiceError(`Auto-send failed: ${errorMessage}. Please send manually.`);
      
      // Re-throw so VoiceInputControls knows it failed
      throw error;
    }
  }, [sendMessage, handleUserTyping, setInput]);

  // Handle voice error
  const handleVoiceError = (error: string) => {
    setVoiceError(error);
  };

  // Clear voice error
  const clearVoiceError = () => {
    setVoiceError(null);
  };

  // Handle message copy
  const handleCopy = (content: string) => {
    console.log('Message copied:', content.substring(0, 50) + '...');
  };

  // Handle message retry
  const handleRetry = (messageId: string) => {
    console.log('Retrying message:', messageId);
    retryLastMessage();
  };

  // Handle message feedback
  const handleFeedback = (messageId: string, type: 'positive' | 'negative') => {
    console.log('Message feedback:', { messageId, type });
  };

  return (
    <div className={cn("flex flex-col h-full bg-white dark:bg-slate-900", className)}>
      
      {/* 🎤 CHAT HEADER WITH VOICE STATUS */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        
        {/* Chat Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              AI Chat
            </h2>
          </div>
          
          {/* Message Count Badge */}
          <Badge variant="secondary" className="text-xs">
            {messages.filter(m => m.role !== 'system').length} messages
          </Badge>
        </div>

        {/* Voice Status & Settings */}
        <div className="flex items-center gap-3">
          
          {/* 🎤 VOICE STATUS INDICATOR */}
          <VoiceStatusIndicator />
          
          {/* Voice Settings Panel */}
          {voiceEnabled && (
            <VoiceSettingsPanel
              trigger={
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Settings className="h-4 w-4" />
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* Welcome Message */}
      {showWelcome && messages.length === 0 && (
        <div className="p-6 text-center border-b border-slate-200 dark:border-slate-700">
          <div className="max-w-md mx-auto">
            <Sparkles className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Welcome to Smartlyte AI
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Start a conversation with our AI assistants. Ask questions about digital skills, 
              financial planning, or health & wellness.
              {voiceEnabled && (
                <span className="block mt-2 text-blue-600 dark:text-blue-400 font-medium">
                  🎤 Just speak naturally - I'll understand and respond with voice instantly!
                </span>
              )}
            </p>
            
            {/* Quick Start Suggestions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
              <Button variant="outline" size="sm" className="text-xs">
                <Computer className="h-3 w-3 mr-1" />
                Digital Skills
              </Button>
              <Button variant="outline" size="sm" className="text-xs">
                <DollarSign className="h-3 w-3 mr-1" />
                Finance Guide
              </Button>
              <Button variant="outline" size="sm" className="text-xs">
                <Heart className="h-3 w-3 mr-1" />
                Health Coach
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 STREAMLINED: Silent Voice Input - Pure Voice Conversation */}
      {voiceEnabled && preferences?.voiceInputEnabled && (
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
          <div className="max-w-2xl mx-auto">
            <VoiceInputControls
              onTranscript={handleVoiceTranscript}
              onAutoSend={handleVoiceAutoSend}
              onError={handleVoiceError}
              disabled={isLoading || isStreaming}
              autoSend={true}
              minConfidence={0.6}
              showTranscript={false}
            />
            
            {/* Streamlined Helper Text */}
            <div className="text-center mt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                🎤 Pure Voice Conversation
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Speak naturally → AI responds with voice → Continue the conversation
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6 max-w-4xl mx-auto">
          {messages
            .filter(message => message.role !== 'system') // Don't display system messages
            .map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              isLast={index === messages.filter(m => m.role !== 'system').length - 1}
              onCopy={handleCopy}
              onRetry={handleRetry}
              onFeedback={handleFeedback}
              showActions={true}
              showVoiceControls={voiceEnabled}
              voiceEnabled={voiceEnabled}
            />
          ))}

          {/* Typing Indicator */}
          {(isLoading || isStreaming) && (
            <div className="flex justify-start">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                    <span className="text-xs text-slate-500 ml-2">
                      {voiceEnabled && preferences?.voiceAutoplay 
                        ? "Thinking... (preparing voice response)" 
                        : "Thinking..."
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Error Display */}
      {(error || voiceError) && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error || voiceError}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={error ? clearError : clearVoiceError}
                className="ml-2"
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Text Input Form */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1">
            <Input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              placeholder={
                voiceEnabled && preferences?.voiceInputEnabled
                  ? "Type here, or speak above for instant voice conversation..."
                  : "Type your message..."
              }
              disabled={isLoading || isStreaming}
              className="min-h-[44px] resize-none"
            />
          </div>
          
          <Button 
            type="submit" 
            disabled={!input.trim() || isLoading || isStreaming}
            className="min-h-[44px] px-6"
          >
            {isLoading || isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>

        {/* Chat Status Bar */}
        <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            
            {/* Voice Status */}
            {voiceEnabled && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Volume2 className="h-3 w-3" />
                  <span>Voice enabled</span>
                </div>
                
                {preferences?.voiceAutoplay && (
                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <Play className="h-3 w-3" />
                    <span>Auto-play ON</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Message Count */}
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              <span>{messages.filter(m => m.role !== 'system').length} messages</span>
            </div>
          </div>
          
          {/* Usage Tips */}
          <div className="flex items-center gap-2">
            <span>Press Enter to send</span>
            {voiceEnabled && preferences?.voiceInputEnabled && (
              <span>• Speak above for instant voice conversation</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}