// src/components/chat/message-item.tsx
'use client';

import React, { useState, memo } from 'react';
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
  Bot,
  Computer,
  DollarSign,
  Heart,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@clerk/nextjs';

// Message interface
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
}

/**
 * Agent configuration for visual styling and information
 */
const AGENT_CONFIG = {
  'router': {
    name: 'Smart Router',
    emoji: '🤖',
    icon: Bot,
    color: 'bg-blue-500',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  'digital-mentor': {
    name: 'Digital Mentor',
    emoji: '🖥️',
    icon: Computer,
    color: 'bg-purple-500',
    textColor: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  'finance-guide': {
    name: 'Finance Guide',
    emoji: '💰',
    icon: DollarSign,
    color: 'bg-green-500',
    textColor: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  'health-coach': {
    name: 'Health Coach',
    emoji: '🏥',
    icon: Heart,
    color: 'bg-red-500',
    textColor: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-red-200 dark:border-red-800',
  },
} as const;

/**
 * Get agent configuration based on agent name
 */
function getAgentConfig(agentName?: string) {
  if (!agentName) return AGENT_CONFIG.router;
  
  // Map agent names to config keys
  const nameMapping = {
    'Smart Router': 'router',
    'Intelligent Router': 'router',
    'Simple Router': 'router',
    'Digital Mentor': 'digital-mentor',
    'Finance Guide': 'finance-guide',
    'Health Coach': 'health-coach',
  } as const;
  
  const configKey = nameMapping[agentName as keyof typeof nameMapping] || 'router';
  return AGENT_CONFIG[configKey];
}

/**
 * Enhanced message item component with agent indicators and actions
 */
export const MessageItem = memo(function MessageItem({
  message,
  isLast = false,
  onCopy,
  onRetry,
  onFeedback,
  className,
  showActions = true,
  showTimestamp = true,
  showWordCount = false,
  compact = false,
}: MessageItemProps) {
  const { user } = useUser();
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);

  const isUser = message.role === 'user';
  const agentConfig = isUser ? null : getAgentConfig(message.agentName);
  const IconComponent = agentConfig?.icon || Bot;

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      onCopy?.(message.content);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  // Handle feedback
  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedback(type);
    onFeedback?.(message.id, type);
  };

  // Handle retry
  const handleRetry = () => {
    onRetry?.(message.id);
  };

  // Calculate word count
  const wordCount = message.content.split(/\s+/).filter(word => word.length > 0).length;

  // Format timestamp
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={cn(
        "flex gap-3 group relative",
        isUser ? "justify-end" : "justify-start",
        compact ? "mb-2" : "mb-4",
        className
      )}
    >
      {/* Assistant Avatar */}
      {!isUser && (
        <Avatar className={cn(
          "flex-shrink-0 transition-all duration-200",
          compact ? "w-6 h-6" : "w-8 h-8",
          agentConfig && "ring-2 ring-offset-1",
          agentConfig?.borderColor
        )}>
          <AvatarFallback className={cn(
            "text-white font-medium",
            agentConfig?.color || "bg-gray-500",
            compact ? "text-xs" : "text-sm"
          )}>
            {agentConfig?.emoji || '🤖'}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Message Content */}
      <div className={cn(
        "flex flex-col",
        compact ? "max-w-[85%]" : "max-w-[80%]",
        isUser ? "items-end" : "items-start"
      )}>
        {/* Agent Name Badge (for assistant messages) */}
        {!isUser && message.agentName && !compact && (
          <div className="flex items-center gap-2 mb-1">
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs font-medium flex items-center gap-1",
                agentConfig?.textColor,
                agentConfig?.bgColor
              )}
            >
              <IconComponent className="w-3 h-3" />
              {agentConfig?.name || message.agentName}
            </Badge>
            
            {/* Confidence indicator */}
            {message.metadata?.confidence && message.metadata.confidence > 0.8 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3" />
                <span>High confidence</span>
              </div>
            )}
          </div>
        )}

        {/* Message Bubble */}
        <Card
          className={cn(
            "transition-all duration-200 shadow-sm",
            isUser 
              ? "bg-primary text-primary-foreground border-primary/20" 
              : cn(
                  "bg-muted/50 hover:bg-muted/70 border-border/50",
                  agentConfig?.bgColor,
                  agentConfig?.borderColor
                ),
            "group-hover:shadow-md",
            compact ? "max-w-full" : "max-w-full"
          )}
        >
          <CardContent className={cn(
            "p-3",
            compact && "p-2"
          )}>
            {/* Message Text */}
            <div className={cn(
              "text-sm leading-relaxed whitespace-pre-wrap break-words",
              compact && "text-xs leading-normal"
            )}>
              {message.content}
            </div>

            {/* Message Metadata */}
            <div className={cn(
              "flex items-center justify-between mt-2 gap-2",
              compact && "mt-1"
            )}>
              <div className="flex items-center gap-2 text-xs opacity-70">
                {/* Timestamp */}
                {showTimestamp && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(message.createdAt)}</span>
                  </div>
                )}
                
                {/* Word Count */}
                {showWordCount && (
                  <span>{wordCount} words</span>
                )}

                {/* Response Time */}
                {message.metadata?.responseTime && (
                  <span>{message.metadata.responseTime}ms</span>
                )}

                {/* Streaming Indicator */}
                {message.metadata?.isStreaming && (
                  <Badge variant="outline" className="text-xs">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1" />
                    Live
                  </Badge>
                )}
              </div>

              {/* Message Actions */}
              {showActions && !compact && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Copy Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-6 w-6 p-0"
                    title="Copy message"
                  >
                    <Copy className={cn(
                      "w-3 h-3",
                      copied && "text-green-500"
                    )} />
                  </Button>

                  {/* Feedback and More Actions */}
                  {!isUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          title="More actions"
                        >
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleFeedback('positive')}>
                          <ThumbsUp className={cn(
                            "w-4 h-4 mr-2",
                            feedback === 'positive' && "text-green-500"
                          )} />
                          Helpful Response
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleFeedback('negative')}>
                          <ThumbsDown className={cn(
                            "w-4 h-4 mr-2",
                            feedback === 'negative' && "text-red-500"
                          )} />
                          Not Helpful
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleRetry}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Regenerate Response
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleCopy}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Message
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Feedback Display */}
        {feedback && !compact && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            {feedback === 'positive' ? (
              <>
                <ThumbsUp className="w-3 h-3 text-green-500" />
                <span>Marked as helpful</span>
              </>
            ) : (
              <>
                <ThumbsDown className="w-3 h-3 text-red-500" />
                <span>Feedback sent</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <Avatar className={cn(
          "flex-shrink-0",
          compact ? "w-6 h-6" : "w-8 h-8"
        )}>
          {user?.imageUrl ? (
            <AvatarImage src={user.imageUrl} alt={user.firstName || 'User'} />
          ) : (
            <AvatarFallback className="bg-primary text-primary-foreground">
              <User className={cn(
                compact ? "w-3 h-3" : "w-4 h-4"
              )} />
            </AvatarFallback>
          )}
        </Avatar>
      )}

      {/* Copy Success Toast */}
      {copied && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-8 bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-10">
          Copied!
        </div>
      )}
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

/**
 * Typing indicator component for when AI is responding
 */
export const TypingIndicator = memo(function TypingIndicator({
  agentName = 'AI',
  className,
}: {
  agentName?: string;
  className?: string;
}) {
  const agentConfig = getAgentConfig(agentName);
  const IconComponent = agentConfig?.icon || Bot;

  return (
    <div className={cn("flex gap-3 justify-start", className)}>
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarFallback className={cn(
          "text-white font-medium",
          agentConfig?.color || "bg-gray-500"
        )}>
          {agentConfig?.emoji || '🤖'}
        </AvatarFallback>
      </Avatar>

      <Card className={cn(
        "bg-muted/50 border-border/50",
        agentConfig?.bgColor
      )}>
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div 
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" 
                style={{ animationDelay: '0.1s' }}
              ></div>
              <div 
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" 
                style={{ animationDelay: '0.2s' }}
              ></div>
            </div>
            <span className="text-sm text-muted-foreground">
              {agentConfig?.name || agentName} is typing...
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';