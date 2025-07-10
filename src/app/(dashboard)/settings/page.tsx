// src/app/(dashboard)/settings/page.tsx
'use client';

import React, { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useForm } from 'react-hook-form';
import { usePreferences, type PreferencesUpdate } from '@/hooks/use-preferences';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Palette, 
  BookOpen, 
  Clock,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
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
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  /**
   * Handle reset to defaults
   */
  const handleResetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset all settings to their default values? This action cannot be undone.')) {
      return;
    }

    try {
      clearError();
      setSaveMessage(null);
      await resetToDefaults();
      setSaveMessage('Settings reset to defaults successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  };

  // Show loading state
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <p className="text-slate-300">Loading your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <SettingsIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Settings</h1>
          </div>
          <p className="text-slate-300 max-w-2xl mx-auto">
            Customize your Smartlyte AI experience. Adjust your learning preferences, notifications, and more.
          </p>
        </div>

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

        {/* Settings Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-slate-800/50 border border-slate-700">
              <TabsTrigger value="learning" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Learning
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="appearance" className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Appearance
              </TabsTrigger>
              <TabsTrigger value="session" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Session
              </TabsTrigger>
            </TabsList>

            {/* Learning Preferences */}
            <TabsContent value="learning" className="space-y-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Learning Preferences
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    Customize how you learn best with Smartlyte AI
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Learning Style */}
                  <div className="space-y-2">
                    <Label htmlFor="learningStyle" className="text-white">
                      Preferred Learning Style
                    </Label>
                    <Select 
                      value={watch('learningStyle') || ''} 
                      onValueChange={(value) => setValue('learningStyle', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your learning style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visual">🎨 Visual - Learn through images and diagrams</SelectItem>
                        <SelectItem value="auditory">🎧 Auditory - Learn through listening</SelectItem>
                        <SelectItem value="kinesthetic">✋ Kinesthetic - Learn through hands-on practice</SelectItem>
                        <SelectItem value="reading">📚 Reading - Learn through text and writing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Difficulty Preference */}
                  <div className="space-y-2">
                    <Label htmlFor="difficultyPreference" className="text-white">
                      Difficulty Preference
                    </Label>
                    <Select 
                      value={watch('difficultyPreference')} 
                      onValueChange={(value) => setValue('difficultyPreference', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">🟢 Easy - Step by step guidance</SelectItem>
                        <SelectItem value="moderate">🟡 Moderate - Balanced approach</SelectItem>
                        <SelectItem value="challenging">🔴 Challenging - Advanced concepts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notification Preferences */}
            <TabsContent value="notifications" className="space-y-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    Choose how you want to receive updates and reminders
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Email Notifications */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-white">Email Notifications</Label>
                      <p className="text-sm text-slate-400">Receive updates and tips via email</p>
                    </div>
                    <Switch 
                      checked={watch('emailNotifications')}
                      onCheckedChange={(checked) => setValue('emailNotifications', checked)}
                    />
                  </div>

                  {/* Push Notifications */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-white">Push Notifications</Label>
                      <p className="text-sm text-slate-400">Receive browser notifications</p>
                    </div>
                    <Switch 
                      checked={watch('pushNotifications')}
                      onCheckedChange={(checked) => setValue('pushNotifications', checked)}
                    />
                  </div>

                  {/* Weekly Progress */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-white">Weekly Progress Reports</Label>
                      <p className="text-sm text-slate-400">Get weekly summaries of your learning</p>
                    </div>
                    <Switch 
                      checked={watch('weeklyProgress')}
                      onCheckedChange={(checked) => setValue('weeklyProgress', checked)}
                    />
                  </div>

                  {/* Session Reminders */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-white">Session Reminders</Label>
                      <p className="text-sm text-slate-400">Get reminded to complete your daily learning</p>
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
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Appearance & Language
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    Customize the look and language of your interface
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Theme */}
                  <div className="space-y-2">
                    <Label htmlFor="theme" className="text-white">
                      Theme
                    </Label>
                    <Select 
                      value={watch('theme')} 
                      onValueChange={(value) => setValue('theme', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">🌙 Dark - Dark theme (recommended)</SelectItem>
                        <SelectItem value="light">☀️ Light - Light theme</SelectItem>
                        <SelectItem value="auto">🔄 Auto - Follow system preference</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Language */}
                  <div className="space-y-2">
                    <Label htmlFor="language" className="text-white">
                      Language
                    </Label>
                    <Select 
                      value={watch('language')} 
                      onValueChange={(value) => setValue('language', value)}
                    >
                      <SelectTrigger>
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
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Session Preferences
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    Set your daily learning goals and session preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Daily Goal */}
                  <div className="space-y-2">
                    <Label htmlFor="dailyGoalMinutes" className="text-white">
                      Daily Learning Goal (minutes)
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
                      className="bg-slate-900/50 border-slate-600 text-white"
                    />
                    <p className="text-sm text-slate-400">
                      Set a realistic daily goal between 5 minutes and 8 hours
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleResetToDefaults}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </Button>

            <div className="flex items-center gap-3">
              {isDirty && (
                <p className="text-sm text-slate-400">
                  You have unsaved changes
                </p>
              )}
              <Button
                type="submit"
                disabled={!isDirty || isSubmitting}
                className="flex items-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Settings
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}