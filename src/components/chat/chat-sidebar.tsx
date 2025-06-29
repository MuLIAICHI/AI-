// src/components/chat/chat-sidebar.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useChat } from '@/hooks/use-chat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Edit3,
  MessageSquare,
  Clock,
  Filter,
  X,
  Loader2,
  Bot,
  Computer,
  DollarSign,
  Heart,
  Sparkles,
  Calendar,
  Archive
} from 'lucide-react';
import { cn } from '@/lib/utils';

// FIXED: Updated Chat interface to match new schema
interface Chat {
  id: string; // CHANGED: UUID string instead of number
  title: string;
  createdAt: Date;
  updatedAt?: Date; // ADDED: New field from API
  latestMessage?: string;
  lastMessageAt: Date;
  lastMessageRole?: 'user' | 'assistant';
  messageCount?: number; // ADDED: New field from API
}

// FIXED: Updated props to use string IDs
interface ChatSidebarProps {
  className?: string;
  onChatSelect?: (chatId: string) => void; // CHANGED: string instead of number
  onNewChat?: () => void;
  currentChatId?: string | null; // CHANGED: string instead of number
  isMobile?: boolean;
  isCollapsed?: boolean;
}

// Agent configuration for filtering and display
const AGENT_FILTERS = {
  all: { label: 'All Chats', icon: MessageSquare, color: 'text-gray-600' },
  router: { label: 'General', icon: Bot, color: 'text-blue-600' },
  'digital-mentor': { label: 'Digital Skills', icon: Computer, color: 'text-purple-600' },
  'finance-guide': { label: 'Finance', icon: DollarSign, color: 'text-green-600' },
  'health-coach': { label: 'Health', icon: Heart, color: 'text-red-600' },
} as const;

type AgentFilter = keyof typeof AGENT_FILTERS;

/**
 * Chat history sidebar component for managing conversations
 * UPDATED: Compatible with new UUID-based conversation schema
 */
export function ChatSidebar({
  className,
  onChatSelect,
  onNewChat,
  currentChatId,
  isMobile = false,
  isCollapsed = false,
}: ChatSidebarProps) {
  const {
    chats,
    loadChats,
    loadChat,
    startNewChat,
    deleteChat,
    isLoading,
    error,
  } = useChat();

  // FIXED: Updated state types to use string IDs
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<AgentFilter>('all');
  const [chatToDelete, setChatToDelete] = useState<string | null>(null); // CHANGED: string
  const [editingChat, setEditingChat] = useState<{ id: string; title: string } | null>(null); // CHANGED: string
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical' | 'oldest'>('recent');

  // Load chats on mount
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Filtered and sorted chats (FIXED: Now handles undefined chats safely)
  const filteredChats = useMemo(() => {
    // CRITICAL FIX: Handle undefined chats array
    if (!chats || !Array.isArray(chats)) {
      return [];
    }

    let filtered = [...chats]; // Create a copy to avoid mutating original

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(chat =>
        chat.title.toLowerCase().includes(query) ||
        chat.latestMessage?.toLowerCase().includes(query)
      );
    }

    // Apply agent filter (would need agent tracking in database)
    // For now, we'll filter based on title keywords
    if (selectedFilter !== 'all') {
      const filterKeywords = {
        'digital-mentor': ['email', 'tech', 'computer', 'digital', 'internet', 'app'],
        'finance-guide': ['money', 'budget', 'bank', 'finance', 'payment', 'save'],
        'health-coach': ['health', 'nhs', 'doctor', 'appointment', 'medical'],
        'router': [], // Will show chats that don't match other categories
      };

      const keywords = filterKeywords[selectedFilter] || [];
      
      if (selectedFilter === 'router') {
        // Show chats that don't match other categories
        filtered = filtered.filter(chat => {
          const title = chat.title.toLowerCase();
          const message = chat.latestMessage?.toLowerCase() || '';
          const allKeywords = [
            ...filterKeywords['digital-mentor'],
            ...filterKeywords['finance-guide'],
            ...filterKeywords['health-coach']
          ];
          return !allKeywords.some(keyword => 
            title.includes(keyword) || message.includes(keyword)
          );
        });
      } else {
        filtered = filtered.filter(chat => {
          const title = chat.title.toLowerCase();
          const message = chat.latestMessage?.toLowerCase() || '';
          return keywords.some(keyword => 
            title.includes(keyword) || message.includes(keyword)
          );
        });
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'recent':
        default:
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      }
    });

    return filtered;
  }, [chats, searchQuery, selectedFilter, sortBy]);

  // FIXED: Updated handler signatures to use string IDs
  const handleChatSelect = async (chatId: string) => {
    try {
      await loadChat(chatId);
      onChatSelect?.(chatId);
    } catch (error) {
      console.error('Failed to load chat:', error);
    }
  };

  // Handle new chat creation
  const handleNewChat = () => {
    startNewChat();
    onNewChat?.();
  };

  // FIXED: Updated to use string ID
  const handleDeleteChat = async (chatId: string) => {
    try {
      await deleteChat(chatId);
      setChatToDelete(null);
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    if (days < 30) return `${Math.floor(days / 7)}w`;
    return `${Math.floor(days / 30)}mo`;
  };

  // Get agent info from chat (simplified detection)
  const getChatAgent = (chat: Chat): AgentFilter => {
    const title = chat.title.toLowerCase();
    const message = chat.latestMessage?.toLowerCase() || '';
    
    if (['email', 'tech', 'computer', 'digital', 'internet', 'app'].some(k => 
      title.includes(k) || message.includes(k))) {
      return 'digital-mentor';
    }
    if (['money', 'budget', 'bank', 'finance', 'payment', 'save'].some(k => 
      title.includes(k) || message.includes(k))) {
      return 'finance-guide';
    }
    if (['health', 'nhs', 'doctor', 'appointment', 'medical'].some(k => 
      title.includes(k) || message.includes(k))) {
      return 'health-coach';
    }
    return 'router';
  };

  if (isCollapsed) {
    return (
      <div className={cn("w-16 border-r bg-muted/30 flex flex-col items-center py-4", className)}>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNewChat}
          className="mb-4"
          title="New Chat"
        >
          <Plus className="w-5 h-5" />
        </Button>
        
        <div className="flex flex-col gap-2">
          {filteredChats.slice(0, 8).map((chat) => {
            const agent = getChatAgent(chat);
            const agentConfig = AGENT_FILTERS[agent];
            const IconComponent = agentConfig.icon;
            
            return (
              <Button
                key={chat.id}
                variant={currentChatId === chat.id ? "default" : "ghost"}
                size="icon"
                onClick={() => handleChatSelect(chat.id)}
                className="w-10 h-10"
                title={chat.title}
              >
                <IconComponent className="w-4 h-4" />
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col h-full bg-background border-r",
      isMobile ? "w-full" : "w-80",
      className
    )}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Conversations</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewChat}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                {AGENT_FILTERS[selectedFilter].label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {Object.entries(AGENT_FILTERS).map(([key, config]) => {
                const IconComponent = config.icon;
                return (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => setSelectedFilter(key as AgentFilter)}
                    className="flex items-center gap-2"
                  >
                    <IconComponent className={cn("w-4 h-4", config.color)} />
                    {config.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Calendar className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortBy('recent')}>
                Most Recent
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('oldest')}>
                Oldest First
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('alphabetical')}>
                Alphabetical
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Filter Summary */}
        {(searchQuery || selectedFilter !== 'all') && (
          <div className="text-xs text-muted-foreground">
            {filteredChats.length} of {chats?.length || 0} conversations
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        )}
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {isLoading && (!chats || chats.length === 0) ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading conversations...</span>
              </div>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground mb-2">
                {searchQuery || selectedFilter !== 'all' 
                  ? 'No conversations match your filters' 
                  : 'No conversations yet'
                }
              </p>
              {!searchQuery && selectedFilter === 'all' && (
                <Button variant="outline" size="sm" onClick={handleNewChat}>
                  Start your first conversation
                </Button>
              )}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const agent = getChatAgent(chat);
              const agentConfig = AGENT_FILTERS[agent];
              const IconComponent = agentConfig.icon;
              const isActive = currentChatId === chat.id;

              return (
                <Card
                  key={chat.id}
                  className={cn(
                    "cursor-pointer transition-all duration-200 hover:shadow-sm group",
                    isActive 
                      ? "ring-2 ring-primary ring-offset-1 bg-primary/5" 
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => handleChatSelect(chat.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <IconComponent className={cn("w-3 h-3 flex-shrink-0", agentConfig.color)} />
                          <h3 className="font-medium text-sm truncate">
                            {chat.title}
                          </h3>
                          {chat.messageCount && chat.messageCount > 0 && (
                            <Badge variant="secondary" className="text-xs px-1 py-0">
                              {chat.messageCount}
                            </Badge>
                          )}
                        </div>
                        
                        {chat.latestMessage && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {chat.latestMessage.length > 80 
                              ? `${chat.latestMessage.substring(0, 80)}...`
                              : chat.latestMessage
                            }
                          </p>
                        )}
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelativeTime(chat.lastMessageAt)}</span>
                          {chat.lastMessageRole === 'user' && (
                            <Badge variant="outline" className="h-4 px-1 text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingChat({ id: chat.id, title: chat.title });
                            }}
                          >
                            <Edit3 className="w-4 h-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              // Archive functionality could be added here
                            }}
                          >
                            <Archive className="w-4 h-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setChatToDelete(chat.id);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-destructive/10 border-t">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!chatToDelete} onOpenChange={() => setChatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => chatToDelete && handleDeleteChat(chatToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog - Coming Soon */}
      {editingChat && (
        <AlertDialog open={!!editingChat} onOpenChange={() => setEditingChat(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rename Conversation</AlertDialogTitle>
              <AlertDialogDescription>
                Conversation renaming functionality coming soon!
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}