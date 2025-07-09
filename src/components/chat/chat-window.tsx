// src/components/chat/chat-window.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '@/hooks/use-chat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
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
  Heart,
  CheckCircle,
  Clock,
  Globe,
  UserPlus,
  Target,
  Award,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatWindowProps {
  className?: string;
  showWelcome?: boolean;
  initialAgentId?: 'router' | 'digital-mentor' | 'finance-guide' | 'health-coach';
}

/**
 * 🎯 NEW: User onboarding context interface
 */
interface UserContext {
  needsOnboarding: boolean;
  onboardingCompleted: boolean;
  isFirstTimeUser: boolean;
  userName?: string;
}

/**
 * 🎯 NEW: Onboarding step tracking
 */
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
}

/**
 * Enhanced chat interface component for Smartlyte AI
 * Now includes comprehensive onboarding support and dynamic welcome experience
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
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>(initialAgentId || 'router');
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [showOnboardingSteps, setShowOnboardingSteps] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 🎯 NEW: Onboarding steps configuration
  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome',
      description: 'Get introduced to Smartlyte',
      icon: Sparkles,
      completed: userContext?.isFirstTimeUser === false,
    },
    {
      id: 'language',
      title: 'Language',
      description: 'Choose your preferred language',
      icon: Globe,
      completed: false, // Would be determined by actual progress
    },
    {
      id: 'profile',
      title: 'Profile',
      description: 'Set up your learning profile',
      icon: UserPlus,
      completed: false,
    },
    {
      id: 'subject',
      title: 'Learning Area',
      description: 'Choose your focus area',
      icon: Target,
      completed: false,
    },
    {
      id: 'complete',
      title: 'Ready!',
      description: 'Start your learning journey',
      icon: Award,
      completed: userContext?.onboardingCompleted || false,
    },
  ];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 🎯 NEW: Update user context when messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage.metadata?.userContext) {
        setUserContext(latestMessage.metadata.userContext);
      }
    }
  }, [messages]);

  /**
   * Handle form submission with enhanced context tracking
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const message = input.trim();
    setInput('');
    
    const agentToUse = selectedAgent || 'router';
    
    console.log('🎯 Sending message with agent:', agentToUse);
    
    // Send message and expect enhanced response with user context
    const response = await sendMessage(message, {
      agentId: agentToUse as any,
      stream: true,
    });

    // 🎯 NEW: Handle onboarding completion
    if (response?.userContext?.onboardingCompleted && userContext?.needsOnboarding) {
      setUserContext(prev => prev ? { ...prev, onboardingCompleted: true, needsOnboarding: false } : null);
      
      // Show celebration for completed onboarding
      setTimeout(() => {
        setShowOnboardingSteps(false);
      }, 2000);
    }
  };

  /**
   * Handle agent selection
   */
  const handleAgentSelect = (agentId: string) => {
    console.log('🔄 Agent selected:', agentId);
    setSelectedAgent(agentId);
  };

  /**
   * Get agent configuration
   */
  const getAgentConfig = (agentId?: string) => {
    const configs = {
      'router': {
        name: 'Smart Router',
        description: 'Intelligent routing to the right specialist',
        icon: Sparkles,
        color: 'bg-blue-500',
        textColor: 'text-blue-600',
      },
      'digital-mentor': {
        name: 'Digital Mentor',
        description: 'Technology and digital skills expert',
        icon: Computer,
        color: 'bg-purple-500',
        textColor: 'text-purple-600',
      },
      'finance-guide': {
        name: 'Finance Guide',
        description: 'Money management and financial literacy',
        icon: DollarSign,
        color: 'bg-green-500',
        textColor: 'text-green-600',
      },
      'health-coach': {
        name: 'Health Coach',
        description: 'Health resources and NHS navigation',
        icon: Heart,
        color: 'bg-red-500',
        textColor: 'text-red-600',
      },
    };
    
    return configs[agentId as keyof typeof configs] || configs.router;
  };

  /**
   * 🎯 NEW: Render onboarding welcome card
   */
  const renderOnboardingWelcome = () => {
    if (!userContext?.needsOnboarding) return null;

    const completedSteps = onboardingSteps.filter(step => step.completed).length;
    const progressPercentage = (completedSteps / onboardingSteps.length) * 100;

    return (
      <Card className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-pink-950/20 border-2 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Welcome to Smartlyte!
                </h3>
                <p className="text-sm text-muted-foreground">
                  {userContext.userName ? `Hi ${userContext.userName}! ` : ''}Let's get you started
                </p>
              </div>
            </div>
            
            {showOnboardingSteps && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOnboardingSteps(false)}
                className="text-muted-foreground"
              >
                Hide Steps
              </Button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Setup Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedSteps}/{onboardingSteps.length}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Onboarding Steps */}
          {showOnboardingSteps && (
            <div className="space-y-3 mb-4">
              {onboardingSteps.map((step, index) => {
                const IconComponent = step.icon;
                return (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border",
                      step.completed 
                        ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                        : "bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800"
                    )}
                  >
                    <div className={cn(
                      "p-1.5 rounded-full",
                      step.completed 
                        ? "bg-green-500" 
                        : "bg-gray-400"
                    )}>
                      {step.completed ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : (
                        <IconComponent className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{step.title}</div>
                      <div className="text-xs text-muted-foreground">{step.description}</div>
                    </div>
                    {index === completedSteps && !step.completed && (
                      <Clock className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!showOnboardingSteps && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOnboardingSteps(true)}
                className="flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Show Progress
              </Button>
            )}
            
            <Button
              variant="default"
              size="sm"
              onClick={() => inputRef.current?.focus()}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              <ArrowRight className="w-4 h-4" />
              Continue Setup
            </Button>
          </div>

          {/* Welcome Message */}
          <div className="mt-4 p-4 bg-white/50 dark:bg-gray-900/50 rounded-lg border">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              I'm your AI learning guide! I help people build digital skills, manage money better, 
              and navigate health resources. Just start chatting and I'll guide you through setting 
              up your personalized learning experience.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  /**
   * 🎯 NEW: Render returning user welcome
   */
  const renderReturningUserWelcome = () => {
    if (userContext?.needsOnboarding || messages.length > 0) return null;

    return (
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20">
        <CardContent className="p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-r from-green-500 to-blue-500 rounded-full">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">
            Welcome back{userContext?.userName ? `, ${userContext.userName}` : ''}!
          </h3>
          <p className="text-muted-foreground mb-4">
            Ready to continue your learning journey? I'm here to help with digital skills, 
            money management, and health resources.
          </p>
          
          {/* Quick Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            {['digital-mentor', 'finance-guide', 'health-coach'].map((agentId) => {
              const config = getAgentConfig(agentId);
              const IconComponent = config.icon;
              return (
                <Button
                  key={agentId}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAgentSelect(agentId)}
                  className="flex flex-col items-center gap-1 h-auto py-3"
                >
                  <IconComponent className="w-5 h-5" />
                  <span className="text-xs">{config.name}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  /**
   * 🎯 NEW: Render onboarding completion celebration
   */
  const renderOnboardingCompletion = () => {
    if (!userContext?.onboardingCompleted || userContext?.needsOnboarding) return null;

    return (
      <Card className="bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 dark:from-green-950/20 dark:via-blue-950/20 dark:to-purple-950/20 border-2 border-green-200 dark:border-green-800">
        <CardContent className="p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-r from-green-500 to-blue-500 rounded-full animate-pulse">
              <Award className="w-8 h-8 text-white" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">
            🎉 Setup Complete!
          </h3>
          <p className="text-muted-foreground mb-4">
            {userContext.userName ? `Congratulations ${userContext.userName}! ` : 'Congratulations! '}
            You're all set and ready to start learning. Your personalized AI guide is ready to help!
          </p>
          <Button
            onClick={() => inputRef.current?.focus()}
            className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
          >
            Start Learning!
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn("h-full w-full flex flex-col bg-background", className)}>
      {/* Agent Selection */}
      <div className="border-b p-4 bg-muted/20">
        <div className="flex flex-wrap gap-2 mb-3">
          {['router', 'digital-mentor', 'finance-guide', 'health-coach'].map((agentId) => {
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
        
        {/* Agent Description */}
        {selectedAgent && (
          <div className="text-sm text-muted-foreground">
            {selectedAgent === 'router' 
              ? userContext?.needsOnboarding 
                ? "I'll guide you through setting up your learning experience"
                : "Smart routing will connect you with the right specialist"
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
        {/* Dynamic Welcome Based on User State */}
        {showWelcome && messages.length === 0 && (
          <div className="space-y-4">
            {userContext?.needsOnboarding && renderOnboardingWelcome()}
            {!userContext?.needsOnboarding && renderReturningUserWelcome()}
            {userContext?.onboardingCompleted && renderOnboardingCompletion()}
            
            {/* Fallback Generic Welcome */}
            {!userContext && (
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
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Message History */}
        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <div key={message.id} className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
              {/* Assistant Avatar */}
              {!isUser && (
                <div className="flex-shrink-0 w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              {/* Message Content */}
              <div className={cn("max-w-[80%] space-y-2")}>
                <div className={cn(
                  "rounded-lg px-4 py-2",
                  isUser 
                    ? "bg-primary text-primary-foreground ml-auto" 
                    : "bg-muted"
                )}>
                  <div className="text-sm leading-relaxed">
                    {message.content}
                  </div>
                </div>

                {/* Message Metadata */}
                <div className={cn(
                  "flex items-center gap-2 text-xs",
                  isUser ? "justify-end" : "justify-start"
                )}>
                  <div className={cn(
                    isUser 
                      ? "text-primary-foreground/70" 
                      : "text-muted-foreground"
                  )}>
                    {message.createdAt.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
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
                userContext?.needsOnboarding
                  ? "Tell me what you'd like to learn about..."
                  : selectedAgent === 'router'
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
              onClick={stopStreaming}
              variant="outline"
              size="icon"
              className="flex-shrink-0"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              size="icon"
              className="flex-shrink-0"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}