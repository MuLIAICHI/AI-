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

// ==========================================
// INTERFACES
// ==========================================

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: Date;
  agentName?: string;
  metadata?: {
    tokenUsage?: number;
    responseTime?: number;
    confidence?: number;
    isStreaming?: boolean;
  };
}

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
// VOICE CONTROLS COMPONENT
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

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
      {/* Main play/pause button */}
      <Button
        variant={isThisMessagePlaying ? "default" : "outline"}
        size="sm"
        onClick={handlePlayPause}
        disabled={isThisMessageLoading}
        className={cn(
          "h-8 transition-all duration-200",
          isThisMessagePlaying && "bg-blue-600 hover:bg-blue-700"
        )}
      >
        {isThisMessageLoading ? (
          <VoiceLoader className="h-4 w-4 animate-spin mr-1" />
        ) : isThisMessagePlaying ? (
          <Pause className="h-4 w-4 mr-1" />
        ) : (
          <Play className="h-4 w-4 mr-1" />
        )}
        <span className="text-xs">
          {isThisMessageLoading 
            ? "Loading" 
            : isThisMessagePlaying 
              ? "Pause" 
              : "Play"
          }
        </span>
      </Button>

      {/* Stop button (only show if playing/paused) */}
      {(isThisMessagePlaying || isThisMessagePaused) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStop}
          className="h-8 w-8 p-0"
          title="Stop playback"
        >
          <Square className="h-4 w-4" />
        </Button>
      )}

      {/* Voice status */}
      {isCurrentMessage && (
        <Badge 
          variant={isThisMessagePlaying ? "default" : "secondary"}
          className={cn(
            "text-xs",
            isThisMessagePlaying && "bg-blue-100 text-blue-800"
          )}
        >
          {isThisMessageLoading ? "🎤 Loading" : 
           isThisMessagePlaying ? "🎵 Playing" : 
           isThisMessagePaused ? "⏸️ Paused" : "🎤 Ready"}
        </Badge>
      )}

      {/* Voice error */}
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
      message.role === 'assistant' &&
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

  // Calculate word count
  const wordCount = useMemo(() => {
    return message.content.split(/\s+/).filter(word => word.length > 0).length;
  }, [message.content]);

  // Render user message
  if (message.role === 'user') {
    return (
      <div className={cn("flex justify-end mb-4", className)}>
        <div className="flex items-start gap-3 max-w-[80%]">
          <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-3 shadow-sm">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
            {showTimestamp && (
              <p className="text-xs text-blue-100 mt-2">
                {message.createdAt.toLocaleTimeString()}
              </p>
            )}
          </div>
          
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-60 hover:opacity-100">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopy} className="text-sm">
                  <Copy className="h-4 w-4 mr-2" />
                  {copied ? 'Copied!' : 'Copy'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRetry} className="text-sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <Avatar className="h-8 w-8 order-last">
            <AvatarImage src={user?.imageUrl} alt={user?.firstName || 'User'} />
            <AvatarFallback className="bg-blue-600 text-white text-xs">
              {user?.firstName?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    );
  }

  // Render assistant message
  return (
    <div className={cn("flex justify-start mb-6", className)}>
      <div className="flex items-start gap-3 max-w-[90%]">
        {/* Agent Avatar */}
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className={cn(
            "text-white text-xs font-medium",
            agentTheme.avatar.background
          )}>
            {agentTheme.emoji}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Agent Name & Badge */}
          {message.agentName && (
            <div className="flex items-center gap-2 mb-2">
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs font-medium border-2",
                  agentTheme.message.border,
                  agentTheme.message.textColor,
                  agentTheme.message.background
                )}
              >
                {agentTheme.icon && <agentTheme.icon className="h-3 w-3 mr-1" />}
                {message.agentName}
              </Badge>

              {/* 🎤 VOICE INDICATOR */}
              {shouldShowVoiceControls && (
                <Badge variant="secondary" className="text-xs">
                  <Volume2 className="h-3 w-3 mr-1" />
                  Voice Ready
                </Badge>
              )}
            </div>
          )}

          {/* Message Content */}
          <Card className={cn("shadow-sm border-l-4", agentTheme.message.border)}>
            <CardContent className="p-4">
              {parsedContent ? (
                <div className="space-y-4">
                  {parsedContent.blocks.map((block, index) => (
                    <ContentBlockRenderer key={index} block={block} theme={agentTheme} />
                  ))}
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="leading-relaxed whitespace-pre-wrap break-words mb-0">
                    {message.content}
                  </p>
                </div>
              )}

              {/* 🎤 VOICE CONTROLS SECTION */}
              {shouldShowVoiceControls && (
                <MessageVoiceControls
                  messageId={message.id}
                  messageContent={message.content}
                  compact={compact}
                />
              )}

              {/* Metadata */}
              {(showTimestamp || showWordCount || message.metadata) && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
                  {showTimestamp && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {message.createdAt.toLocaleTimeString()}
                    </div>
                  )}
                  {showWordCount && (
                    <div className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {wordCount} words
                    </div>
                  )}
                  {message.metadata?.responseTime && (
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {message.metadata.responseTime}ms
                    </div>
                  )}
                  {message.metadata?.confidence && (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {Math.round(message.metadata.confidence * 100)}%
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {showActions && (
            <div className="flex items-center gap-2 mt-3">
              {/* Feedback Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFeedback('positive')}
                  className={cn(
                    "h-8 px-2 text-gray-500 hover:text-green-600",
                    feedbackGiven === 'positive' && "text-green-600 bg-green-50"
                  )}
                >
                  <ThumbsUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFeedback('negative')}
                  className={cn(
                    "h-8 px-2 text-gray-500 hover:text-red-600",
                    feedbackGiven === 'negative' && "text-red-600 bg-red-50"
                  )}
                >
                  <ThumbsDown className="h-4 w-4" />
                </Button>
              </div>

              {/* Copy Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 px-2 text-gray-500 hover:text-gray-700"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>

              {/* Retry Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetry}
                className="h-8 px-2 text-gray-500 hover:text-gray-700"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>

              {/* More Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Share Response
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-sm">
                    <Code className="h-4 w-4 mr-2" />
                    View Raw
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Report Issue
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ==========================================
// CONTENT BLOCK RENDERER (Same as before)
// ==========================================

function ContentBlockRenderer({ block, theme }: { block: ContentBlock; theme: AgentTheme }) {
  switch (block.type) {
    case 'step-guide':
      return <StepGuide block={block} theme={theme} />;
    
    case 'bullet-list':
      return <BulletList block={block} theme={theme} />;
    
    case 'tip':
    case 'warning':
    case 'important':
    case 'success':
      return <CalloutBox block={block} theme={theme} />;
    
    case 'code':
      return <CodeBlock block={block} theme={theme} />;
    
    default:
      return (
        <p className="leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
          {block.content}
        </p>
      );
  }
}

// These components are the same as in your fixed version
function StepGuide({ block, theme }: { block: ContentBlock; theme: AgentTheme }) {
  const steps = (block.metadata?.steps || []) as Array<{number: number; content: string}>;
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", theme.avatar.background)}>
          <Hash className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Step-by-Step Guide
        </span>
      </div>
      
      <div className="space-y-2">
        {steps.map((step: {number: number; content: string}, index: number) => (
          <div 
            key={index}
            className={cn(
              "flex gap-3 p-3 rounded-lg border transition-all duration-200",
              theme.content.steps.background,
              theme.content.steps.border,
              "hover:shadow-sm"
            )}
          >
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0",
              theme.content.steps.number
            )}>
              {step.number}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {step.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BulletList({ block, theme }: { block: ContentBlock; theme: AgentTheme }) {
  const items = (block.metadata?.items || []) as string[];
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", theme.avatar.background)}>
          <ArrowRight className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Key Points
        </span>
      </div>
      
      <ul className="space-y-2">
        {items.map((item: string, index: number) => (
          <li key={index} className="flex gap-3 items-start">
            <div className={cn(
              "w-2 h-2 rounded-full mt-2 flex-shrink-0",
              theme.colors.primary === '#3B82F6' ? 'bg-blue-500' :
              theme.colors.primary === '#8B5CF6' ? 'bg-purple-500' :
              theme.colors.primary === '#10B981' ? 'bg-green-500' :
              theme.colors.primary === '#EF4444' ? 'bg-red-500' : 'bg-gray-500'
            )} />
            <span className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CalloutBox({ block, theme }: { block: ContentBlock; theme: AgentTheme }) {
  const getCalloutConfig = (type: string) => {
    switch (type) {
      case 'tip':
        return {
          icon: Lightbulb,
          label: 'Tip',
          styling: theme.content.callouts.tip,
          iconColor: 'text-blue-600',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          label: 'Warning',
          styling: theme.content.callouts.warning,
          iconColor: 'text-amber-600',
        };
      case 'important':
        return {
          icon: Info,
          label: 'Important',
          styling: theme.content.callouts.info,
          iconColor: 'text-cyan-600',
        };
      case 'success':
        return {
          icon: CheckCircle,
          label: 'Success',
          styling: theme.content.callouts.success,
          iconColor: 'text-green-600',
        };
      default:
        return {
          icon: Info,
          label: 'Note',
          styling: theme.content.callouts.info,
          iconColor: 'text-blue-600',
        };
    }
  };

  const config = getCalloutConfig(block.type);
  const IconComponent = config.icon;
  
  return (
    <div className={cn(
      "flex gap-3 p-4 rounded-lg border",
      config.styling
    )}>
      <div className="flex-shrink-0">
        <IconComponent className={cn("w-5 h-5", config.iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold">{config.label}</span>
        </div>
        <p className="text-sm leading-relaxed">
          {block.content}
        </p>
      </div>
    </div>
  );
}

function CodeBlock({ block, theme }: { block: ContentBlock; theme: AgentTheme }) {
  const [copied, setCopied] = useState(false);
  const language = block.metadata?.language || 'text';
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(block.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };
  
  return (
    <div className={cn(
      "relative rounded-lg border overflow-hidden",
      theme.content.code.background,
      theme.content.code.border
    )}>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {language.toUpperCase()}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 px-2 text-xs"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>
      
      <div className="p-4">
        <pre className={cn(
          "text-sm leading-relaxed overflow-x-auto",
          theme.content.code.text
        )}>
          <code>{block.content}</code>
        </pre>
      </div>
    </div>
  );
}

export default MessageItem;