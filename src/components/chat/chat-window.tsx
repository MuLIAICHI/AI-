// src/components/chat/chat-window.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@/hooks/use-chat';
import { MessageItem, TypingIndicator } from '@/components/chat/message-item';
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
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ==========================================
// INTERFACES
// ==========================================

interface ChatWindowProps {
  className?: string;
  showWelcome?: boolean;
}

// Message interface to match our enhanced system
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system'; // Added 'system' to match useChat
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
// WELCOME MESSAGE COMPONENT
// ==========================================

function WelcomeMessage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6 p-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
            Welcome to Smartlyte AI
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-md">
            Your intelligent learning companion for digital skills, finance, and health guidance
          </p>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full">
        {Object.entries(AGENT_CONFIG).filter(([key]) => key !== 'router').map(([key, agent]) => {
          const IconComponent = agent.icon;
          return (
            <Card key={key} className={cn(
              "p-4 transition-all duration-200 hover:shadow-md border-2 hover:border-primary/50",
              agent.bgColor
            )}>
              <CardContent className="p-0 text-center space-y-3">
                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mx-auto", 
                  "bg-white dark:bg-slate-800 shadow-sm"
                )}>
                  <IconComponent className={cn("w-6 h-6", agent.color)} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {agent.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Start */}
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Try asking me something like:
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            "How do I set up email?",
            "Help me create a budget",
            "What are healthy eating tips?"
          ].map((suggestion, index) => (
            <Badge key={index} variant="outline" className="cursor-pointer hover:bg-primary/10">
              {suggestion}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN CHAT WINDOW COMPONENT
// ==========================================

export function ChatWindow({ className, showWelcome = false }: ChatWindowProps) {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearError,
    retryLastMessage,
  } = useChat();

  // Local input state (since useChat doesn't provide input/setInput)
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

  // Handle message copy
  const handleCopy = (content: string) => {
    console.log('Message copied:', content.substring(0, 50) + '...');
  };

  // Handle message retry
  const handleRetry = (messageId: string) => {
    retryLastMessage();
  };

  // Handle message feedback
  const handleFeedback = (messageId: string, type: 'positive' | 'negative') => {
    console.log(`Feedback for message ${messageId}:`, type);
    // Here you could integrate with your feedback API
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Error Alert */}
      {error && (
        <div className="p-4 border-b border-border">
          <Alert className="border-red-500/50 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-700 dark:text-red-300 flex items-center justify-between">
              <span>{error}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={retryLastMessage}
                  className="text-red-600 hover:text-red-700 hover:bg-red-500/20 h-6 px-2"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearError}
                  className="text-red-600 hover:text-red-700 hover:bg-red-500/20 h-6 px-2"
                >
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {/* Welcome Message */}
          {showWelcome && messages.length === 0 && (
            <WelcomeMessage />
          )}

          {/* Empty State (when no welcome) */}
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
                </p>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages
            .filter(message => message.role !== 'system') // Filter out system messages
            .map((message, index) => (
            <MessageItem
              key={message.id}
              message={{
                ...message,
                role: message.role as 'user' | 'assistant' // Type assertion for filtered messages
              }}
              isLast={index === messages.length - 1}
              onCopy={handleCopy}
              onRetry={handleRetry}
              onFeedback={handleFeedback}
              showActions={true}
              showTimestamp={true}
              compact={false}
            />
          ))}

          {/* Typing Indicator */}
          {isStreaming && (
            <TypingIndicator 
              agentName="router"
              className="animate-fade-in"
            />
          )}

          {/* Scroll Anchor */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Form */}
      <div className="border-t border-border p-4 bg-background/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything about digital skills, finance, or health..."
                disabled={isLoading}
                className="pr-12 bg-background border-border focus:border-primary"
              />
              
              {/* Input Actions */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {input.trim() && (
                  <Badge variant="outline" className="text-xs">
                    {input.trim().split(' ').length} words
                  </Badge>
                )}
              </div>
            </div>
            
            <Button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
          
          {/* Input Help */}
          <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
            <span>
              💡 Try: "How do I set up Gmail?" or "Help me create a budget"
            </span>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">
                Enter
              </kbd>
              <span>to send</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}