// src/app/(dashboard)/chat/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useChat } from '@/hooks/use-chat';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { ChatWindow } from '@/components/chat/chat-window';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { Button } from '@/components/ui/button';
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
  
  // ✅ NEW: Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      if (mobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [sidebarOpen]);

  const handleChatSelect = (chatId: string) => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleNewChat = () => {
    startNewChat();
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Show loading while user data loads
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {!isMobile && (
        <div className={cn(
          "border-r border-slate-800/50 transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "w-16" : "w-80"
        )}>
          <ChatSidebar
            currentChatId={currentChatId}
            onChatSelect={handleChatSelect}
            onNewChat={handleNewChat}
            isCollapsed={sidebarCollapsed}
            className="h-full"
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        
        {/* Header */}
        <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm flex-shrink-0 h-16">
          <div className="flex items-center justify-between p-4 h-full">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Button */}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(true)}
                  className="mr-2 text-white hover:bg-slate-800"
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
                  className="mr-2 text-white hover:bg-slate-800"
                  title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <Sidebar className="w-4 h-4" />
                </Button>
              )}

              {/* Title */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-lg font-semibold text-white">
                  Smartlyte AI
                </h1>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {/* New Chat Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                className="text-white hover:bg-slate-800"
                title="Start new conversation"
              >
                <Plus className="w-4 h-4" />
                {!isMobile && <span className="ml-2">New Chat</span>}
              </Button>

              {/* ✅ NEW: Settings Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                className="text-white hover:bg-slate-800"
                title="Open settings"
              >
                <Settings className="w-4 h-4" />
              </Button>

              {/* Help Button */}
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-slate-800"
                title="Help & Support"
              >
                <HelpCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <Alert className="m-4 border-red-500/50 bg-red-500/10">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-200">
              {error}
              <Button
                variant="link"
                size="sm"
                onClick={clearError}
                className="ml-2 text-red-300 hover:text-red-100 p-0 h-auto"
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Chat Window */}
        <div className={cn(
          "flex-1 min-h-0",
          isMobile && sidebarOpen ? "h-[calc(100vh-160px)]" : "h-[calc(100vh-64px)]"
        )}>
          <ChatWindow 
            className="h-full w-full"
            showWelcome={!currentChatId && messages.length === 0}
          />
        </div>
      </div>

      {/* Mobile Sidebar */}
      {isMobile && (
        <div className={cn(
          "fixed inset-y-0 left-0 z-50 w-80 bg-slate-900/95 backdrop-blur-sm border-r border-slate-800/50 transform transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <ChatSidebar
            currentChatId={currentChatId}
            onChatSelect={handleChatSelect}
            onNewChat={handleNewChat}
            isMobile={isMobile}
            className="h-full"
          />
        </div>
      )}

      {/* ✅ NEW: Settings Dialog */}
      <SettingsDialog 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
      />
    </div>
  );
}