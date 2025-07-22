// src/components/chat/formatted-response/enhanced-markdown.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Copy, 
  Check,
  AlertTriangle,
  Info,
  Lightbulb,
  CheckCircle,
  Code,
  Hash,
  ExternalLink,
  Mail,
  Phone,
  ArrowRight,
  ChevronRight,
  Zap,
  Star,
  Target,
  Shield,
  Clock,
  Users,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAgentTheme, type AgentTheme } from '@/lib/formatting/agent-themes';
import { parseContent, type ContentBlock, type ParsedResponse } from '@/lib/formatting/content-parser';

// ==========================================
// INTERFACES
// ==========================================

interface EnhancedMarkdownProps {
  content: string;
  agentId?: string;
  className?: string;
  enableCopy?: boolean;
  enableInteractions?: boolean;
  compact?: boolean;
  showStats?: boolean;
}

interface MarkdownBlockProps {
  block: ContentBlock;
  theme: AgentTheme;
  enableCopy?: boolean;
  enableInteractions?: boolean;
  compact?: boolean;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Copy text to clipboard with feedback
 */
const useCopyToClipboard = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const copyText = async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
      return true;
    } catch (error) {
      console.error('Failed to copy text:', error);
      return false;
    }
  };
  
  return { copyText, copiedId };
};

/**
 * Format links and email addresses
 */
const formatInlineElements = (text: string): React.ReactNode => {
  // URL pattern
  const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  // Email pattern  
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  // Phone pattern
  const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  // Bold pattern
  const boldPattern = /\*\*(.*?)\*\*/g;
  // Italic pattern
  const italicPattern = /\*(.*?)\*/g;
  // Inline code pattern
  const inlineCodePattern = /`([^`]+)`/g;

  let result: React.ReactNode[] = [];
  let lastIndex = 0;
  let elementId = 0;

  // Find all patterns and their positions
  const patterns = [
    { regex: urlPattern, type: 'url' },
    { regex: emailPattern, type: 'email' },
    { regex: phonePattern, type: 'phone' },
    { regex: boldPattern, type: 'bold' },
    { regex: italicPattern, type: 'italic' },
    { regex: inlineCodePattern, type: 'code' }
  ];

  const matches: Array<{
    index: number;
    length: number;
    text: string;
    type: string;
    match: string;
  }> = [];

  patterns.forEach(({ regex, type }) => {
    let match;
    regex.lastIndex = 0; // Reset regex
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
        text: match[0],
        type,
        match: match[1] || match[0]
      });
    }
  });

  // Sort matches by position
  matches.sort((a, b) => a.index - b.index);

  // Process matches
  matches.forEach((match) => {
    // Add text before this match
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    // Add formatted match
    const key = `${match.type}-${elementId++}`;
    switch (match.type) {
      case 'url':
        result.push(
          <a
            key={key}
            href={match.text}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline inline-flex items-center gap-1"
          >
            {match.text}
            <ExternalLink className="w-3 h-3" />
          </a>
        );
        break;
      case 'email':
        result.push(
          <a
            key={key}
            href={`mailto:${match.text}`}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline inline-flex items-center gap-1"
          >
            <Mail className="w-3 h-3" />
            {match.text}
          </a>
        );
        break;
      case 'phone':
        result.push(
          <a
            key={key}
            href={`tel:${match.text}`}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline inline-flex items-center gap-1"
          >
            <Phone className="w-3 h-3" />
            {match.text}
          </a>
        );
        break;
      case 'bold':
        result.push(
          <strong key={key} className="font-semibold text-slate-900 dark:text-slate-100">
            {match.match}
          </strong>
        );
        break;
      case 'italic':
        result.push(
          <em key={key} className="italic text-slate-700 dark:text-slate-300">
            {match.match}
          </em>
        );
        break;
      case 'code':
        result.push(
          <code
            key={key}
            className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded text-sm font-mono border"
          >
            {match.match}
          </code>
        );
        break;
    }

    lastIndex = match.index + match.length;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length > 0 ? result : text;
};

// ==========================================
// MARKDOWN BLOCK COMPONENTS
// ==========================================

/**
 * Enhanced Step Guide with progress indicators
 */
function EnhancedStepGuide({ block, theme, enableCopy, compact }: MarkdownBlockProps) {
  const { copyText, copiedId } = useCopyToClipboard();
  const steps = (block.metadata?.steps || []) as Array<{number: number; content: string}>;
  
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", theme.avatar.background)}>
            <Hash className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Step-by-Step Guide
          </span>
          <Badge variant="outline" className="text-xs">
            {steps.length} steps
          </Badge>
        </div>
        
        {enableCopy && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyText(block.originalText, block.id)}
            className="h-6 px-2 text-xs"
          >
            {copiedId === block.id ? (
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
        )}
      </div>
      
      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step: {number: number; content: string}, index: number) => (
          <div 
            key={index}
            className={cn(
              "flex gap-3 p-3 rounded-lg border transition-all duration-200",
              theme.content.steps.background,
              theme.content.steps.border,
              "hover:shadow-sm group"
            )}
          >
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-transform group-hover:scale-110",
              theme.content.steps.number
            )}>
              {step.number}
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn("text-sm leading-relaxed", theme.content.steps.completed.split(' ')[2])}>
                {formatInlineElements(step.content)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Target className="w-3 h-3" />
          <span>Follow these steps in order for best results</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Enhanced Bullet List with better styling
 */
function EnhancedBulletList({ block, theme, enableCopy, compact }: MarkdownBlockProps) {
  const { copyText, copiedId } = useCopyToClipboard();
  const items = (block.metadata?.items || []) as string[];
  
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-1.5 h-4 rounded-sm", theme.colors.primary.replace('#', 'bg-[') + ']')} />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Key Points
          </span>
          <Badge variant="outline" className="text-xs">
            {items.length} items
          </Badge>
        </div>
        
        {enableCopy && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyText(block.originalText, block.id)}
            className="h-6 px-2 text-xs"
          >
            {copiedId === block.id ? (
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
        )}
      </div>

      {/* Items */}
      <div className="space-y-2 pl-2">
        {items.map((item: string, index: number) => (
          <div key={index} className="flex gap-3 items-start group">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 transition-transform group-hover:scale-150",
              theme.colors.primary.replace('#', 'bg-[') + ']'
            )} />
            <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 flex-1">
              {formatInlineElements(item)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Enhanced Callout with better icons and styling
 */
function EnhancedCallout({ block, theme, enableCopy, compact }: MarkdownBlockProps) {
  const { copyText, copiedId } = useCopyToClipboard();
  
  const getCalloutConfig = (type: string) => {
    switch (type) {
      case 'tip':
        return {
          icon: Lightbulb,
          label: 'Pro Tip',
          styling: theme.content.callouts.tip,
          iconColor: 'text-blue-600 dark:text-blue-400',
          bgIcon: 'bg-blue-100 dark:bg-blue-900/30',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          label: 'Warning',
          styling: theme.content.callouts.warning,
          iconColor: 'text-amber-600 dark:text-amber-400',
          bgIcon: 'bg-amber-100 dark:bg-amber-900/30',
        };
      case 'important':
        return {
          icon: Zap,
          label: 'Important',
          styling: theme.content.callouts.info,
          iconColor: 'text-red-600 dark:text-red-400',
          bgIcon: 'bg-red-100 dark:bg-red-900/30',
        };
      case 'success':
        return {
          icon: CheckCircle,
          label: 'Success',
          styling: theme.content.callouts.success,
          iconColor: 'text-green-600 dark:text-green-400',
          bgIcon: 'bg-green-100 dark:bg-green-900/30',
        };
      default:
        return {
          icon: Info,
          label: 'Note',
          styling: theme.content.callouts.info,
          iconColor: 'text-slate-600 dark:text-slate-400',
          bgIcon: 'bg-slate-100 dark:bg-slate-900/30',
        };
    }
  };
  
  const config = getCalloutConfig(block.type);
  const IconComponent = config.icon;
  
  return (
    <div className={cn(
      "relative flex gap-3 p-4 rounded-lg border transition-all duration-200 hover:shadow-sm",
      config.styling
    )}>
      {/* Icon background */}
      <div className={cn("flex-shrink-0 p-2 rounded-lg", config.bgIcon)}>
        <IconComponent className={cn("w-5 h-5", config.iconColor)} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">{config.label}</span>
          {enableCopy && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyText(block.originalText, block.id)}
              className="h-6 w-6 p-0"
            >
              {copiedId === block.id ? (
                <Check className="w-3 h-3" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          )}
        </div>
        <div className="text-sm leading-relaxed">
          {formatInlineElements(block.content)}
        </div>
      </div>
      
      {/* Decorative element */}
      <div className={cn(
        "absolute left-0 top-0 w-1 h-full rounded-l-lg",
        config.iconColor.replace('text-', 'bg-')
      )} />
    </div>
  );
}

/**
 * Enhanced Code Block with syntax highlighting and advanced features
 */
function EnhancedCodeBlock({ block, theme, enableCopy, compact }: MarkdownBlockProps) {
  const { copyText, copiedId } = useCopyToClipboard();
  const language = block.metadata?.language || 'text';
  
  return (
    <div className={cn(
      "relative rounded-lg border overflow-hidden transition-all duration-200 hover:shadow-sm",
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
          <Badge variant="outline" className="text-xs">
            {block.content.split('\n').length} lines
          </Badge>
        </div>
        
        {enableCopy && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyText(block.content, block.id)}
            className="h-6 px-2 text-xs"
          >
            {copiedId === block.id ? (
              <>
                <Check className="w-3 h-3 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 mr-1" />
                Copy Code
              </>
            )}
          </Button>
        )}
      </div>
      
      {/* Code content */}
      <div className="p-4">
        <pre className={cn(
          "text-sm leading-relaxed overflow-x-auto font-mono",
          theme.content.code.text
        )}>
          <code>{block.content}</code>
        </pre>
      </div>
      
      {/* Code footer */}
      <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Shield className="w-3 h-3" />
          <span>Always review code before running</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Enhanced Text Block with better typography
 */
function EnhancedTextBlock({ content, theme }: { content: string; theme: AgentTheme }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {formatInlineElements(content)}
      </div>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

/**
 * Enhanced Markdown Renderer with agent theming and rich formatting
 */
export function EnhancedMarkdown({
  content,
  agentId = 'router',
  className,
  enableCopy = true,
  enableInteractions = true,
  compact = false,
  showStats = false,
}: EnhancedMarkdownProps) {
  const theme = getAgentTheme(agentId);
  
  // Parse content for enhanced formatting
  const parsedContent = useMemo(() => {
    return parseContent(content);
  }, [content]);

  // Render content stats if enabled
  const renderStats = () => {
    if (!showStats) return null;
    
    return (
      <div className="flex items-center gap-4 text-xs text-slate-500 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-1">
          <Hash className="w-3 h-3" />
          <span>{parsedContent.blocks.length} blocks</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{parsedContent.processingTime}ms</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          <span>{parsedContent.contentTypes.length} types</span>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Agent Handoff */}
      {parsedContent.hasAgentHandoff && parsedContent.agentTransition && (
        <div className="flex items-center justify-center py-2">
          <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 rounded-full border border-slate-200 dark:border-slate-600">
            <div className="flex items-center gap-2">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs", getAgentTheme(parsedContent.agentTransition.fromAgent).avatar.background)}>
                {getAgentTheme(parsedContent.agentTransition.fromAgent).emoji}
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {getAgentTheme(parsedContent.agentTransition.fromAgent).displayName}
              </span>
            </div>
            
            <ArrowRight className="w-4 h-4 text-slate-400" />
            
            <div className="flex items-center gap-2">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs", getAgentTheme(parsedContent.agentTransition.toAgent).avatar.background)}>
                {getAgentTheme(parsedContent.agentTransition.toAgent).emoji}
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {getAgentTheme(parsedContent.agentTransition.toAgent).displayName}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Content Blocks */}
      {parsedContent.blocks.map((block, index) => {
        const blockProps = {
          block,
          theme,
          enableCopy,
          enableInteractions,
          compact,
        };

        switch (block.type) {
          case 'step-guide':
            return <EnhancedStepGuide key={block.id} {...blockProps} />;
          case 'bullet-list':
            return <EnhancedBulletList key={block.id} {...blockProps} />;
          case 'tip':
          case 'warning':
          case 'important':
          case 'success':
            return <EnhancedCallout key={block.id} {...blockProps} />;
          case 'code':
            return <EnhancedCodeBlock key={block.id} {...blockProps} />;
          case 'text':
          default:
            return <EnhancedTextBlock key={block.id} content={block.content} theme={theme} />;
        }
      })}

      {/* Stats */}
      {renderStats()}
    </div>
  );
}