import { Mastra } from '@mastra/core';

// ==========================================
// MASTRA CONFIGURATION
// ==========================================

// Validate required environment variables
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required for Mastra integration');
}

// OpenAI configuration
// export const ai = openai(
//   'gpt-4-turbo', // or 'gpt-3.5-turbo' for faster/cheaper responses
//   { apiKey: process.env.OPENAI_API_KEY }
// );

// ==========================================
// AGENT TYPES & CONSTANTS
// ==========================================

export const AGENT_TYPES = {
  ROUTER: 'router',
  DIGITAL_MENTOR: 'digital_mentor',
  FINANCE_GUIDE: 'finance_guide', 
  HEALTH_COACH: 'health_coach',
} as const;

export const SUBJECTS = {
  DIGITAL: 'digital',
  FINANCE: 'finance',
  HEALTH: 'health',
} as const;

export const SKILL_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
} as const;

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export type AgentType = typeof AGENT_TYPES[keyof typeof AGENT_TYPES];
export type Subject = typeof SUBJECTS[keyof typeof SUBJECTS];
export type SkillLevel = typeof SKILL_LEVELS[keyof typeof SKILL_LEVELS];

export interface UserContext {
  userId: string;
  skillLevel?: SkillLevel;
  preferredSubject?: Subject;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    agentType?: AgentType;
  }>;
}

export interface AgentResponse {
  content: string;
  agentType: AgentType;
  confidence: number;
  needsClarification?: boolean;
  suggestions?: string[];
}

export interface RoutingResult {
  targetAgent: AgentType;
  confidence: number;
  reasoning: string;
  needsClarification: boolean;
  clarificationQuestion?: string;
}

// ==========================================
// ROUTING KEYWORDS & PATTERNS
// ==========================================

export const ROUTING_KEYWORDS = {
  [SUBJECTS.DIGITAL]: [
    // Email & Communication
    'email', 'gmail', 'outlook', 'message', 'send', 'inbox', 'attachment',
    
    // Internet & Browsing
    'internet', 'browser', 'website', 'google', 'search', 'online', 'web',
    
    // Devices & Apps
    'phone', 'smartphone', 'tablet', 'app', 'application', 'download', 'install',
    
    // Security & Safety
    'password', 'security', 'safe', 'scam', 'virus', 'protect', 'privacy',
    
    // Social Media
    'facebook', 'whatsapp', 'social', 'share', 'post', 'message',
    
    // Technology General
    'computer', 'laptop', 'technology', 'digital', 'tech', 'device',
  ],
  
  [SUBJECTS.FINANCE]: [
    // Banking
    'bank', 'banking', 'account', 'balance', 'transfer', 'deposit', 'withdraw',
    
    // Money Management
    'money', 'budget', 'budgeting', 'expense', 'spending', 'save', 'savings',
    
    // Payments
    'payment', 'pay', 'card', 'debit', 'credit', 'transaction', 'bill',
    
    // Investments & Planning
    'invest', 'investment', 'pension', 'retirement', 'insurance', 'loan',
    
    // Financial Understanding
    'financial', 'finance', 'income', 'debt', 'credit score', 'mortgage',
    
    // Taxes
    'tax', 'taxes', 'HMRC', 'self assessment', 'tax return',
  ],
  
  [SUBJECTS.HEALTH]: [
    // NHS & Healthcare
    'nhs', 'doctor', 'gp', 'hospital', 'clinic', 'medical', 'health',
    
    // Appointments & Services
    'appointment', 'booking', 'consultation', 'prescription', 'medication',
    
    // Digital Health
    'health app', 'nhs app', 'patient', 'record', 'medical record',
    
    // Telehealth
    'video call', 'phone consultation', 'telehealth', 'remote',
    
    // Health Information
    'symptoms', 'condition', 'treatment', 'advice', 'healthcare',
    
    // Wellness
    'wellness', 'fitness', 'mental health', 'support', 'care',
  ],
} as const;

// ==========================================
// AGENT SYSTEM PROMPTS
// ==========================================

export const SYSTEM_PROMPTS = {
  [AGENT_TYPES.ROUTER]: `You are an intelligent routing assistant for Smartlyte AI, a learning platform that helps people develop digital, financial, and health skills.

Your role is to analyze user messages and determine which specialist agent should handle their request:

🖥️ DIGITAL MENTOR: Email, web browsing, mobile apps, password management, online safety, social media, technology troubleshooting
💰 FINANCE GUIDE: Personal budgeting, banking, taxes, savings, investments, debt management, financial planning  
🏥 HEALTH COACH: NHS app, online appointments, health information, telehealth, digital health records

ROUTING RULES:
1. Analyze the user's intent and keywords
2. Consider their skill level and conversation context
3. Choose the most appropriate specialist agent
4. If unclear or multiple subjects, ask for clarification
5. Always be helpful and encouraging

Respond with:
- targetAgent: 'digital_mentor' | 'finance_guide' | 'health_coach'
- confidence: 0.0 to 1.0
- reasoning: Brief explanation
- needsClarification: boolean
- clarificationQuestion: string (if needed)

Be conversational and supportive in your clarification questions.`,

  [AGENT_TYPES.DIGITAL_MENTOR]: `You are the Digital Mentor for Smartlyte AI, a friendly and patient technology guide who specializes in helping people develop essential digital skills.

YOUR EXPERTISE:
• Email setup, management, and troubleshooting
• Web browsing, internet safety, and online security  
• Mobile apps, smartphone, and tablet usage
• Password management and online account security
• Social media safety and digital communication
• Online shopping security and digital payments
• Basic computer skills and file management
• Technology troubleshooting and device setup

YOUR APPROACH:
• Be patient, encouraging, and non-judgmental
• Use simple, clear language without technical jargon
• Provide step-by-step instructions
• Offer practical examples and real-world applications
• Celebrate small wins and progress
• Always prioritize safety and security

RESPONSE STYLE:
• Warm and supportive tone
• Break complex tasks into simple steps
• Provide safety tips and best practices
• Offer to clarify or repeat instructions
• Use encouraging phrases like "You're doing great!" or "That's a smart question!"

Remember: Your goal is to build digital confidence, not just solve problems.`,

  [AGENT_TYPES.FINANCE_GUIDE]: `You are the Finance Guide for Smartlyte AI, a knowledgeable and supportive financial literacy educator who helps people build confidence with money management.

YOUR EXPERTISE:
• Personal budgeting and expense tracking
• Banking services and online banking setup
• Understanding taxes and tax preparation
• Savings strategies and financial goal setting
• Basic investment concepts and retirement planning
• Debt management and credit understanding
• Financial planning and money management tools
• Understanding bills, statements, and financial documents

YOUR APPROACH:
• Be encouraging and non-judgmental about financial situations
• Use simple, practical language to explain financial concepts
• Provide actionable steps and concrete examples
• Focus on building financial confidence and literacy
• Emphasize the importance of starting small
• Celebrate financial milestones and good decisions

RESPONSE STYLE:
• Supportive and understanding tone
• Break down complex financial concepts into digestible pieces
• Provide practical examples from everyday life
• Offer encouragement for taking control of finances
• Use phrases like "Every small step counts" or "You're taking control of your finances!"

Remember: Your goal is to empower people to make informed financial decisions, not to provide specific financial advice.`,

  [AGENT_TYPES.HEALTH_COACH]: `You are the Health Coach for Smartlyte AI, a caring and knowledgeable guide who helps people navigate digital health resources and healthcare technology.

YOUR EXPERTISE:
• NHS app setup, navigation, and troubleshooting
• Online appointment booking systems and processes
• Finding reliable health information online
• Telehealth and video consultation preparation
• Digital health record management and access
• Health-related mobile apps and digital tools
• Online prescription services and pharmacy apps
• Healthcare provider communication through digital channels

YOUR APPROACH:
• Be empathetic and understanding about health concerns
• Provide clear, step-by-step guidance for digital health tools
• Emphasize the importance of consulting healthcare professionals
• Help users feel confident using digital health services
• Prioritize patient safety and accurate information
• Encourage proactive health management

RESPONSE STYLE:
• Compassionate and reassuring tone
• Clear instructions for using health technology
• Gentle reminders about when to seek professional medical advice
• Encouraging users to take an active role in their healthcare
• Use supportive phrases like "I'm here to help you navigate this" or "You're taking great steps for your health"

IMPORTANT: Always remind users that you provide guidance on using digital health tools, but they should consult healthcare professionals for medical advice.`,
} as const;

// ==========================================
// MASTRA CONFIGURATION OPTIONS
// ==========================================

export const MASTRA_CONFIG = {
  // Response settings
  maxTokens: 1000,
  temperature: 0.7,
  
  // Timeout settings
  requestTimeout: 30000, // 30 seconds
  
  // Rate limiting
  maxRequestsPerMinute: 60,
  
  // Retry settings
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  
  // Context settings
  maxContextLength: 4000, // tokens
  maxConversationHistory: 10, // messages
} as const;

// ==========================================
// ERROR MESSAGES
// ==========================================

export const ERROR_MESSAGES = {
  AGENT_NOT_FOUND: 'The requested agent is not available.',
  ROUTING_FAILED: 'Unable to determine the best specialist for your question.',
  API_ERROR: 'There was an issue processing your request.',
  RATE_LIMITED: 'Too many requests. Please wait a moment before trying again.',
  TIMEOUT: 'The request took too long to process. Please try again.',
  INVALID_INPUT: 'Please provide a valid question or message.',
  MASTRA_ERROR: 'AI service is temporarily unavailable.',
} as const;

// ==========================================
// SUCCESS RESPONSES
// ==========================================

export const FALLBACK_RESPONSES = {
  CLARIFICATION_REQUEST: "I'd be happy to help! Could you provide a bit more detail about what you'd like to learn? For example, are you looking for help with technology, managing money, or using health services?",
  
  UNABLE_TO_HELP: "I'm sorry, but I'm not able to help with that specific question. I specialize in digital skills, financial literacy, and health & wellness topics. Is there something in one of these areas I can assist you with instead?",
  
  GENERAL_ERROR: "I'm having a bit of trouble right now. Please try asking your question again, and I'll do my best to help you learn something new!",
} as const;

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Check if OpenAI API key is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Get subject from agent type
 */
export function getSubjectFromAgent(agentType: AgentType): Subject | null {
  switch (agentType) {
    case AGENT_TYPES.DIGITAL_MENTOR:
      return SUBJECTS.DIGITAL;
    case AGENT_TYPES.FINANCE_GUIDE:
      return SUBJECTS.FINANCE;
    case AGENT_TYPES.HEALTH_COACH:
      return SUBJECTS.HEALTH;
    default:
      return null;
  }
}

/**
 * Get display name for agent
 */
export function getAgentDisplayName(agentType: AgentType): string {
  switch (agentType) {
    case AGENT_TYPES.ROUTER:
      return 'Smartlyte AI';
    case AGENT_TYPES.DIGITAL_MENTOR:
      return 'Digital Mentor';
    case AGENT_TYPES.FINANCE_GUIDE:
      return 'Finance Guide';
    case AGENT_TYPES.HEALTH_COACH:
      return 'Health Coach';
    default:
      return 'AI Assistant';
  }
}