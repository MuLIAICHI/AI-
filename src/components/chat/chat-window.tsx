// src/components/chat/chat-window.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '@/hooks/use-chat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Send, 
  Square, 
  Bot, 
  User, 
  AlertCircle, 
  RefreshCw,
  Sparkles,
  Computer,
  DollarSign,
  Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatWindowProps {
  className?: string;
  showWelcome?: boolean;
  initialAgentId?: 'router' | 'digital-mentor' | 'finance-guide' | 'health-coach';
}

/**
 * Main chat interface component for Smartlyte AI
 * Connects users with intelligent router and three specialist learning agents
 */
export function ChatWindow({ 
  className, 
  showWelcome = true,
  initialAgentId 
}: ChatWindowProps) {
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearError,
    retryLastMessage,
  } = useChat();

  const [input, setInput] = useState('');
  // ✅ FIXED: Default to 'router' instead of undefined for Smart Router
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>(initialAgentId || 'router');
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

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const message = input.trim();
    setInput('');
    
    // ✅ FIXED: Ensure we always pass a valid agent ID, default to 'router'
    const agentToUse = selectedAgent || 'router';
    
    console.log('🎯 Sending message with agent:', agentToUse); // Debug log
    
    await sendMessage(message, {
      agentId: agentToUse as any,
      stream: true,
    });
  };

  /**
   * ✅ FIXED: Handle agent selection properly
   */
  const handleAgentSelect = (agentId: string) => {
    console.log('🔄 Agent selected:', agentId); // Debug log
    setSelectedAgent(agentId);
  };

  /**
   * Get agent configuration
   */
  const getAgentConfig = (agentId?: string) => {
    const configs = {
      'router': {
        name: 'Smart Router',
        description: 'I\'ll connect you with the right specialist',
        icon: Bot,
        color: 'bg-blue-500',
        emoji: '🤖'
      },
      'digital-mentor': {
        name: 'Digital Mentor',
        description: 'Technology & digital skills expert',
        icon: Computer,
        color: 'bg-purple-500',
        emoji: '🖥️'
      },
      'finance-guide': {
        name: 'Finance Guide',
        description: 'Money management & financial literacy',
        icon: DollarSign,
        color: 'bg-green-500',
        emoji: '💰'
      },
      'health-coach': {
        name: 'Health Coach',
        description: 'Digital health resources & NHS navigation',
        icon: Heart,
        color: 'bg-red-500',
        emoji: '🏥'
      }
    };

    return configs[agentId as keyof typeof configs] || configs.router;
  };

  /**
   * Get agent info from message
   */
  const getMessageAgentInfo = (agentName?: string) => {
    if (!agentName) return getAgentConfig('router');
    
    // Map agent names to IDs
    const nameToId = {
      'Digital Mentor': 'digital-mentor',
      'Finance Guide': 'finance-guide', 
      'Health Coach': 'health-coach',
      'Smart Router': 'router',
      'Intelligent Router': 'router',
    };

    const agentId = nameToId[agentName as keyof typeof nameToId] || 'router';
    return getAgentConfig(agentId);
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Agent Selection Bar */}
      <div className="border-b p-4 bg-muted/30">
        <div className="flex flex-wrap gap-2">
          {/* ✅ FIXED: Smart Router button - set to 'router' instead of empty string */}
          <Button
            variant={selectedAgent === 'router' ? "default" : "outline"}
            size="sm"
            onClick={() => handleAgentSelect('router')}
            className="flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Smart Router
          </Button>
          
          {(['digital-mentor', 'finance-guide', 'health-coach'] as const).map((agentId) => {
            const config = getAgentConfig(agentId);
            const IconComponent = config.icon;
            
            return (
              <Button
                key={agentId}
                variant={selectedAgent === agentId ? "default" : "outline"}
                size="sm"
                onClick={() => handleAgentSelect(agentId)}
                className="flex items-center gap-2"
              >
                <IconComponent className="w-4 h-4" />
                {config.name}
              </Button>
            );
          })}
        </div>
        
        {/* ✅ UPDATED: Show correct description for router */}
        {selectedAgent && (
          <div className="mt-2 text-sm text-muted-foreground">
            {selectedAgent === 'router' 
              ? "Smart routing will connect you with the right specialist"
              : `Chat directly with: ${getAgentConfig(selectedAgent).description}`
            }
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={retryLastMessage}
                  disabled={isStreaming}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearError}
                >
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome Message */}
        {showWelcome && messages.length === 0 && (
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
            <CardContent className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Welcome to Smartlyte AI!</h3>
              <p className="text-muted-foreground mb-4">
                I'm here to help you learn digital skills, manage finances, and navigate health resources.
                Just start chatting, and I'll connect you with the right specialist!
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Computer className="w-3 h-3" />
                  Digital Skills
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Money Management
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  Health Resources
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Messages */}
        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          const agentInfo = isUser ? null : getMessageAgentInfo(message.agentName);
          const IconComponent = agentInfo?.icon || User;

          return (
            <div key={message.id} className={cn(
              "flex gap-3",
              isUser ? "justify-end" : "justify-start"
            )}>
              {/* Agent Avatar */}
              {!isUser && (
                <div className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium",
                  agentInfo?.color || "bg-gray-500"
                )}>
                  <IconComponent className="w-4 h-4" />
                </div>
              )}

              {/* Message Bubble */}
              <div className={cn(
                "max-w-[80%] rounded-lg px-4 py-2",
                isUser 
                  ? "bg-primary text-primary-foreground ml-auto" 
                  : "bg-muted"
              )}>
                {/* Agent Name */}
                {!isUser && message.agentName && (
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    {message.agentName}
                  </div>
                )}
                
                {/* Message Content */}
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
                
                {/* Timestamp */}
                <div className={cn(
                  "text-xs mt-1 opacity-70",
                  isUser ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {message.createdAt.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Typing Indicator */}
        {isStreaming && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse delay-75" />
                <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-pulse delay-150" />
              </div>
            </div>
          </div>
        )}

        {/* Scroll Anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="border-t p-4 bg-background">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedAgent === 'router'
                  ? "Ask about digital skills, money management, or health resources..."
                  : `Ask ${getAgentConfig(selectedAgent).name} anything...`
              }
              disabled={isStreaming}
              className="pr-16"
              maxLength={4000}
            />
            
            {/* Character Count */}
            {input.length > 3500 && (
              <div className="absolute right-16 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {input.length}/4000
              </div>
            )}
          </div>
          
          {/* Send/Stop Button */}
          {isStreaming ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={stopStreaming}
              className="flex-shrink-0"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </form>
        
        {/* Input Helper Text */}
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <div>
            {selectedAgent === 'router' ? (
              <span>Smart routing will choose the best specialist for you</span>
            ) : selectedAgent ? (
              <span>Chatting with {getAgentConfig(selectedAgent).name}</span>
            ) : (
              <span>Select an agent above</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isStreaming && (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Live response
              </span>
            )}
            <kbd className="px-2 py-0.5 bg-muted rounded text-xs">
              Enter to send
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}