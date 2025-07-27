'use client';

import React, { useState, memo, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  Copy, 
  User, 
  MoreVertical, 
  ThumbsUp, 
  ThumbsDown, 
  RefreshCw,
  Clock,
  Check,
  AlertTriangle,
  Info,
  Lightbulb,
  CheckCircle,
  Code,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Mail,
  Phone,
  Hash,
  Zap,
  Sparkles,
  MessageCircle,
  // 🎤 VOICE IMPORTS
  Play,
  Pause,
  Square,
  Volume2,
  Loader2 as VoiceLoader,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@clerk/nextjs';
import { getAgentTheme, type AgentTheme } from '@/lib/formatting/agent-themes';
import { parseContent, needsEnhancedFormatting, type ContentBlock, type ParsedResponse } from '@/lib/formatting/content-parser';
// 🎤 VOICE IMPORTS
import { useVoice } from '@/hooks/use-voice';
import { useVoicePreferences } from '@/hooks/use-voice-preferences';
// Import Message type from useChat hook
import { type Message } from '@/hooks/use-chat';

// ==========================================
// INTERFACES
// ==========================================

interface MessageItemProps {
  message: Message;
  isLast?: boolean;
  onCopy?: (content: string) => void;
  onRetry?: (messageId: string) => void;
  onFeedback?: (messageId: string, type: 'positive' | 'negative') => void;
  className?: string;
  showActions?: boolean;
  showTimestamp?: boolean;
  showWordCount?: boolean;
  compact?: boolean;
  // 🎤 VOICE PROPS
  showVoiceControls?: boolean;
  voiceEnabled?: boolean;
  enableVoiceInput?: boolean;
  voiceSettings?: {
    autoplay?: boolean;
    speed?: number;
    quality?: 'standard' | 'hd';
  };
}

// ==========================================
// VOICE CONTROLS COMPONENT - COMPLETED
// ==========================================

function MessageVoiceControls({ 
  messageId, 
  messageContent, 
  compact = false 
}: { 
  messageId: string; 
  messageContent: string; 
  compact?: boolean;
}) {
  const {
    speak,
    pause,
    resume,
    stop,
    isPlaying,
    isPaused,
    isLoading: voiceLoading,
    currentText,
    volume,
    speed,
    setVolume,
    setSpeed,
    error: voiceError,
    clearError,
  } = useVoice();

  const { preferences } = useVoicePreferences();

  // Check if this message is currently being played
  const isCurrentMessage = currentText === messageContent;
  const isThisMessagePlaying = isCurrentMessage && isPlaying;
  const isThisMessagePaused = isCurrentMessage && isPaused;
  const isThisMessageLoading = isCurrentMessage && voiceLoading;

  // Handle play/pause for this specific message
  const handlePlayPause = async () => {
    try {
      if (isThisMessagePlaying) {
        await pause();
      } else if (isThisMessagePaused) {
        await resume();
      } else {
        // Start playing this message
        await speak({
          text: messageContent,
          voiceId: preferences?.preferredVoice,
          speed: preferences?.voiceSpeed || 1.0,
          interrupt: true,
          onStart: () => console.log(`🎤 Started playing message: ${messageId}`),
          onComplete: () => console.log(`✅ Completed playing message: ${messageId}`),
          onError: (error) => console.error(`❌ Voice error for message ${messageId}:`, error),
        });
      }
    } catch (error) {
      console.error('Voice control error:', error);
    }
  };

  const handleStop = async () => {
    try {
      await stop();
    } catch (error) {
      console.error('Voice stop error:', error);
    }
  };

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePlayPause}
        disabled={isThisMessageLoading}
        className={cn(
          "h-8 w-8 p-0 transition-all duration-200",
          isThisMessagePlaying && "bg-blue-50 text-blue-600 hover:bg-blue-100",
          "hover:bg-gray-100"
        )}
        title={isThisMessageLoading 
          ? "Loading voice..." 
          : isThisMessagePlaying 
            ? "Pause" 
            : "Play message"
        }
      >
        {isThisMessageLoading ? (
          <VoiceLoader className="h-4 w-4 animate-spin" />
        ) : isThisMessagePlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
    );
  }

  // Full voice controls (non-compact)
  return (
    <div className="flex items-center gap-1">
      {/* Play/Pause Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePlayPause}
        disabled={isThisMessageLoading}
        className={cn(
          "h-8 w-8 p-0 transition-all duration-200",
          isThisMessagePlaying && "bg-blue-50 text-blue-600 hover:bg-blue-100",
          "hover:bg-gray-100"
        )}
        title={isThisMessageLoading 
          ? "Loading voice..." 
          : isThisMessagePlaying 
            ? "Pause" 
            : "Play message"
        }
      >
        {isThisMessageLoading ? (
          <VoiceLoader className="h-4 w-4 animate-spin" />
        ) : isThisMessagePlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      {/* Stop Button (only show when playing) */}
      {(isThisMessagePlaying || isThisMessagePaused) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStop}
          className="h-8 w-8 p-0 hover:bg-gray-100"
          title="Stop playback"
        >
          <Square className="h-4 w-4" />
        </Button>
      )}

      {/* Voice Status Badge */}
      {(isThisMessageLoading || isThisMessagePlaying || isThisMessagePaused) && (
        <Badge 
          variant={isThisMessagePlaying ? "default" : "secondary"}
          className={cn(
            "text-xs ml-1",
            isThisMessagePlaying && "bg-blue-100 text-blue-800"
          )}
        >
          {isThisMessageLoading ? "🎤 Loading" : 
           isThisMessagePlaying ? "🎵 Playing" : 
           isThisMessagePaused ? "⏸️ Paused" : "🎤 Ready"}
        </Badge>
      )}

      {/* Voice Error Indicator */}
      {voiceError && isCurrentMessage && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearError}
          className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
          title={`Voice error: ${voiceError}`}
        >
          <AlertTriangle className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// ==========================================
// MAIN MESSAGE ITEM COMPONENT
// ==========================================

export const MessageItem = memo(function MessageItem({
  message,
  isLast = false,
  onCopy,
  onRetry,
  onFeedback,
  className,
  showActions = true,
  showTimestamp = false,
  showWordCount = false,
  compact = false,
  // 🎤 VOICE PROPS WITH DEFAULTS
  showVoiceControls = true,
  voiceEnabled = true,
  enableVoiceInput = false,
  voiceSettings,
}: MessageItemProps) {
  const { user } = useUser();
  const { preferences, isVoiceEnabled } = useVoicePreferences();
  
  // Local state
  const [copied, setCopied] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);

  // Parse content for enhanced formatting
  const parsedContent = useMemo(() => {
    if (needsEnhancedFormatting(message.content)) {
      return parseContent(message.content);
    }
    return null;
  }, [message.content]);

  // Get agent theme
  const agentTheme = useMemo(() => {
    const agentType = message.agentName?.toLowerCase().replace(/\s+/g, '-') as any;
    return getAgentTheme(agentType);
  }, [message.agentName]);

  // 🎤 VOICE LOGIC
  const shouldShowVoiceControls = useMemo(() => {
    return (
      showVoiceControls &&
      voiceEnabled &&
      isVoiceEnabled &&
      preferences?.voiceEnabled &&
      message.role === 'assistant' && // Only for assistant messages (not system)
      message.content.trim().length > 10 // Only show for substantial content
    );
  }, [showVoiceControls, voiceEnabled, isVoiceEnabled, preferences?.voiceEnabled, message.role, message.content]);

  // Handle copy with feedback
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.(message.content);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  // Handle feedback
  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedbackGiven(type);
    onFeedback?.(message.id, type);
  };

  // Handle retry
  const handleRetry = () => {
    onRetry?.(message.id);
  };

  // Word count calculation
  const wordCount = useMemo(() => {
    return message.content.split(/\s+/).filter(word => word.length > 0).length;
  }, [message.content]);

  // Determine message type
  const isUserMessage = message.role === 'user';
  const isAssistantMessage = message.role === 'assistant';
  const isSystemMessage = message.role === 'system';

  // Don't render system messages in the UI
  if (isSystemMessage) {
    return null;
  }

  return (
    <div className={cn("group relative", className)}>
      {/* Message Container */}
      <div className={cn(
        "flex gap-4 p-4 rounded-lg transition-all duration-200",
        isUserMessage 
          ? "bg-blue-50 dark:bg-blue-950/20 ml-12" 
          : "bg-white dark:bg-slate-800 mr-12",
        "hover:shadow-sm"
      )}>
        
        {/* Avatar */}
        <div className="flex-shrink-0">
          {isUserMessage ? (
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.imageUrl} alt={user?.firstName || 'User'} />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium",
              agentTheme.avatar.background
            )}>
              <agentTheme.icon className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          {/* Agent Name for Assistant Messages */}
          {isAssistantMessage && message.agentName && (
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                {message.agentName}
              </h4>
              <Badge variant="secondary" className="text-xs">
                AI Assistant
              </Badge>
            </div>
          )}

          {/* Message Text */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {parsedContent ? (
              <div className="space-y-4">
                {parsedContent.blocks.map((block: ContentBlock, index: number) => (
                  <div key={index}>
                    {block.type === 'text' && (
                      <p className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                        {block.content}
                      </p>
                    )}
                    {block.type === 'bullet-list' && (
                      <ul className="list-disc list-inside space-y-1">
                        {block.metadata?.items?.map((item: string, itemIndex: number) => (
                          <li key={itemIndex} className="text-gray-900 dark:text-gray-100">
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                    {block.type === 'step-guide' && (
                      <ol className="list-decimal list-inside space-y-1">
                        {block.metadata?.steps?.map((step: {number: number; content: string}, stepIndex: number) => (
                          <li key={stepIndex} className="text-gray-900 dark:text-gray-100">
                            {step.content}
                          </li>
                        ))}
                      </ol>
                    )}
                    {(block.type === 'tip' || block.type === 'warning' || block.type === 'important' || block.type === 'success') && (
                      <div className={cn(
                        "p-3 rounded-lg border-l-4 my-2",
                        block.type === 'tip' && "bg-blue-50 border-blue-400 text-blue-800",
                        block.type === 'warning' && "bg-yellow-50 border-yellow-400 text-yellow-800", 
                        block.type === 'important' && "bg-red-50 border-red-400 text-red-800",
                        block.type === 'success' && "bg-green-50 border-green-400 text-green-800"
                      )}>
                        <div className="flex items-start gap-2">
                          {block.type === 'tip' && <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                          {block.type === 'warning' && <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                          {block.type === 'important' && <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                          {block.type === 'success' && <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                          <p className="text-sm">{block.content}</p>
                        </div>
                      </div>
                    )}
                    {block.type === 'code' && (
                      <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-x-auto">
                        <code>{block.content}</code>
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                {message.content}
              </p>
            )}
          </div>

          {/* Message Metadata */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
            {showTimestamp && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {message.createdAt.toLocaleTimeString()}
              </span>
            )}
            
            {showWordCount && (
              <span>{wordCount} words</span>
            )}
            
            {message.metadata?.responseTime && (
              <span>{message.metadata.responseTime}ms</span>
            )}
            
            {message.metadata?.tokenUsage && (
              <span>{message.metadata.tokenUsage} tokens</span>
            )}
          </div>

          {/* 🎤 MESSAGE ACTIONS - INCLUDING VOICE CONTROLS */}
          {showActions && (
            <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              
              {/* 🎤 VOICE CONTROLS - PRIORITY POSITION */}
              {shouldShowVoiceControls && (
                <MessageVoiceControls 
                  messageId={message.id}
                  messageContent={message.content}
                  compact={compact}
                />
              )}

              {/* Standard Message Actions */}
              <div className="flex items-center gap-1 ml-auto">
                
                {/* Copy Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                  title={copied ? "Copied!" : "Copy message"}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>

                {/* Feedback Buttons (for assistant messages) */}
                {isAssistantMessage && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFeedback('positive')}
                      className={cn(
                        "h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700",
                        feedbackGiven === 'positive' && "text-green-600 bg-green-50"
                      )}
                      title="Helpful response"
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFeedback('negative')}
                      className={cn(
                        "h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700",
                        feedbackGiven === 'negative' && "text-red-600 bg-red-50"
                      )}
                      title="Not helpful"
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </>
                )}

                {/* Retry Button (for last assistant message) */}
                {isAssistantMessage && isLast && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRetry}
                    className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Retry request"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}

                {/* More Options */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleCopy}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy text
                    </DropdownMenuItem>
                    
                    {isAssistantMessage && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleFeedback('positive')}>
                          <ThumbsUp className="h-4 w-4 mr-2" />
                          Mark as helpful
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleFeedback('negative')}>
                          <ThumbsDown className="h-4 w-4 mr-2" />
                          Mark as unhelpful
                        </DropdownMenuItem>
                      </>
                    )}
                    
                    {isLast && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleRetry}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Retry request
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});