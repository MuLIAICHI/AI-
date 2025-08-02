// src/lib/db/schema.ts
import { pgTable, varchar, text, timestamp, boolean, uuid, json, integer, real, PgColumn } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==========================================
// USERS TABLE
// ==========================================
export const users = pgTable('users', {
  // Primary key: Clerk user ID
  clerkId: varchar('clerk_id', { length: 255 }).primaryKey(),
  
  // Basic user info (synced from Clerk)
  email: varchar('email', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  imageUrl: varchar('image_url', { length: 500 }),
  
  // Learning preferences
  preferredSubject: varchar('preferred_subject', { length: 50 }).$type<'digital' | 'finance' | 'health'>(),
  skillLevel: varchar('skill_level', { length: 20 }).$type<'beginner' | 'intermediate' | 'advanced'>(),
  
  // Onboarding status
  onboardingCompleted: boolean('onboarding_completed').default(false),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==========================================
// CONVERSATIONS TABLE
// ==========================================
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Foreign key to users
  userId: varchar('user_id', { length: 255 }).references(() => users.clerkId).notNull(),
  
  // Conversation metadata
  title: varchar('title', { length: 255 }).notNull(),
  summary: text('summary'), // Brief summary of the conversation
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==========================================
// MESSAGES TABLE (ENHANCED WITH VOICE)
// ==========================================
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Foreign key to conversations
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  
  // Message content
  role: varchar('role', { length: 20 }).$type<'user' | 'assistant' | 'system'>().notNull(),
  content: text('content').notNull(),
  
  // AI agent information
  agentType: varchar('agent_type', { length: 50 }).$type<'router' | 'digital_mentor' | 'finance_guide' | 'health_coach'>(),
  
  // 🎤 VOICE METADATA (NEW)
  hasAudio: boolean('has_audio').default(false),
  audioUrl: text('audio_url'), // URL to stored audio file (S3, etc.)
  audioData: text('audio_data'), // Base64 encoded audio (for small clips)
  voiceDuration: real('voice_duration'), // Duration in seconds
  voiceLanguage: varchar('voice_language', { length: 10 }), // Language of the audio
  voiceId: varchar('voice_id', { length: 50 }), // Which voice was used (alloy, nova, etc.)
  voiceProvider: varchar('voice_provider', { length: 50 }), // openai, elevenlabs, etc.
  voiceMetadata: json('voice_metadata').$type<{
    bitrate?: number;
    format?: string; // mp3, wav, ogg
    originalText?: string; // Original text before TTS
    processingTime?: number; // Time to generate audio
    fileSize?: number; // Audio file size in bytes
    isRealtime?: boolean; // Was this real-time voice or TTS?
    interruptedAt?: number; // If interrupted, at what timestamp
  }>(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==========================================
// USER PROGRESS TABLE
// ==========================================
export const userProgress = pgTable('user_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Foreign key to users
  userId: varchar('user_id', { length: 255 }).references(() => users.clerkId).notNull(),
  
  // Progress tracking
  subject: varchar('subject', { length: 20 }).$type<'digital' | 'finance' | 'health'>().notNull(),
  skillLevel: varchar('skill_level', { length: 20 }).$type<'beginner' | 'intermediate' | 'advanced'>().notNull(),
  
  // Progress data (JSON for flexibility)
  progressData: json('progress_data').$type<{
    completedTopics: string[];
    totalInteractions: number;
    lastActive: string;
    achievements: string[];
    currentStreak: number;
  }>(),
  
  // Timestamps
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==========================================
// USER PREFERENCES TABLE (ENHANCED WITH VOICE)
// ==========================================
export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Foreign key to users (one-to-one)
  userId: varchar('user_id', { length: 255 }).references(() => users.clerkId).notNull().unique(),
  
  // Learning preferences
  learningStyle: varchar('learning_style', { length: 50 }).$type<'visual' | 'auditory' | 'kinesthetic' | 'reading'>(),
  difficultyPreference: varchar('difficulty_preference', { length: 20 }).$type<'easy' | 'moderate' | 'challenging'>(),
  
  // Notification preferences
  emailNotifications: boolean('email_notifications').default(true),
  pushNotifications: boolean('push_notifications').default(true),
  weeklyProgress: boolean('weekly_progress').default(true),
  sessionReminders: boolean('session_reminders').default(false),
  
  // UI preferences
  theme: varchar('theme', { length: 20 }).$type<'dark' | 'light' | 'auto'>().default('dark'),
  language: varchar('language', { length: 10 }).default('en'),
  
  // Session preferences
  dailyGoalMinutes: integer('daily_goal_minutes').default(30),
  
  // 🎤 VOICE PREFERENCES (NEW)
  voiceEnabled: boolean('voice_enabled').default(true),
  voiceLanguage: varchar('voice_language', { length: 10 }).default('en'), // en, es, fr, de, etc.
  voiceSpeed: real('voice_speed').default(1.0), // 0.5 to 2.0 playback speed
  voiceProvider: varchar('voice_provider', { length: 50 }).default('openai'), // openai, elevenlabs, etc.
  preferredVoice: varchar('preferred_voice', { length: 50 }).default('alloy'), // alloy, nova, shimmer, etc.
  voiceAutoplay: boolean('voice_autoplay').default(true), // Auto-play agent responses
  voiceInputEnabled: boolean('voice_input_enabled').default(true), // Enable voice input (STT)
  voiceOutputEnabled: boolean('voice_output_enabled').default(true), // Enable voice output (TTS)
  voiceInterruptionsEnabled: boolean('voice_interruptions_enabled').default(true), // Allow interruptions
  voiceVisualizationEnabled: boolean('voice_visualization_enabled').default(true), // Show audio waveforms
  
  // Voice Quality & Performance
  voiceQuality: varchar('voice_quality', { length: 20 }).$type<'standard' | 'hd'>().default('standard'),
  voiceLatencyMode: varchar('voice_latency_mode', { length: 20 }).$type<'low' | 'balanced' | 'quality'>().default('balanced'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==========================================
// ASSESSMENTS TABLE
// ==========================================
export const assessments = pgTable('assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Foreign key to users
  userId: varchar('user_id', { length: 255 }).references(() => users.clerkId).notNull(),
  
  // Assessment info
  subject: varchar('subject', { length: 20 }).$type<'digital' | 'finance' | 'health'>().notNull(),
  assessmentType: varchar('assessment_type', { length: 50 }).notNull(), // 'initial', 'progress', 'final'
  
  // Assessment results
  score: integer('score'), // 0-100
  skillLevel: varchar('skill_level', { length: 20 }).$type<'beginner' | 'intermediate' | 'advanced'>(),
  
  // Detailed results (JSON)
  results: json('results').$type<{
    answers: Record<string, string>;
    strengths: string[];
    improvements: string[];
    recommendations: string[];
  }>(),
  
  // Timestamps
  completedAt: timestamp('completed_at').defaultNow().notNull(),
});

// ==========================================
// VOICE SESSIONS TABLE (NEW)
// ==========================================
export const voiceSessions = pgTable('voice_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // User and conversation references
  userId: varchar('user_id', { length: 255 }).references(() => users.clerkId).notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  
  // Session metadata
  sessionType: varchar('session_type', { length: 20 }).$type<'tts_only' | 'stt_only' | 'realtime' | 'mixed'>().notNull(),
  voiceProvider: varchar('voice_provider', { length: 50 }).notNull(), // openai, elevenlabs
  voiceLanguage: varchar('voice_language', { length: 10 }).notNull(),
  voiceId: varchar('voice_id', { length: 50 }), // alloy, nova, etc.
  
  // Timing
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  totalDuration: real('total_duration'), // Total session duration in seconds
  
  // Usage statistics
  messagesCount: integer('messages_count').default(0),
  userSpeechDuration: real('user_speech_duration').default(0), // User speaking time
  agentSpeechDuration: real('agent_speech_duration').default(0), // Agent speaking time
  interruptionsCount: integer('interruptions_count').default(0), // How many interruptions
  
  // Quality metrics
  averageLatency: real('average_latency'), // Average response time
  errorCount: integer('error_count').default(0),
  successRate: real('success_rate'), // Percentage of successful voice interactions
  
  // Session data (JSON for flexibility)
  sessionData: json('session_data').$type<{
    userAgent?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
    networkType?: string;
    microphonePermission?: boolean;
    audioQuality?: 'low' | 'medium' | 'high';
    backgroundNoise?: 'low' | 'medium' | 'high';
    errors?: Array<{
      timestamp: string;
      error: string;
      context?: string;
    }>;
    agentTransitions?: Array<{
      from: string;
      to: string;
      timestamp: string;
      reason?: string;
    }>;
  }>(),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==========================================
// VOICE PRESETS TABLE (NEW)
// ==========================================
export const voicePresets = pgTable('voice_presets', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Preset metadata
  name: varchar('name', { length: 100 }).notNull(), // "Professional", "Casual", "Learning Mode"
  description: text('description'),
  isSystemPreset: boolean('is_system_preset').default(false), // System vs user-created
  isPublic: boolean('is_public').default(false), // Can other users use this preset
  
  // Creator (null for system presets)
  createdBy: varchar('created_by', { length: 255 }).references(() => users.clerkId),
  
  // Voice configuration
  voiceProvider: varchar('voice_provider', { length: 50 }).notNull(),
  voiceId: varchar('voice_id', { length: 50 }).notNull(),
  voiceSpeed: real('voice_speed').default(1.0),
  voiceQuality: varchar('voice_quality', { length: 20 }).$type<'standard' | 'hd'>().default('standard'),
  
  // Behavior settings
  autoplay: boolean('autoplay').default(true),
  interruptionsEnabled: boolean('interruptions_enabled').default(true),
  latencyMode: varchar('latency_mode', { length: 20 }).$type<'low' | 'balanced' | 'quality'>().default('balanced'),
  
  // Agent-specific overrides (JSON)
  agentOverrides: json('agent_overrides').$type<{
    [agentId: string]: {
      voiceId?: string;
      speed?: number;
      personality?: string;
    };
  }>(),
  
  // Usage statistics
  usageCount: integer('usage_count').default(0),
  lastUsed: timestamp('last_used'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==========================================
// RELATIONS
// ==========================================

// User relations
export const usersRelations = relations(users, ({ many, one }) => ({
  conversations: many(conversations),
  progress: many(userProgress),
  preferences: one(userPreferences),
  assessments: many(assessments),
  voiceSessions: many(voiceSessions), // 🎤 NEW
  voicePresets: many(voicePresets),   // 🎤 NEW
}));

// Conversation relations
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.clerkId],
  }),
  messages: many(messages),
  voiceSessions: many(voiceSessions), // 🎤 NEW
}));

// Message relations
export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

// User progress relations
export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, {
    fields: [userProgress.userId],
    references: [users.clerkId],
  }),
}));

// User preferences relations
export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.clerkId],
  }),
}));

// Assessment relations
export const assessmentsRelations = relations(assessments, ({ one }) => ({
  user: one(users, {
    fields: [assessments.userId],
    references: [users.clerkId],
  }),
}));

// Voice Sessions Relations (NEW)
export const voiceSessionsRelations = relations(voiceSessions, ({ one }) => ({
  user: one(users, {
    fields: [voiceSessions.userId],
    references: [users.clerkId],
  }),
  conversation: one(conversations, {
    fields: [voiceSessions.conversationId],
    references: [conversations.id],
  }),
}));

// Voice Presets Relations (NEW)
export const voicePresetsRelations = relations(voicePresets, ({ one }) => ({
  creator: one(users, {
    fields: [voicePresets.createdBy],
    references: [users.clerkId],
  }),
}));

// ==========================================
// EXPORT TYPES
// ==========================================

// Infer types for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type UserProgress = typeof userProgress.$inferSelect;
export type NewUserProgress = typeof userProgress.$inferInsert;

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;

export type Assessment = typeof assessments.$inferSelect;
export type NewAssessment = typeof assessments.$inferInsert;

// 🎤 NEW VOICE TYPES
export type VoiceSession = typeof voiceSessions.$inferSelect;
export type NewVoiceSession = typeof voiceSessions.$inferInsert;

export type VoicePreset = typeof voicePresets.$inferSelect;
export type NewVoicePreset = typeof voicePresets.$inferInsert;

// Voice-specific utility types
export type VoiceProvider = 'openai' | 'elevenlabs' | 'playai' | 'google' | 'azure';
export type VoiceQuality = 'standard' | 'hd';
export type VoiceLatencyMode = 'low' | 'balanced' | 'quality';
export type VoiceSessionType = 'tts_only' | 'stt_only' | 'realtime' | 'mixed';

// OpenAI Voice IDs
export type OpenAIVoiceId = 'alloy' | 'nova' | 'shimmer' | 'echo' | 'fable' | 'onyx';

// Voice configuration interface
export interface VoiceConfig {
  provider: VoiceProvider;
  voiceId: string;
  language: string;
  speed: number;
  quality: VoiceQuality;
  latencyMode: VoiceLatencyMode;
  autoplay: boolean;
  interruptionsEnabled: boolean;
  visualizationEnabled: boolean;
}

// REMOVED THE PROBLEMATIC eq FUNCTION - We'll import from drizzle-orm directly