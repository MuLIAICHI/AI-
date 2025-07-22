CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"subject" varchar(20) NOT NULL,
	"assessment_type" varchar(50) NOT NULL,
	"score" integer,
	"skill_level" varchar(20),
	"results" json,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"agent_type" varchar(50),
	"has_audio" boolean DEFAULT false,
	"audio_url" text,
	"audio_data" text,
	"voice_duration" real,
	"voice_language" varchar(10),
	"voice_id" varchar(50),
	"voice_provider" varchar(50),
	"voice_metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"learning_style" varchar(50),
	"difficulty_preference" varchar(20),
	"email_notifications" boolean DEFAULT true,
	"push_notifications" boolean DEFAULT true,
	"weekly_progress" boolean DEFAULT true,
	"session_reminders" boolean DEFAULT false,
	"theme" varchar(20) DEFAULT 'dark',
	"language" varchar(10) DEFAULT 'en',
	"daily_goal_minutes" integer DEFAULT 30,
	"voice_enabled" boolean DEFAULT false,
	"voice_language" varchar(10) DEFAULT 'en',
	"voice_speed" real DEFAULT 1,
	"voice_provider" varchar(50) DEFAULT 'openai',
	"preferred_voice" varchar(50) DEFAULT 'alloy',
	"voice_autoplay" boolean DEFAULT true,
	"voice_input_enabled" boolean DEFAULT true,
	"voice_output_enabled" boolean DEFAULT true,
	"voice_interruptions_enabled" boolean DEFAULT true,
	"voice_visualization_enabled" boolean DEFAULT true,
	"voice_quality" varchar(20) DEFAULT 'standard',
	"voice_latency_mode" varchar(20) DEFAULT 'balanced',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"subject" varchar(20) NOT NULL,
	"skill_level" varchar(20) NOT NULL,
	"progress_data" json,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"clerk_id" varchar(255) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"image_url" varchar(500),
	"preferred_subject" varchar(50),
	"skill_level" varchar(20),
	"onboarding_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_system_preset" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"created_by" varchar(255),
	"voice_provider" varchar(50) NOT NULL,
	"voice_id" varchar(50) NOT NULL,
	"voice_speed" real DEFAULT 1,
	"voice_quality" varchar(20) DEFAULT 'standard',
	"autoplay" boolean DEFAULT true,
	"interruptions_enabled" boolean DEFAULT true,
	"latency_mode" varchar(20) DEFAULT 'balanced',
	"agent_overrides" json,
	"usage_count" integer DEFAULT 0,
	"last_used" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"conversation_id" uuid NOT NULL,
	"session_type" varchar(20) NOT NULL,
	"voice_provider" varchar(50) NOT NULL,
	"voice_language" varchar(10) NOT NULL,
	"voice_id" varchar(50),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"total_duration" real,
	"messages_count" integer DEFAULT 0,
	"user_speech_duration" real DEFAULT 0,
	"agent_speech_duration" real DEFAULT 0,
	"interruptions_count" integer DEFAULT 0,
	"average_latency" real,
	"error_count" integer DEFAULT 0,
	"success_rate" real,
	"session_data" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_user_id_users_clerk_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("clerk_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_clerk_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("clerk_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_clerk_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("clerk_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_clerk_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("clerk_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_presets" ADD CONSTRAINT "voice_presets_created_by_users_clerk_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("clerk_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_user_id_users_clerk_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("clerk_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;