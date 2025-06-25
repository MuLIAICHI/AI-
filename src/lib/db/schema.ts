import { pgTable, varchar, text, timestamp, boolean, uuid, json, integer, PgColumn } from 'drizzle-orm/pg-core';
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
// MESSAGES TABLE
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
// USER PREFERENCES TABLE
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
  
  // UI preferences
  theme: varchar('theme', { length: 20 }).$type<'dark' | 'light' | 'auto'>().default('dark'),
  language: varchar('language', { length: 10 }).default('en'),
  
  // Session preferences
  sessionReminders: boolean('session_reminders').default(false),
  dailyGoalMinutes: integer('daily_goal_minutes').default(30),
  
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
// RELATIONS
// ==========================================

// User relations
export const usersRelations = relations(users, ({ many, one }) => ({
  conversations: many(conversations),
  progress: many(userProgress),
  preferences: one(userPreferences),
  assessments: many(assessments),
}));

// Conversation relations
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.clerkId],
  }),
  messages: many(messages),
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

export function eq(clerkId: PgColumn<{ name: "clerk_id"; tableName: "users"; dataType: "string"; columnType: "PgVarchar"; data: string; driverParam: string; notNull: true; hasDefault: false; isPrimaryKey: true; isAutoincrement: false; hasRuntimeDefault: false; enumValues: [string, ...string[]]; baseColumn: never; identity: undefined; generated: undefined; }, {}, { length: 255; }>, clerkId1: string): import("drizzle-orm").SQL<unknown> | undefined {
    throw new Error('Function not implemented.');
}
