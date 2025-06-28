// src/app/(dashboard)/chat/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useChat } from '@/hooks/use-chat';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { ChatWindow } from '@/components/chat/chat-window';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Menu, 
  X, 
  Sidebar, 
  MessageSquare, 
  Sparkles,
  AlertCircle,
  RefreshCw,
  Loader2,
  Settings,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Main chat page component that combines sidebar and chat window
 * Provides complete chat experience with mobile responsiveness
 */
export default function ChatPage() {
  const { user, isLoaded } = useUser();
  const {
    currentChatId,
    chats,
    messages,
    isLoading,
    error,
    loadChats,
    startNewChat,
    clearError,
  } = useChat();

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // Auto-close sidebar on mobile when screen gets small
      if (mobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [sidebarOpen]);

  // Handle chat selection
  const handleChatSelect = (chatId: number) => {
    // Close mobile sidebar after selecting
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Handle new chat creation
  const handleNewChat = () => {
    startNewChat();
    // Close mobile sidebar after creating new chat
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Loading state while user data loads
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading Smartlyte AI...</span>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated (shouldn't happen due to middleware)
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="max-w-md mx-4">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground mb-4">
              Please sign in to access Smartlyte AI chat.
            </p>
            <Button onClick={() => window.location.href = '/sign-in'}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="fixed left-0 top-0 h-full w-80 bg-background shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Chat History</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <ChatSidebar
              currentChatId={currentChatId}
              onChatSelect={handleChatSelect}
              onNewChat={handleNewChat}
              isMobile={true}
              className="border-0"
            />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className={cn(
          "border-r bg-muted/30 transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-80"
        )}>
          <ChatSidebar
            currentChatId={currentChatId}
            onChatSelect={handleChatSelect}
            onNewChat={handleNewChat}
            isCollapsed={sidebarCollapsed}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Button */}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="w-5 h-5" />
                </Button>
              )}

              {/* Desktop Sidebar Toggle */}
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                  <Sidebar className="w-4 h-4" />
                </Button>
              )}

              {/* Page Title */}
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h1 className="font-semibold">Smartlyte AI</h1>
              </div>

              {/* Chat Context */}
              {currentChatId && !isMobile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>•</span>
                  <MessageSquare className="w-4 h-4" />
                  <span>
                    {chats.find(c => c.id === currentChatId)?.title || 'Current Chat'}
                  </span>
                </div>
              )}
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {/* User Info */}
              <div className="hidden sm:flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Welcome,</span>
                <span className="font-medium">
                  {user.firstName || user.emailAddresses[0]?.emailAddress}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" title="Help">
                  <HelpCircle className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" title="Settings">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="px-4 pb-4">
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{error}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadChats()}
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
        </header>

        {/* Chat Content */}
        <main className="flex-1 overflow-hidden">
          {currentChatId || messages.length > 0 ? (
            // Active chat
            <ChatWindow 
              className="h-full"
              showWelcome={messages.length === 0}
            />
          ) : (
            // Welcome/Empty State
            <div className="flex items-center justify-center h-full p-4">
              <Card className="max-w-2xl w-full">
                <CardContent className="p-8 text-center">
                  <div className="mb-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">
                      Welcome to Smartlyte AI!
                    </h2>
                    <p className="text-muted-foreground text-lg">
                      Your personal learning companion for digital skills, finance, and health.
                    </p>
                  </div>

                  {/* Quick Start Options */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {[
                      {
                        title: 'Digital Skills',
                        description: 'Learn email, apps, and online safety',
                        emoji: '🖥️',
                        action: () => handleNewChat()
                      },
                      {
                        title: 'Money Management', 
                        description: 'Master budgeting and banking',
                        emoji: '💰',
                        action: () => handleNewChat()
                      },
                      {
                        title: 'Health Resources',
                        description: 'Navigate NHS services online',
                        emoji: '🏥',
                        action: () => handleNewChat()
                      }
                    ].map((option, index) => (
                      <Card 
                        key={index}
                        className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-105"
                        onClick={option.action}
                      >
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl mb-2">{option.emoji}</div>
                          <h3 className="font-semibold text-sm mb-1">{option.title}</h3>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Primary CTA */}
                  <div className="space-y-4">
                    <Button 
                      size="lg" 
                      onClick={handleNewChat}
                      className="w-full sm:w-auto"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Start Your First Conversation
                    </Button>
                    
                    <p className="text-sm text-muted-foreground">
                      Just start typing, and I'll connect you with the right learning specialist!
                    </p>
                  </div>

                  {/* Stats Display */}
                  {chats.length > 0 && (
                    <div className="pt-6 border-t mt-6">
                      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          <span>{chats.length} conversations</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Sparkles className="w-4 h-4" />
                          <span>3 AI specialists</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}