// src/components/settings/settings-dialog.tsx
'use client';

import React, { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useForm } from 'react-hook-form';
import { usePreferences, type PreferencesUpdate } from '@/hooks/use-preferences';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Palette, 
  BookOpen, 
  Clock,
  AlertCircle,
  CheckCircle,
  Save,
  Loader2,
  RotateCcw,
  X
} from 'lucide-react';

interface SettingsFormData {
  // Learning preferences
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading' | undefined;
  difficultyPreference: 'easy' | 'moderate' | 'challenging';
  
  // Notification preferences
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyProgress: boolean;
  sessionReminders: boolean;
  
  // UI preferences
  theme: 'dark' | 'light' | 'auto';
  language: string;
  
  // Session preferences
  dailyGoalMinutes: number;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { user } = useUser();
  const { 
    preferences, 
    isLoading, 
    error, 
    updatePreferences, 
    resetToDefaults, 
    clearError 
  } = usePreferences();

  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('learning');

  // Form setup
  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue, 
    reset,
    formState: { isDirty, isSubmitting }
  } = useForm<SettingsFormData>({
    defaultValues: {
      learningStyle: undefined,
      difficultyPreference: 'moderate',
      emailNotifications: true,
      pushNotifications: true,
      weeklyProgress: true,
      sessionReminders: false,
      theme: 'dark',
      language: 'en',
      dailyGoalMinutes: 30,
    }
  });

  // Update form when preferences load
  React.useEffect(() => {
    if (preferences) {
      reset({
        learningStyle: preferences.learningStyle,
        difficultyPreference: preferences.difficultyPreference || 'moderate',
        emailNotifications: preferences.emailNotifications,
        pushNotifications: preferences.pushNotifications,
        weeklyProgress: preferences.weeklyProgress,
        sessionReminders: preferences.sessionReminders,
        theme: preferences.theme,
        language: preferences.language,
        dailyGoalMinutes: preferences.dailyGoalMinutes,
      });
    }
  }, [preferences, reset]);

  // Clear messages when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setSaveMessage(null);
      clearError();
    }
  }, [open, clearError]);

  /**
   * Handle form submission
   */
  const onSubmit = async (data: SettingsFormData) => {
    try {
      clearError();
      setSaveMessage(null);

      const updates: PreferencesUpdate = {
        learningStyle: data.learningStyle,
        difficultyPreference: data.difficultyPreference,
        emailNotifications: data.emailNotifications,
        pushNotifications: data.pushNotifications,
        weeklyProgress: data.weeklyProgress,
        sessionReminders: data.sessionReminders,
        theme: data.theme,
        language: data.language,
        dailyGoalMinutes: data.dailyGoalMinutes,
      };

      await updatePreferences(updates);
      setSaveMessage('Settings saved successfully!');
      
      // Clear success message after 2 seconds
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  /**
   * Handle reset to defaults
   */
  const handleResetToDefaults = async () => {
    if (!confirm('Reset all settings to default values? This cannot be undone.')) {
      return;
    }

    try {
      clearError();
      setSaveMessage(null);
      await resetToDefaults();
      setSaveMessage('Settings reset successfully!');
      
      // Clear success message after 2 seconds
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <SettingsIcon className="w-4 h-4 text-white" />
            </div>
            Settings
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Customize your Smartlyte AI experience
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-120px)]">
          <div className="space-y-4 pr-4">
            {/* Error Alert */}
            {error && (
              <Alert className="border-red-500/50 bg-red-500/10">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-200">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {saveMessage && (
              <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-200">
                  {saveMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-slate-300">Loading settings...</span>
              </div>
            )}

            {/* Settings Form */}
            {!isLoading && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-4 bg-slate-800/50 border border-slate-700">
                    <TabsTrigger value="learning" className="flex items-center gap-1 text-xs">
                      <BookOpen className="w-3 h-3" />
                      Learning
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="flex items-center gap-1 text-xs">
                      <Bell className="w-3 h-3" />
                      Notifications
                    </TabsTrigger>
                    <TabsTrigger value="appearance" className="flex items-center gap-1 text-xs">
                      <Palette className="w-3 h-3" />
                      Appearance
                    </TabsTrigger>
                    <TabsTrigger value="session" className="flex items-center gap-1 text-xs">
                      <Clock className="w-3 h-3" />
                      Session
                    </TabsTrigger>
                  </TabsList>

                  {/* Learning Preferences */}
                  <TabsContent value="learning" className="space-y-4">
                    <Card className="bg-slate-800/30 border-slate-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-sm flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          Learning Preferences
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Learning Style */}
                        <div className="space-y-2">
                          <Label htmlFor="learningStyle" className="text-white text-sm">
                            Learning Style
                          </Label>
                          <Select 
                            value={watch('learningStyle') || ''} 
                            onValueChange={(value) => setValue('learningStyle', value as any)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select style" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="visual">🎨 Visual</SelectItem>
                              <SelectItem value="auditory">🎧 Auditory</SelectItem>
                              <SelectItem value="kinesthetic">✋ Kinesthetic</SelectItem>
                              <SelectItem value="reading">📚 Reading</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Difficulty Preference */}
                        <div className="space-y-2">
                          <Label htmlFor="difficultyPreference" className="text-white text-sm">
                            Difficulty Level
                          </Label>
                          <Select 
                            value={watch('difficultyPreference')} 
                            onValueChange={(value) => setValue('difficultyPreference', value as any)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">🟢 Easy</SelectItem>
                              <SelectItem value="moderate">🟡 Moderate</SelectItem>
                              <SelectItem value="challenging">🔴 Challenging</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Notification Preferences */}
                  <TabsContent value="notifications" className="space-y-4">
                    <Card className="bg-slate-800/30 border-slate-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-sm flex items-center gap-2">
                          <Bell className="w-4 h-4" />
                          Notifications
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Email Notifications */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-white text-sm">Email Updates</Label>
                            <p className="text-xs text-slate-400">Learning tips via email</p>
                          </div>
                          <Switch 
                            checked={watch('emailNotifications')}
                            onCheckedChange={(checked) => setValue('emailNotifications', checked)}
                          />
                        </div>

                        {/* Push Notifications */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-white text-sm">Browser Notifications</Label>
                            <p className="text-xs text-slate-400">Real-time alerts</p>
                          </div>
                          <Switch 
                            checked={watch('pushNotifications')}
                            onCheckedChange={(checked) => setValue('pushNotifications', checked)}
                          />
                        </div>

                        {/* Weekly Progress */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-white text-sm">Weekly Reports</Label>
                            <p className="text-xs text-slate-400">Progress summaries</p>
                          </div>
                          <Switch 
                            checked={watch('weeklyProgress')}
                            onCheckedChange={(checked) => setValue('weeklyProgress', checked)}
                          />
                        </div>

                        {/* Session Reminders */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-white text-sm">Daily Reminders</Label>
                            <p className="text-xs text-slate-400">Learning session alerts</p>
                          </div>
                          <Switch 
                            checked={watch('sessionReminders')}
                            onCheckedChange={(checked) => setValue('sessionReminders', checked)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Appearance Preferences */}
                  <TabsContent value="appearance" className="space-y-4">
                    <Card className="bg-slate-800/30 border-slate-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-sm flex items-center gap-2">
                          <Palette className="w-4 h-4" />
                          Appearance
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Theme */}
                        <div className="space-y-2">
                          <Label htmlFor="theme" className="text-white text-sm">
                            Theme
                          </Label>
                          <Select 
                            value={watch('theme')} 
                            onValueChange={(value) => setValue('theme', value as any)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dark">🌙 Dark</SelectItem>
                              <SelectItem value="light">☀️ Light</SelectItem>
                              <SelectItem value="auto">🔄 Auto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Language */}
                        <div className="space-y-2">
                          <Label htmlFor="language" className="text-white text-sm">
                            Language
                          </Label>
                          <Select 
                            value={watch('language')} 
                            onValueChange={(value) => setValue('language', value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="en">🇺🇸 English</SelectItem>
                              <SelectItem value="es">🇪🇸 Español</SelectItem>
                              <SelectItem value="fr">🇫🇷 Français</SelectItem>
                              <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                              <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                              <SelectItem value="zh">🇨🇳 中文</SelectItem>
                              <SelectItem value="ar">🇸🇦 العربية</SelectItem>
                              <SelectItem value="hi">🇮🇳 हिन्दी</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Session Preferences */}
                  <TabsContent value="session" className="space-y-4">
                    <Card className="bg-slate-800/30 border-slate-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-sm flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Session Goals
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Daily Goal */}
                        <div className="space-y-2">
                          <Label htmlFor="dailyGoalMinutes" className="text-white text-sm">
                            Daily Goal (minutes)
                          </Label>
                          <Input
                            type="number"
                            min="5"
                            max="480"
                            step="5"
                            {...register('dailyGoalMinutes', { 
                              valueAsNumber: true,
                              min: 5,
                              max: 480 
                            })}
                            className="bg-slate-900/50 border-slate-600 text-white h-8"
                          />
                          <p className="text-xs text-slate-400">
                            5 minutes to 8 hours daily
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetToDefaults}
                    disabled={isSubmitting}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </Button>

                  <div className="flex items-center gap-3">
                    {isDirty && (
                      <p className="text-xs text-slate-400">
                        Unsaved changes
                      </p>
                    )}
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!isDirty || isSubmitting}
                      className="flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}