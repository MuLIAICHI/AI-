// src/components/settings/voice-settings-panel.tsx - FIXED VERSION
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Volume2,
  Mic,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Save,
  TestTube,
  BarChart3,
  Globe,
  Zap,
  Shield,
  Info,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoicePreferences } from '@/hooks/use-voice-preferences';
import { useVoice } from '@/hooks/use-voice';
import { OPENAI_VOICES, type OpenAIVoiceId, type VoiceQuality, type VoiceLatencyMode } from '@/lib/voice/voice-types';

// ==========================================
// INTERFACES
// ==========================================

interface VoiceSettingsPanelProps {
  className?: string;
  trigger?: React.ReactNode;
}

interface VoiceTestState {
  isPlaying: boolean;
  testText: string;
  currentVoice: OpenAIVoiceId;
}

// Define the voice preferences interface locally to ensure type safety
interface LocalVoicePreferences {
  voiceEnabled: boolean;
  voiceLanguage: string;
  voiceSpeed: number;
  voiceProvider: string;
  preferredVoice: string;
  voiceAutoplay: boolean;
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;
  voiceInterruptionsEnabled: boolean;
  voiceVisualizationEnabled: boolean;
  voiceQuality: VoiceQuality;
  voiceLatencyMode: VoiceLatencyMode;
}

// ==========================================
// VOICE SETTINGS PANEL COMPONENT
// ==========================================

export function VoiceSettingsPanel({ className, trigger }: VoiceSettingsPanelProps) {
  const {
    preferences,
    analytics,
    isLoading,
    isUpdating,
    error,
    updatePreferences,
    resetPreferences,
    refreshAnalytics,
    clearError,
    isVoiceEnabled,
    voiceUsageStats,
  } = useVoicePreferences();

  const {
    speak,
    stop,
    isPlaying,
    volume: currentVolume,
    speed: currentSpeed,
    setVolume,
    setSpeed,
  } = useVoice();

  // Local state for form - with proper typing
  const [localPreferences, setLocalPreferences] = useState<LocalVoicePreferences | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [testState, setTestState] = useState<VoiceTestState>({
    isPlaying: false,
    testText: "Hello! This is how I sound with these voice settings. How do you like it?",
    currentVoice: 'alloy',
  });

  // Sync local preferences with hook
  useEffect(() => {
    if (preferences) {
      const mappedPreferences: LocalVoicePreferences = {
        voiceEnabled: preferences.voiceEnabled,
        voiceLanguage: preferences.voiceLanguage,
        voiceSpeed: preferences.voiceSpeed,
        voiceProvider: preferences.voiceProvider,
        preferredVoice: preferences.preferredVoice,
        voiceAutoplay: preferences.voiceAutoplay,
        voiceInputEnabled: preferences.voiceInputEnabled,
        voiceOutputEnabled: preferences.voiceOutputEnabled,
        voiceInterruptionsEnabled: preferences.voiceInterruptionsEnabled,
        voiceVisualizationEnabled: preferences.voiceVisualizationEnabled,
        voiceQuality: preferences.voiceQuality,
        voiceLatencyMode: preferences.voiceLatencyMode,
      };
      setLocalPreferences(mappedPreferences);
      setHasChanges(false);
      
      // Update test state with preferred voice
      setTestState(prev => ({
        ...prev,
        currentVoice: preferences.preferredVoice as OpenAIVoiceId || 'alloy',
      }));
    }
  }, [preferences]);

  // Update local preference with proper typing
  const updateLocalPreference = <K extends keyof LocalVoicePreferences>(
    key: K,
    value: LocalVoicePreferences[K]
  ) => {
    if (!localPreferences) return;
    
    setLocalPreferences(prev => {
      if (!prev) return null;
      return { ...prev, [key]: value };
    });
    setHasChanges(true);
  };

  // Save preferences
  const handleSave = async () => {
    if (!localPreferences || !hasChanges) return;

    try {
      await updatePreferences({
        ...localPreferences,
        voiceProvider: localPreferences.voiceProvider as any, // Replace 'any' with 'VoiceProvider' if imported
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save voice preferences:', error);
    }
  };

  // Reset to defaults
  const handleReset = async () => {
    try {
      await resetPreferences();
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to reset voice preferences:', error);
    }
  };

  // Test voice
  const handleVoiceTest = async (voiceId?: OpenAIVoiceId) => {
    const testVoice = voiceId || testState.currentVoice;
    
    try {
      setTestState(prev => ({ ...prev, isPlaying: true, currentVoice: testVoice }));
      
      await speak({
        text: testState.testText,
        voiceId: testVoice,
        speed: localPreferences?.voiceSpeed || 1.0,
        interrupt: true,
        onComplete: () => setTestState(prev => ({ ...prev, isPlaying: false })),
        onError: () => setTestState(prev => ({ ...prev, isPlaying: false })),
      });
    } catch (error) {
      console.error('Voice test failed:', error);
      setTestState(prev => ({ ...prev, isPlaying: false }));
    }
  };

  // Stop test
  const handleStopTest = async () => {
    try {
      await stop();
      setTestState(prev => ({ ...prev, isPlaying: false }));
    } catch (error) {
      console.error('Failed to stop voice test:', error);
    }
  };

  if (!localPreferences) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const settingsContent = (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button variant="ghost" size="sm" onClick={clearError} className="ml-2">
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="voices">Voices</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Voice Output Settings
              </CardTitle>
              <CardDescription>
                Configure how messages are spoken to you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Enable Voice */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="voice-enabled">Enable Voice Output</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow messages to be spoken aloud
                  </p>
                </div>
                <Switch
                  id="voice-enabled"
                  checked={localPreferences.voiceEnabled}
                  onCheckedChange={(checked) => updateLocalPreference('voiceEnabled', checked)}
                />
              </div>

              {/* Autoplay */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="voice-autoplay">Auto-play Messages</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically speak new assistant messages
                  </p>
                </div>
                <Switch
                  id="voice-autoplay"
                  checked={localPreferences.voiceAutoplay}
                  onCheckedChange={(checked) => updateLocalPreference('voiceAutoplay', checked)}
                  disabled={!localPreferences.voiceEnabled}
                />
              </div>

              {/* Voice Speed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="voice-speed">Speech Speed</Label>
                  <Badge variant="outline">{localPreferences.voiceSpeed}x</Badge>
                </div>
                <Slider
                  id="voice-speed"
                  value={[localPreferences.voiceSpeed]}
                  onValueChange={([value]) => updateLocalPreference('voiceSpeed', value)}
                  min={0.25}
                  max={4.0}
                  step={0.25}
                  disabled={!localPreferences.voiceEnabled}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Slower (0.25x)</span>
                  <span>Normal (1x)</span>
                  <span>Faster (4x)</span>
                </div>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <Label htmlFor="voice-language">Language</Label>
                <Select
                  value={localPreferences.voiceLanguage}
                  onValueChange={(value) => updateLocalPreference('voiceLanguage', value)}
                  disabled={!localPreferences.voiceEnabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                    <SelectItem value="pt">Portuguese</SelectItem>
                    <SelectItem value="ru">Russian</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                    <SelectItem value="ko">Korean</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Voice Input Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Voice Input Settings
              </CardTitle>
              <CardDescription>
                Configure speech-to-text functionality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Enable Voice Input */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="voice-input">Enable Voice Input</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow speaking messages instead of typing
                  </p>
                </div>
                <Switch
                  id="voice-input"
                  checked={localPreferences.voiceInputEnabled}
                  onCheckedChange={(checked) => updateLocalPreference('voiceInputEnabled', checked)}
                />
              </div>

              {/* Interruptions */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="voice-interruptions">Voice Interruptions</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow speaking while voice is playing
                  </p>
                </div>
                <Switch
                  id="voice-interruptions"
                  checked={localPreferences.voiceInterruptionsEnabled}
                  onCheckedChange={(checked) => updateLocalPreference('voiceInterruptionsEnabled', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voice Selection */}
        <TabsContent value="voices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Choose Your Voice</CardTitle>
              <CardDescription>
                Select the AI voice that sounds best to you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.values(OPENAI_VOICES).map((voice) => (
                  <Card
                    key={voice.id}
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:shadow-md",
                      localPreferences.preferredVoice === voice.id && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20"
                    )}
                    onClick={() => updateLocalPreference('preferredVoice', voice.id)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{voice.name}</h4>
                            <p className="text-xs text-muted-foreground capitalize">
                              {voice.gender} • {voice.personality}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {localPreferences.preferredVoice === voice.id && (
                              <CheckCircle className="h-4 w-4 text-blue-500" />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (testState.isPlaying && testState.currentVoice === voice.id) {
                                  handleStopTest();
                                } else {
                                  handleVoiceTest(voice.id);
                                }
                              }}
                              disabled={!localPreferences.voiceEnabled}
                            >
                              {testState.isPlaying && testState.currentVoice === voice.id ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          {voice.description}
                        </p>
                        
                        <div className="flex flex-wrap gap-1">
                          {voice.bestFor.map((use) => (
                            <Badge key={use} variant="secondary" className="text-xs">
                              {use}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Settings */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Advanced Settings
              </CardTitle>
              <CardDescription>
                Fine-tune voice performance and quality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Voice Quality */}
              <div className="space-y-2">
                <Label htmlFor="voice-quality">Voice Quality</Label>
                <Select
                  value={localPreferences.voiceQuality}
                  onValueChange={(value: VoiceQuality) => updateLocalPreference('voiceQuality', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        <div>
                          <div>Standard Quality</div>
                          <div className="text-xs text-muted-foreground">Faster, good quality</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="hd">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <div>
                          <div>HD Quality</div>
                          <div className="text-xs text-muted-foreground">Slower, best quality</div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Latency Mode */}
              <div className="space-y-2">
                <Label htmlFor="latency-mode">Latency Mode</Label>
                <Select
                  value={localPreferences.voiceLatencyMode}
                  onValueChange={(value: VoiceLatencyMode) => updateLocalPreference('voiceLatencyMode', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low Latency (Fastest)</SelectItem>
                    <SelectItem value="balanced">Balanced (Recommended)</SelectItem>
                    <SelectItem value="quality">Quality Focus (Slowest)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Visualization */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="voice-visualization">Voice Visualization</Label>
                  <p className="text-sm text-muted-foreground">
                    Show audio waveforms and visual feedback
                  </p>
                </div>
                <Switch
                  id="voice-visualization"
                  checked={localPreferences.voiceVisualizationEnabled}
                  onCheckedChange={(checked) => updateLocalPreference('voiceVisualizationEnabled', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Test Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Voice Test
              </CardTitle>
              <CardDescription>
                Test your current voice settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleVoiceTest()}
                  disabled={!localPreferences.voiceEnabled || testState.isPlaying}
                  className="flex-1"
                >
                  {testState.isPlaying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Playing Test...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Test Current Settings
                    </>
                  )}
                </Button>
                
                {testState.isPlaying && (
                  <Button variant="outline" onClick={handleStopTest}>
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                "{testState.testText}"
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Voice Usage Analytics
                </CardTitle>
                <CardDescription>
                  Track your voice interaction patterns
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={refreshAnalytics}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Usage Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold text-blue-600">
                    {voiceUsageStats.totalSessions}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Sessions</div>
                </div>
                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(voiceUsageStats.totalDuration / 60)}m
                  </div>
                  <div className="text-xs text-muted-foreground">Total Duration</div>
                </div>
                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(voiceUsageStats.averageSessionLength)}s
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Session</div>
                </div>
                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold text-orange-600">
                    {localPreferences.preferredVoice}
                  </div>
                  <div className="text-xs text-muted-foreground">Preferred Voice</div>
                </div>
              </div>

              {/* Current Settings Summary */}
              <div className="space-y-3">
                <h4 className="font-medium">Current Configuration</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Voice Output:</span>
                    <Badge variant={localPreferences.voiceEnabled ? "default" : "secondary"}>
                      {localPreferences.voiceEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Voice Input:</span>
                    <Badge variant={localPreferences.voiceInputEnabled ? "default" : "secondary"}>
                      {localPreferences.voiceInputEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Speed:</span>
                    <span>{localPreferences.voiceSpeed}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quality:</span>
                    <span className="capitalize">{localPreferences.voiceQuality}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isUpdating}
          className="text-red-600 hover:text-red-700"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
        
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="secondary" className="text-xs">
              Unsaved changes
            </Badge>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isUpdating}
            className="relative"
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );

  // If trigger is provided, wrap in dialog
  if (trigger) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Voice Settings
            </DialogTitle>
            <DialogDescription>
              Configure voice output, input, and AI voice preferences
            </DialogDescription>
          </DialogHeader>
          {settingsContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Return standalone panel
  return (
    <div className={cn("space-y-6", className)}>
      {settingsContent}
    </div>
  );
}