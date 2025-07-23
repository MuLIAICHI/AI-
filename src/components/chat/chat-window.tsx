'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@/hooks/use-chat';
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

// Message interface to match our enhanced system
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: Date;
  agentName?: string;
  metadata?: {
    tokenUsage?: number;
    responseTime?: number;
    confidence?: number;
    isStreaming?: boolean;
  };
}

// ==========================================
// AGENT CONFIGURATION
// ==========================================

const AGENT_CONFIG = {
  'router': {
    name: 'Smart Router',
    emoji: '🤖',
    icon: Bot,
    description: 'I analyze your questions and connect you with the right specialist',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
  },
  'digital-mentor': {
    name: 'Digital Mentor',
    emoji: '🖥️',
    icon: Computer,
    description: 'Your patient guide to mastering essential digital skills',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20',
  },
  'finance-guide': {
    name: 'Finance Guide',
    emoji: '💰',
    icon: DollarSign,
    description: 'Your trusted guide for smart money management',
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
  },
  'health-coach': {
    name: 'Health Coach',
    emoji: '🏥',
    icon: Heart,
    description: 'Your caring companion for healthy living',
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
  },
} as const;

// ==========================================
// WELCOME COMPONENT
// ==========================================

function WelcomeMessage() {
  return (
    <div className="text-center space-y-6 py-8">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
      </div>
      
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-3">
          Welcome to Smartlyte AI! 🎉
        </h1>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          I'm here to help you with digital skills, finance advice, and health guidance. 
          You can type your questions or <strong>speak them aloud</strong> - I understand both!
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
          Try asking me about:
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {Object.entries(AGENT_CONFIG).map(([key, agent]) => (
            <Card key={key} className={cn("hover:shadow-md transition-shadow", agent.bgColor)}>
              <CardContent className="p-4 text-center">
                <agent.icon className={cn("w-8 h-8 mx-auto mb-2", agent.color)} />
                <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-1">
                  {agent.name}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {agent.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Quick suggestions:
          </h4>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "How do I create a strong password?",
              "Help me create a budget",
              "What are healthy eating tips?",
              "Show me how to use email safely"
            ].map((suggestion, index) => (
              <Badge key={index} variant="outline" className="cursor-pointer hover:bg-primary/10">
                {suggestion}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// VOICE STATUS INDICATOR
// ==========================================

function VoiceStatusIndicator() {
  const { isVoiceEnabled, preferences } = useVoicePreferences();
  const { 
    isPlaying, 
    isPaused, 
    isLoading, 
    currentText, 
    sessionActive,
    stop,
  } = useVoice();

  if (!isVoiceEnabled || !preferences?.voiceEnabled) {
    return null;
  }

  const handleStopPlayback = async () => {
    try {
      await stop();
    } catch (error) {
      console.error('Failed to stop voice playback:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/20 rounded-full text-blue-700 dark:text-blue-300 text-sm">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Generating voice...</span>
      </div>
    );
  }

  if (isPlaying) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-950/20 rounded-full text-green-700 dark:text-green-300 text-sm">
        <Volume2 className="h-3 w-3" />
        <span>Playing message</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStopPlayback}
          className="h-5 w-5 p-0 ml-1 hover:bg-green-200 dark:hover:bg-green-800"
        >
          <Pause className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-yellow-50 dark:bg-yellow-950/20 rounded-full text-yellow-700 dark:text-yellow-300 text-sm">
        <VolumeX className="h-3 w-3" />
        <span>Voice paused</span>
      </div>
    );
  }

  if (sessionActive) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 dark:bg-gray-950/20 rounded-full text-gray-700 dark:text-gray-300 text-sm">
        <Volume2 className="h-3 w-3" />
        <span>Voice ready</span>
      </div>
    );
  }

  return null;
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
    
    try {
      await sendMessage(messageContent);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsStreaming(false);
    }
  };

  // Handle voice transcript
  const handleVoiceTranscript = (transcript: string) => {
    setInput(transcript);
    setVoiceError(null);
  };

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
      {/* Header with Voice Status */}
      {voiceEnabled && (
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <VoiceStatusIndicator />
          <VoiceSettingsPanel
            trigger={
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4 mr-1" />
                Voice Settings
              </Button>
            }
          />
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {/* Welcome Message */}
          {showWelcome && messages.length === 0 && (
            <WelcomeMessage />
          )}

          {/* Empty State */}
          {!showWelcome && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Start a Conversation
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Ask me anything about digital skills, finance, or health
                  {voiceEnabled && <span className="block mt-1">You can speak or type your questions!</span>}
                </p>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages
            .filter(message => message.role !== 'system')
            .map((message, index) => (
            <MessageItem
              key={message.id}
              message={{
                ...message,
                role: message.role as 'user' | 'assistant'
              }}
              isLast={index === messages.length - 1}
              onCopy={handleCopy}
              onRetry={handleRetry}
              onFeedback={handleFeedback}
              showActions={true}
              showTimestamp={true}
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
                    <span className="text-xs text-slate-500 ml-2">Thinking...</span>
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

      {/* Voice Input Section */}
      {voiceEnabled && preferences?.voiceInputEnabled && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <VoiceInputControls
            onTranscript={handleVoiceTranscript}
            onError={handleVoiceError}
            disabled={isLoading || isStreaming}
          />
        </div>
      )}

      {/* Input Form */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                voiceEnabled && preferences?.voiceInputEnabled
                  ? "Type your message or use voice input above..."
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

        {/* Quick Actions */}
        <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            {voiceEnabled && (
              <div className="flex items-center gap-1">
                <Volume2 className="h-3 w-3" />
                <span>Voice enabled</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              <span>{messages.filter(m => m.role !== 'system').length} messages</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span>Press Enter to send</span>
            {voiceEnabled && preferences?.voiceInputEnabled && (
              <span>• Use voice input above</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}