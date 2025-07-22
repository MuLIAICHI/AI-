// src/components/profile/profile-edit-dialog.tsx
'use client';

import React, { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useForm } from 'react-hook-form';
import { useProfile, type ProfileUpdate } from '@/hooks/use-profile';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User as UserIcon, 
  GraduationCap, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Save,
  Loader2,
  RotateCcw,
  Computer,
  DollarSign,
  Heart,
  Trophy,
  Calendar,
  Zap,
  Target,
  Mail,
  UserCircle,
  BookOpen,
  Settings,
  Star
} from 'lucide-react';

interface ProfileFormData {
  firstName: string;
  lastName: string;
  preferredSubject: 'digital' | 'finance' | 'health' | '';
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | '';
}

interface ProfileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Subject configuration
 */
const SUBJECT_OPTIONS = {
  digital: {
    value: 'digital',
    label: 'Digital Skills',
    description: 'Technology, online safety, and digital literacy',
    icon: Computer,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  finance: {
    value: 'finance',
    label: 'Finance Guide',
    description: 'Budgeting, banking, and financial planning',
    icon: DollarSign,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  health: {
    value: 'health',
    label: 'Health Coach',
    description: 'Wellness, nutrition, and healthy lifestyle',
    icon: Heart,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
} as const;

/**
 * Skill level options
 */
const SKILL_LEVELS = [
  { value: 'beginner', label: 'Beginner', description: 'New to this topic' },
  { value: 'intermediate', label: 'Intermediate', description: 'Some experience' },
  { value: 'advanced', label: 'Advanced', description: 'Experienced user' },
] as const;

/**
 * Get user initials for avatar
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
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function ProfileEditDialog({ open, onOpenChange }: ProfileEditDialogProps) {
  const { user } = useUser();
  const { 
    profileData, 
    isLoading, 
    error, 
    updateProfile, 
    clearError,
    displayName,
    progressSummary 
  } = useProfile();

  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('profile');

  // Form setup
  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue, 
    reset,
    formState: { isDirty, isSubmitting }
  } = useForm<ProfileFormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      preferredSubject: '',
      skillLevel: '',
    }
  });

  // Update form when profile data loads
  React.useEffect(() => {
    if (profileData?.profile) {
      reset({
        firstName: profileData.profile.firstName || '',
        lastName: profileData.profile.lastName || '',
        preferredSubject: profileData.profile.preferredSubject || '',
        skillLevel: profileData.profile.skillLevel || '',
      });
    }
  }, [profileData, reset]);

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
  const onSubmit = async (data: ProfileFormData) => {
    try {
      clearError();
      setSaveMessage(null);

      const updates: ProfileUpdate = {
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        preferredSubject: data.preferredSubject || undefined,
        skillLevel: data.skillLevel || undefined,
      };

      // Remove empty string values
      Object.keys(updates).forEach(key => {
        if (updates[key as keyof ProfileUpdate] === '') {
          delete updates[key as keyof ProfileUpdate];
        }
      });

      await updateProfile(updates);
      setSaveMessage('Profile updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-white" />
            </div>
            Profile Settings
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Manage your profile information and learning preferences
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
                <span className="ml-2 text-slate-300">Loading profile...</span>
              </div>
            )}

            {/* Profile Form */}
            {!isLoading && profileData && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3 bg-slate-800 border-slate-700">
                    <TabsTrigger 
                      value="profile" 
                      className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400"
                    >
                      <UserCircle className="w-4 h-4 mr-2" />
                      Profile Info
                    </TabsTrigger>
                    <TabsTrigger 
                      value="learning" 
                      className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400"
                    >
                      <GraduationCap className="w-4 h-4 mr-2" />
                      Learning
                    </TabsTrigger>
                    <TabsTrigger 
                      value="progress" 
                      className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400"
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Progress
                    </TabsTrigger>
                  </TabsList>

                  {/* Profile Info Tab */}
                  <TabsContent value="profile" className="space-y-4">
                    <Card className="bg-slate-800/30 border-slate-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-sm flex items-center gap-2">
                          <UserCircle className="w-4 h-4" />
                          Personal Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Avatar Display */}
                        <div className="flex items-center gap-4 mb-4">
                          <Avatar className="h-16 w-16">
                            <AvatarImage 
                              src={user?.imageUrl} 
                              alt={displayName}
                              className="object-cover"
                            />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-lg">
                              {getUserInitials(
                                profileData.profile.firstName, 
                                profileData.profile.lastName, 
                                user?.emailAddresses[0]?.emailAddress
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-white font-medium">{displayName}</p>
                            <p className="text-slate-400 text-sm">{user?.emailAddresses[0]?.emailAddress}</p>
                            {profileData.profile.onboardingCompleted && (
                              <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30 mt-1">
                                <Trophy className="w-3 h-3 mr-1" />
                                Member since {formatDate(profileData.stats.joinedDate)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Name Fields */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="firstName" className="text-white text-sm">
                              First Name
                            </Label>
                            <Input
                              {...register('firstName')}
                              id="firstName"
                              placeholder="Enter your first name"
                              className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 h-8"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName" className="text-white text-sm">
                              Last Name
                            </Label>
                            <Input
                              {...register('lastName')}
                              id="lastName"
                              placeholder="Enter your last name"
                              className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 h-8"
                            />
                          </div>
                        </div>

                        {/* Email (Read-only) */}
                        <div className="space-y-2">
                          <Label className="text-white text-sm flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            Email Address
                          </Label>
                          <Input
                            value={user?.emailAddresses[0]?.emailAddress || ''}
                            disabled
                            className="bg-slate-800/30 border-slate-700 text-slate-400 h-8"
                          />
                          <p className="text-xs text-slate-500">
                            Email is managed by your account settings
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Learning Preferences Tab */}
                  <TabsContent value="learning" className="space-y-4">
                    <Card className="bg-slate-800/30 border-slate-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-sm flex items-center gap-2">
                          <GraduationCap className="w-4 h-4" />
                          Learning Preferences
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-sm">
                          Choose your primary learning focus and skill level
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Subject Selection */}
                        <div className="space-y-3">
                          <Label className="text-white text-sm">Primary Learning Subject</Label>
                          <div className="grid gap-3">
                            {Object.values(SUBJECT_OPTIONS).map((subject) => {
                              const IconComponent = subject.icon;
                              const isSelected = watch('preferredSubject') === subject.value;
                              
                              return (
                                <div
                                  key={subject.value}
                                  onClick={() => setValue('preferredSubject', subject.value as any)}
                                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                    isSelected 
                                      ? 'border-blue-500 bg-blue-500/10' 
                                      : 'border-slate-600 bg-slate-800/30 hover:border-slate-500'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${subject.bgColor}`}>
                                      <IconComponent className={`w-4 h-4 ${subject.color}`} />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-white font-medium text-sm">{subject.label}</p>
                                      <p className="text-slate-400 text-xs">{subject.description}</p>
                                    </div>
                                    {isSelected && (
                                      <CheckCircle className="w-5 h-5 text-blue-500" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Skill Level */}
                        <div className="space-y-3">
                          <Label className="text-white text-sm">Current Skill Level</Label>
                          <Select 
                            value={watch('skillLevel')} 
                            onValueChange={(value) => setValue('skillLevel', value as any)}
                          >
                            <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white h-10">
                              <SelectValue placeholder="Select your skill level" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              {SKILL_LEVELS.map((level) => (
                                <SelectItem 
                                  key={level.value} 
                                  value={level.value}
                                  className="text-white hover:bg-slate-700"
                                >
                                  <div>
                                    <div className="font-medium">{level.label}</div>
                                    <div className="text-xs text-slate-400">{level.description}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Progress Overview Tab */}
                  <TabsContent value="progress" className="space-y-4">
                    <Card className="bg-slate-800/30 border-slate-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-white text-sm flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Learning Progress
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-sm">
                          Your learning journey and achievements
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Progress by Subject */}
                        <div className="space-y-4">
                          <h4 className="text-white text-sm font-medium">Subject Progress</h4>
                          {Object.entries(progressSummary).map(([subject, percentage]) => {
                            const config = SUBJECT_OPTIONS[subject as keyof typeof SUBJECT_OPTIONS];
                            const IconComponent = config.icon;
                            
                            return (
                              <div key={subject} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <IconComponent className={`w-4 h-4 ${config.color}`} />
                                    <span className="text-white text-sm">{config.label}</span>
                                  </div>
                                  <span className="text-slate-300 text-sm font-medium">{percentage}%</span>
                                </div>
                                <Progress 
                                  value={percentage} 
                                  className="h-2 bg-slate-700"
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="w-4 h-4 text-yellow-400" />
                              <span className="text-slate-300 text-sm">Current Streak</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{profileData.stats.currentStreak}</p>
                            <p className="text-xs text-slate-500">days in a row</p>
                          </div>
                          
                          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="flex items-center gap-2 mb-2">
                              <Target className="w-4 h-4 text-green-400" />
                              <span className="text-slate-300 text-sm">Topics Completed</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{profileData.stats.completedTopics}</p>
                            <p className="text-xs text-slate-500">learning milestones</p>
                          </div>
                          
                          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="flex items-center gap-2 mb-2">
                              <Trophy className="w-4 h-4 text-purple-400" />
                              <span className="text-slate-300 text-sm">Achievements</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{profileData.stats.achievements}</p>
                            <p className="text-xs text-slate-500">earned rewards</p>
                          </div>
                          
                          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="flex items-center gap-2 mb-2">
                              <BookOpen className="w-4 h-4 text-blue-400" />
                              <span className="text-slate-300 text-sm">Interactions</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{profileData.stats.totalInteractions}</p>
                            <p className="text-xs text-slate-500">total conversations</p>
                          </div>
                        </div>

                        {/* Membership Info */}
                        <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                              <Star className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm">Member since</p>
                              <p className="text-blue-300 text-sm">{formatDate(profileData.stats.joinedDate)}</p>
                            </div>
                          </div>
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
                    onClick={() => onOpenChange(false)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    {isDirty && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => reset()}
                        className="text-slate-400 hover:text-white hover:bg-slate-800"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                      </Button>
                    )}
                    
                    <Button
                      type="submit"
                      disabled={!isDirty || isSubmitting}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
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