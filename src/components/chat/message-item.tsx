// src/components/chat/message-item.tsx
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
  MessageCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@clerk/nextjs';
import { getAgentTheme, type AgentTheme } from '@/lib/formatting/agent-themes';
import { parseContent, needsEnhancedFormatting, type ContentBlock, type ParsedResponse } from '@/lib/formatting/content-parser';

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
}

// ==========================================
// CONTENT BLOCK COMPONENTS
// ==========================================

/**
 * Step Guide Component - Renders numbered steps with visual progression
 */
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
              <p className={cn("text-sm leading-relaxed", theme.content.steps.completed.split(' ')[2])}>
                {step.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Bullet List Component - Renders bullet points with consistent styling
 */
function BulletList({ block, theme }: { block: ContentBlock; theme: AgentTheme }) {
  const items = (block.metadata?.items || []) as string[];
  
  return (
    <div className="space-y-2">
      {items.map((item: string, index: number) => (
        <div key={index} className="flex gap-3 items-start">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0",
            theme.colors.primary.replace('#', 'bg-[') + ']'
          )} />
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 flex-1">
            {item}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Callout Component - Renders tips, warnings, and important notes
 */
function CalloutBlock({ block, theme }: { block: ContentBlock; theme: AgentTheme }) {
  const getCalloutConfig = (type: string) => {
    switch (type) {
      case 'tip':
        return {
          icon: Lightbulb,
          label: 'Tip',
          styling: theme.content.callouts.tip,
          iconColor: 'text-blue-600 dark:text-blue-400',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          label: 'Warning',
          styling: theme.content.callouts.warning,
          iconColor: 'text-amber-600 dark:text-amber-400',
        };
      case 'important':
        return {
          icon: Info,
          label: 'Important',
          styling: theme.content.callouts.info,
          iconColor: 'text-red-600 dark:text-red-400',
        };
      case 'success':
        return {
          icon: CheckCircle,
          label: 'Success',
          styling: theme.content.callouts.success,
          iconColor: 'text-green-600 dark:text-green-400',
        };
      default:
        return {
          icon: Info,
          label: 'Note',
          styling: theme.content.callouts.info,
          iconColor: 'text-slate-600 dark:text-slate-400',
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

/**
 * Code Block Component - Renders code with syntax highlighting
 */
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
      {/* Code header */}
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
      
      {/* Code content */}
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

/**
 * Agent Handoff Component - Shows agent transitions
 */
function AgentHandoff({ transition, fromTheme, toTheme }: { 
  transition: NonNullable<ParsedResponse['agentTransition']>; 
  fromTheme: AgentTheme;
  toTheme: AgentTheme;
}) {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-full border border-slate-200 dark:border-slate-600">
        {/* From agent */}
        <div className="flex items-center gap-2">
          <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs", fromTheme.avatar.background)}>
            {fromTheme.emoji}
          </div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {fromTheme.displayName}
          </span>
        </div>
        
        {/* Arrow */}
        <ArrowRight className="w-4 h-4 text-slate-400" />
        
        {/* To agent */}
        <div className="flex items-center gap-2">
          <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs", toTheme.avatar.background)}>
            {toTheme.emoji}
          </div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {toTheme.displayName}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Text Block Component - Renders regular text with inline formatting
 */
function TextBlock({ content, theme }: { content: string; theme: AgentTheme }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
        {content}
      </p>
    </div>
  );
}

// ==========================================
// MAIN MESSAGE COMPONENT
// ==========================================

/**
 * Enhanced message item component with rich formatting and agent theming
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
  const theme = getAgentTheme(isUser ? null : message.agentName);
  const IconComponent = theme.icon;

  // Parse content for enhanced formatting
  const parsedContent = useMemo(() => {
    if (isUser || !needsEnhancedFormatting(message.content)) {
      return null;
    }
    return parseContent(message.content);
  }, [message.content, isUser]);

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
        compact ? "mb-2" : "mb-6",
        className
      )}
    >
      {/* Assistant Avatar */}
      {!isUser && (
        <Avatar className={cn(
          "flex-shrink-0 transition-all duration-200",
          theme.avatar.size.default,
          theme.avatar.shadow,
          theme.avatar.border
        )}>
          <AvatarImage src="" alt={theme.displayName} />
          <AvatarFallback className={cn(
            "text-white font-medium text-sm",
            theme.avatar.background
          )}>
            {theme.emoji}
          </AvatarFallback>
        </Avatar>
      )}

      {/* User Avatar */}
      {isUser && (
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={user?.imageUrl} alt="You" />
          <AvatarFallback className="bg-slate-500 text-white text-sm">
            <User className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      )}

      {/* Message Content */}
      <div className="flex-1 min-w-0 max-w-[85%]">
        {/* Agent Header (for assistant messages) */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("text-sm font-semibold", theme.message.metaColor)}>
              {theme.displayName}
            </span>
            <Badge variant="secondary" className={cn(
              "text-xs px-2 py-0.5",
              theme.interactions.buttons.secondary
            )}>
              {theme.personality.tone}
            </Badge>
          </div>
        )}

        {/* Message Card */}
        <Card className={cn(
          "border transition-all duration-200",
          isUser 
            ? "bg-primary text-primary-foreground border-primary/20" 
            : cn(
                theme.message.background,
                theme.message.border,
                theme.message.shadow,
                theme.message.hoverShadow
              ),
          "group-hover:shadow-md"
        )}>
          <CardContent className={cn("p-4", compact && "p-3")}>
            {/* Agent Handoff */}
            {parsedContent?.hasAgentHandoff && parsedContent.agentTransition && (
              <AgentHandoff 
                transition={parsedContent.agentTransition}
                fromTheme={getAgentTheme(parsedContent.agentTransition.fromAgent)}
                toTheme={getAgentTheme(parsedContent.agentTransition.toAgent)}
              />
            )}

            {/* Enhanced Content Blocks */}
            {parsedContent && !isUser ? (
              <div className="space-y-4">
                {parsedContent.blocks.map((block, index) => {
                  switch (block.type) {
                    case 'step-guide':
                      return <StepGuide key={block.id} block={block} theme={theme} />;
                    case 'bullet-list':
                      return <BulletList key={block.id} block={block} theme={theme} />;
                    case 'tip':
                    case 'warning':
                    case 'important':
                    case 'success':
                      return <CalloutBlock key={block.id} block={block} theme={theme} />;
                    case 'code':
                      return <CodeBlock key={block.id} block={block} theme={theme} />;
                    case 'text':
                      return <TextBlock key={block.id} content={block.content} theme={theme} />;
                    default:
                      return <TextBlock key={block.id} content={block.content} theme={theme} />;
                  }
                })}
              </div>
            ) : (
              /* Simple Text Content */
              <div className={cn(
                "text-sm leading-relaxed whitespace-pre-wrap break-words",
                compact && "text-xs leading-normal",
                isUser ? "text-white" : theme.message.textColor
              )}>
                {message.content}
              </div>
            )}

            {/* Message Metadata */}
            <div className={cn(
              "flex items-center justify-between mt-3 gap-2",
              compact && "mt-2"
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

                {/* Content Stats */}
                {parsedContent && (
                  <span>{parsedContent.blocks.length} blocks</span>
                )}
              </div>

              {/* Actions */}
              {showActions && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-6 w-6 p-0"
                    title="Copy message"
                  >
                    {copied ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>

                  {!isUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleFeedback('positive')}>
                          <ThumbsUp className="w-4 h-4 mr-2" />
                          Helpful response
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleFeedback('negative')}>
                          <ThumbsDown className="w-4 h-4 mr-2" />
                          Not helpful
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleRetry}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Regenerate response
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

/**
 * Enhanced typing indicator with agent theming
 */
export const TypingIndicator = memo(function TypingIndicator({
  agentName = 'router',
  className,
}: {
  agentName?: string;
  className?: string;
}) {
  const theme = getAgentTheme(agentName);

  return (
    <div className={cn("flex gap-3 justify-start mb-4", className)}>
      <Avatar className={cn(
        "flex-shrink-0",
        theme.avatar.size.default,
        theme.avatar.shadow,
        theme.avatar.border
      )}>
        <AvatarFallback className={cn(
          "text-white font-medium text-sm",
          theme.avatar.background
        )}>
          {theme.emoji}
        </AvatarFallback>
      </Avatar>

      <Card className={cn(
        "border",
        theme.message.background,
        theme.message.border
      )}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex space-x-1">
              <div className={cn("w-2 h-2 rounded-full animate-bounce", theme.interactions.indicators.typing.replace('text-', 'bg-'))}></div>
              <div 
                className={cn("w-2 h-2 rounded-full animate-bounce", theme.interactions.indicators.typing.replace('text-', 'bg-'))}
                style={{ animationDelay: '0.1s' }}
              ></div>
              <div 
                className={cn("w-2 h-2 rounded-full animate-bounce", theme.interactions.indicators.typing.replace('text-', 'bg-'))}
                style={{ animationDelay: '0.2s' }}
              ></div>
            </div>
            <span className="text-sm text-muted-foreground">
              {theme.displayName} is thinking...
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';