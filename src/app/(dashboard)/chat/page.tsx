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
  HelpCircle,
  Brain,
  Plus,
  Computer,
  DollarSign,
  Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Main chat page component that combines sidebar and chat window
 * Provides complete chat experience with mobile responsiveness
 * ✅ FIXED: Now includes ChatWindow in main content area
 */
export default function ChatPage() {
  const { user, isLoaded } = useUser();
  const {
    currentChatId, // Now string | null
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

  // FIXED: Updated handler signature to use string ID
  const handleChatSelect = (chatId: string) => {
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

  // Handle error retry
  const handleRetry = () => {
    clearError();
    loadChats();
  };

  // Loading state while user data loads
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -top-1 -right-1">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          </div>
          <div className="text-center">
            <p className="font-medium">Loading Smartlyte AI...</p>
            <p className="text-sm">Preparing your learning experience</p>
          </div>
        </div>
      </div>
    );
  }

  // User not signed in
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Welcome to Smartlyte AI</h2>
                <p className="text-muted-foreground mt-1">
                  Please sign in to start your learning journey
                </p>
              </div>
              <Button 
                onClick={() => window.location.href = '/sign-in'}
                className="w-full"
              >
                Sign In to Continue
              </Button>
            </div>
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
            className="fixed inset-0 bg-black/50 transition-opacity backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="fixed left-0 top-0 h-full w-80 bg-background shadow-xl border-r">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h2 className="font-semibold">Conversations</h2>
              </div>
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
          "border-r bg-muted/30 transition-all duration-300 ease-in-out",
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

      {/* ✅ FIXED: Main Content Area - NOW INCLUDED! */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Button */}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(true)}
                  className="mr-2"
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
                  className="mr-2"
                  title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <Sidebar className="w-4 h-4" />
                </Button>
              )}

              {/* Page Title & Status */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Brain className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold">Smartlyte AI</h1>
                    {currentChatId && (
                      <p className="text-xs text-muted-foreground">
                        Active conversation
                      </p>
                    )}
                  </div>
                </div>

                {/* Connection Status */}
                {isLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {/* New Chat Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewChat}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {!isMobile && "New Chat"}
              </Button>

              {/* Settings */}
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>

              {/* Help */}
              <Button variant="ghost" size="sm">
                <HelpCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* ✅ FIXED: Chat Window - NOW RENDERED! */}
        <div className="flex-1 overflow-hidden">
          <ChatWindow 
            className="h-full"
            showWelcome={!currentChatId && messages.length === 0}
          />
        </div>
      </div>
    </div>
  );
}