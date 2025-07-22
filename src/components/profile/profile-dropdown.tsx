// src/components/profile/profile-dropdown.tsx
'use client';

import React, { useState } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useProfile } from '@/hooks/use-profile';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  User,
  Settings,
  TrendingUp,
  BookOpen,
  LogOut,
  ChevronDown,
  Computer,
  DollarSign,
  Heart,
  Trophy,
  Calendar,
  Zap,
  Target,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileDropdownProps {
  className?: string;
  onEditProfile?: () => void;
}

/**
 * Subject configuration for progress display
 */
const SUBJECT_CONFIG = {
  digital: {
    name: 'Digital Skills',
    icon: Computer,
    color: 'bg-purple-500',
    textColor: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20',
  },
  finance: {
    name: 'Finance Guide',
    icon: DollarSign,
    color: 'bg-green-500',
    textColor: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
  },
  health: {
    name: 'Health Coach',
    icon: Heart,
    color: 'bg-red-500',
    textColor: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
  },
} as const;

/**
 * Get user initials for avatar fallback
 */
function getUserInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName[0].toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return 'U';
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function ProfileDropdown({ className, onEditProfile }: ProfileDropdownProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { profileData, isLoading, error, displayName, progressSummary } = useProfile();
  
  const [isSigningOut, setIsSigningOut] = useState(false);

  /**
   * Handle sign out
   */
  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      setIsSigningOut(false);
    }
  };

  /**
   * Get progress summary with colors
   */
  const getProgressData = () => {
    return Object.entries(progressSummary).map(([subject, percentage]) => {
      const config = SUBJECT_CONFIG[subject as keyof typeof SUBJECT_CONFIG];
      return {
        subject: subject as keyof typeof SUBJECT_CONFIG,
        name: config.name,
        percentage,
        icon: config.icon,
        color: config.color,
      };
    });
  };

  // Don't render if user is not loaded
  if (!user) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={cn(
            "relative h-10 w-10 rounded-full hover:bg-slate-800/50 transition-colors",
            className
          )}
        >
          <Avatar className="h-8 w-8">
            <AvatarImage 
              src={user.imageUrl} 
              alt={displayName}
              className="object-cover"
            />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-medium">
              {getUserInitials(
                profileData?.profile.firstName, 
                profileData?.profile.lastName, 
                user.emailAddresses[0]?.emailAddress
              )}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className="absolute -bottom-1 -right-1 h-3 w-3 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        className="w-80 bg-slate-900 border-slate-700 text-white"
        align="end"
        sideOffset={5}
      >
        {/* User Info Header */}
        <DropdownMenuLabel className="p-4 pb-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage 
                src={user.imageUrl} 
                alt={displayName}
                className="object-cover"
              />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {getUserInitials(
                  profileData?.profile.firstName, 
                  profileData?.profile.lastName, 
                  user.emailAddresses[0]?.emailAddress
                )}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-white truncate">
                  {displayName}
                </p>
                {profileData?.profile.onboardingCompleted && (
                  <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                    <Trophy className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-400 truncate">
                {user.emailAddresses[0]?.emailAddress}
              </p>
              {profileData?.profile.preferredSubject && (
                <p className="text-xs text-slate-500 mt-1">
                  Learning: {SUBJECT_CONFIG[profileData.profile.preferredSubject].name}
                </p>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-slate-700" />

        {/* Loading State */}
        {isLoading && (
          <div className="p-4 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-slate-400">Loading profile...</span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Failed to load profile</span>
            </div>
          </div>
        )}

        {/* Progress Overview */}
        {profileData && !isLoading && (
          <>
            <div className="p-4 pb-2">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-slate-300">Learning Progress</span>
              </div>
              
              <div className="space-y-3">
                {getProgressData().map(({ subject, name, percentage, icon: IconComponent, color }) => (
                  <div key={subject} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconComponent className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-400">{name}</span>
                      </div>
                      <span className="text-xs text-slate-300 font-medium">{percentage}%</span>
                    </div>
                    <Progress 
                      value={percentage} 
                      className="h-1.5 bg-slate-800"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            {profileData.stats && (
              <div className="px-4 pb-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="space-y-1">
                    <div className="flex items-center justify-center">
                      <Zap className="w-3 h-3 text-yellow-400" />
                    </div>
                    <p className="text-xs text-slate-400">Streak</p>
                    <p className="text-sm font-semibold text-white">{profileData.stats.currentStreak}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-center">
                      <Target className="w-3 h-3 text-green-400" />
                    </div>
                    <p className="text-xs text-slate-400">Topics</p>
                    <p className="text-sm font-semibold text-white">{profileData.stats.completedTopics}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-center">
                      <Trophy className="w-3 h-3 text-purple-400" />
                    </div>
                    <p className="text-xs text-slate-400">Awards</p>
                    <p className="text-sm font-semibold text-white">{profileData.stats.achievements}</p>
                  </div>
                </div>
              </div>
            )}

            <DropdownMenuSeparator className="bg-slate-700" />
          </>
        )}

        {/* Action Items */}
        <div className="p-1">
          <DropdownMenuItem 
            onClick={onEditProfile}
            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-800 rounded-md"
          >
            <User className="w-4 h-4 text-slate-400" />
            <span className="text-sm">Edit Profile</span>
          </DropdownMenuItem>

          <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-800 rounded-md">
            <Settings className="w-4 h-4 text-slate-400" />
            <span className="text-sm">Preferences</span>
          </DropdownMenuItem>

          <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-800 rounded-md">
            <BookOpen className="w-4 h-4 text-slate-400" />
            <span className="text-sm">Learning History</span>
          </DropdownMenuItem>

          {profileData?.stats && (
            <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-800 rounded-md">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-sm">
                Joined {formatDate(profileData.stats.joinedDate)}
              </span>
            </DropdownMenuItem>
          )}
        </div>

        <DropdownMenuSeparator className="bg-slate-700" />

        {/* Sign Out */}
        <div className="p-1">
          <DropdownMenuItem 
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-red-900/20 text-red-400 hover:text-red-300 rounded-md"
          >
            {isSigningOut ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            <span className="text-sm">
              {isSigningOut ? 'Signing out...' : 'Sign Out'}
            </span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}