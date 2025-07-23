// src/components/chat/voice-message-controls.tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Play,
  Pause,
  Square,
  Volume2,
  Settings,
  RotateCcw,
  Loader2,
  AlertCircle,
  VolumeX,
  Volume1,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoice } from '@/hooks/use-voice';

// ==========================================
// INTERFACES
// ==========================================

interface VoiceMessageControlsProps {
  messageId: string;
  messageContent: string;
  className?: string;
  compact?: boolean;
  showAdvanced?: boolean;
}

// ==========================================
// VOICE MESSAGE CONTROLS COMPONENT
// ==========================================

export function VoiceMessageControls({
  messageId,
  messageContent,
  className,
  compact = false,
  showAdvanced = false,
}: VoiceMessageControlsProps) {
  const {
    // State
    isPlaying,
    isPaused,
    isLoading,
    error,
    currentText,
    volume,
    speed,
    duration,
    currentTime,
    
    // Actions
    speak,
    pause,
    resume,
    stop,
    setVolume,
    setSpeed,
    clearError,
    
    // Computed
    canSpeak,
    playbackProgress,
    remainingTime,
  } = useVoice();

  // Check if this message is currently being played
  const isCurrentMessage = currentText === messageContent;
  const isThisMessagePlaying = isCurrentMessage && isPlaying;
  const isThisMessagePaused = isCurrentMessage && isPaused;
  const isThisMessageLoading = isCurrentMessage && isLoading;

  // Handle play/pause for this specific message
  const handlePlayPause = async () => {
    try {
      if (isThisMessagePlaying) {
        await pause();
      } else if (isThisMessagePaused) {
        await resume();
      } else {
        // Start playing this message
        await speak({
          text: messageContent,
          interrupt: true,
          onStart: () => console.log(`Started playing message: ${messageId}`),
          onComplete: () => console.log(`Completed playing message: ${messageId}`),
          onError: (error) => console.error(`Error playing message ${messageId}:`, error),
        });
      }
    } catch (error) {
      console.error('Voice control error:', error);
    }
  };

  const handleStop = async () => {
    try {
      await stop();
    } catch (error) {
      console.error('Voice stop error:', error);
    }
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get volume icon based on level
  const getVolumeIcon = () => {
    if (volume === 0) return VolumeX;
    if (volume < 0.5) return Volume1;
    return Volume2;
  };

  const VolumeIcon = getVolumeIcon();

  // Compact mode - just the essential play button
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlayPause}
              disabled={!canSpeak || isThisMessageLoading}
              className={cn(
                "h-8 w-8 p-0 transition-all duration-200",
                isThisMessagePlaying && "bg-blue-50 text-blue-600 hover:bg-blue-100",
                className
              )}
            >
              {isThisMessageLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isThisMessagePlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isThisMessageLoading 
              ? "Loading voice..." 
              : isThisMessagePlaying 
                ? "Pause" 
                : "Play message"
            }
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full controls mode
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Error display */}
      {error && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
              >
                <AlertCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Voice error: {error}</p>
              <p className="text-xs">Click to dismiss</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Main play/pause button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isThisMessagePlaying ? "default" : "outline"}
              size="sm"
              onClick={handlePlayPause}
              disabled={!canSpeak || isThisMessageLoading}
              className={cn(
                "h-8 transition-all duration-200",
                isThisMessagePlaying && "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {isThisMessageLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : isThisMessagePlaying ? (
                <Pause className="h-4 w-4 mr-1" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              <span className="text-xs">
                {isThisMessageLoading 
                  ? "Loading" 
                  : isThisMessagePlaying 
                    ? "Pause" 
                    : "Play"
                }
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isThisMessageLoading 
              ? "Generating voice..." 
              : isThisMessagePlaying 
                ? "Pause playback" 
                : "Play this message"
            }
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Stop button (only show if playing) */}
      {(isThisMessagePlaying || isThisMessagePaused) && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStop}
                className="h-8 w-8 p-0"
              >
                <Square className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop playback</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Progress indicator */}
      {isCurrentMessage && duration > 0 && (
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="text-xs">
            {formatTime(currentTime)} / {formatTime(duration)}
          </Badge>
          {playbackProgress > 0 && (
            <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${playbackProgress * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Advanced controls */}
      {showAdvanced && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <DropdownMenuLabel>Voice Controls</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Volume Control */}
            <div className="px-2 py-2">
              <div className="flex items-center gap-2 mb-2">
                <VolumeIcon className="h-4 w-4" />
                <span className="text-sm">Volume</span>
              </div>
              <Slider
                value={[volume * 100]}
                onValueChange={([value]) => setVolume(value / 100)}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            <DropdownMenuSeparator />

            {/* Speed Control */}
            <div className="px-2 py-2">
              <div className="flex items-center gap-2 mb-2">
                <RotateCcw className="h-4 w-4" />
                <span className="text-sm">Speed: {speed}x</span>
              </div>
              <Slider
                value={[speed * 100]}
                onValueChange={([value]) => setSpeed(value / 100)}
                min={25}
                max={400}
                step={25}
                className="w-full"
              />
            </div>

            <DropdownMenuSeparator />

            {/* Quick Actions */}
            <DropdownMenuItem onClick={() => setSpeed(0.75)}>
              <SkipBack className="h-4 w-4 mr-2" />
              Slow (0.75x)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSpeed(1.0)}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Normal (1x)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSpeed(1.25)}>
              <SkipForward className="h-4 w-4 mr-2" />
              Fast (1.25x)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Status indicator */}
      {isCurrentMessage && (
        <Badge 
          variant={isThisMessagePlaying ? "default" : "secondary"}
          className={cn(
            "text-xs",
            isThisMessagePlaying && "bg-blue-100 text-blue-800"
          )}
        >
          {isThisMessageLoading ? "Loading" : 
           isThisMessagePlaying ? "Playing" : 
           isThisMessagePaused ? "Paused" : "Ready"}
        </Badge>
      )}
    </div>
  );
}