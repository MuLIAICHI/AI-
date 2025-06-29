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
 * UPDATED: Compatible with new UUID-based conversation schema
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
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center animate-pulse">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <Loader2 className="w-6 h-6 animate-spin absolute -bottom-1 -right-1 text-blue-500" />
          </div>
          <div className="text-center">
            <p className="font-medium">Loading Smartlyte AI...</p>
            <p className="text-sm text-muted-foreground">Initializing your AI learning experience</p>
          </div>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated (shouldn't happen due to middleware)
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <Card className="max-w-md mx-4 shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground mb-6">
              Please sign in to access your personalized AI learning experience with Smartlyte.
            </p>
            <Button 
              onClick={() => window.location.href = '/sign-in'}
              className="w-full"
            >
              Sign In to Continue
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
              currentChatId={currentChatId} // Now string | null
              onChatSelect={handleChatSelect} // Now accepts string
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
            currentChatId={currentChatId} // Now string | null
            onChatSelect={handleChatSelect} // Now accepts string
            onNewChat={handleNewChat}
            isCollapsed={sidebarCollapsed}
          />
        </div>
      )}

      {/* Main Content Area */}
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
              {/* Error state */}
              {error && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="text-destructive border-destructive/20 hover:bg-destructive/10"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              )}

              {/* Settings & Help */}
              <Button variant="ghost" size="sm" title="Settings">
                <Settings className="w-4 h-4" />
              </Button>
              
              <Button variant="ghost" size="sm" title="Help">
                <HelpCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Global Error Alert */}
          {error && (
            <div className="px-4 pb-2">
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {error}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </header>

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden">
          {/* Welcome State */}
          {!currentChatId && messages.length === 0 && !isLoading && (
            <div className="flex items-center justify-center h-full p-8">
              <div className="max-w-2xl text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-4">
                  Welcome to Smartlyte AI
                </h2>
                <p className="text-muted-foreground mb-8 text-lg">
                  Your personalized AI learning companion is ready to help you master 
                  digital skills, financial literacy, and health knowledge.
                </p>
                
                {/* Quick Start Options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-3">
                        <Computer className="w-6 h-6 text-purple-600" />
                      </div>
                      <h3 className="font-medium mb-1">Digital Skills</h3>
                      <p className="text-sm text-muted-foreground">
                        Email, apps & online safety
                      </p>
                    </div>
                  </Card>
                  
                  <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-3">
                        <DollarSign className="w-6 h-6 text-green-600" />
                      </div>
                      <h3 className="font-medium mb-1">Finance Guide</h3>
                      <p className="text-sm text-muted-foreground">
                        Budgeting & money management
                      </p>
                    </div>
                  </Card>
                  
                  <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center mb-3">
                        <Heart className="w-6 h-6 text-red-600" />
                      </div>
                      <h3 className="font-medium mb-1">Health Coach</h3>
                      <p className="text-sm text-muted-foreground">
                        NHS app & health resources
                      </p>
                    </div>
                  </Card>
                </div>

                <Button 
                  onClick={handleNewChat}
                  size="lg"
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Start Your First Conversation
                </Button>
              </div>
            </div>
          )}

          {/* Chat Interface */}
          {(currentChatId || messages.length > 0) && (
            <ChatWindow className="h-full" />
          )}
        </div>
      </div>
    </div>
  );
}