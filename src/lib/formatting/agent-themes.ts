// src/lib/formatting/agent-themes.ts
import { 
  Bot, 
  Computer, 
  DollarSign, 
  Heart, 
  Sparkles,
  Zap,
  Shield,
  Target,
  type LucideIcon 
} from 'lucide-react';

// ==========================================
// AGENT THEME TYPES
// ==========================================

export interface AgentTheme {
  // Identity
  id: string;
  name: string;
  displayName: string;
  description: string;
  emoji: string;
  icon: LucideIcon;
  
  // Visual Identity
  colors: {
    primary: string;        // Main brand color
    secondary: string;      // Secondary accent
    light: string;         // Light variant
    dark: string;          // Dark variant
    text: string;          // Text color on primary
    muted: string;         // Muted text
  };
  
  // Gradients
  gradients: {
    primary: string;       // Main gradient
    background: string;    // Background gradient
    border: string;        // Border gradient
    hover: string;         // Hover state gradient
  };
  
  // Message Styling
  message: {
    background: string;    // Message background
    border: string;        // Message border
    shadow: string;        // Message shadow
    hoverShadow: string;   // Hover shadow
    textColor: string;     // Main text color
    metaColor: string;     // Metadata text color
  };
  
  // Avatar Styling
  avatar: {
    background: string;    // Avatar background
    border: string;        // Avatar border
    shadow: string;        // Avatar shadow
    size: {
      default: string;     // Default size classes
      compact: string;     // Compact size classes
    };
  };
  
  // Interactive Elements
  interactions: {
    buttons: {
      primary: string;     // Primary button styling
      secondary: string;   // Secondary button styling
      ghost: string;       // Ghost button styling
    };
    indicators: {
      typing: string;      // Typing indicator
      online: string;      // Online indicator
      processing: string;  // Processing indicator
    };
  };
  
  // Content Type Styling
  content: {
    steps: {
      background: string;  // Step background
      border: string;      // Step border
      number: string;      // Step number styling
      completed: string;   // Completed step styling
    };
    callouts: {
      tip: string;         // Tip callout styling
      warning: string;     // Warning callout styling
      info: string;        // Info callout styling
      success: string;     // Success callout styling
    };
    code: {
      background: string;  // Code background
      border: string;      // Code border
      text: string;        // Code text color
    };
  };
  
  // Personality Traits
  personality: {
    tone: string;          // Communication tone
    approach: string;      // Teaching approach
    expertise: string[];   // Areas of expertise
    strengths: string[];   // Key strengths
  };
}

// ==========================================
// AGENT THEME CONFIGURATIONS
// ==========================================

export const AGENT_THEMES: Record<string, AgentTheme> = {
  'router': {
    id: 'router',
    name: 'Smart Router',
    displayName: 'Intelligent Assistant',
    description: 'I analyze your questions and connect you with the right specialist',
    emoji: '🤖',
    icon: Bot,
    
    colors: {
      primary: '#3B82F6',      // blue-500
      secondary: '#60A5FA',    // blue-400
      light: '#DBEAFE',        // blue-100
      dark: '#1E40AF',         // blue-700
      text: '#FFFFFF',
      muted: '#94A3B8',        // slate-400
    },
    
    gradients: {
      primary: 'from-blue-500 to-blue-600',
      background: 'from-blue-50 to-blue-100 dark:from-blue-950/20 to-blue-900/20',
      border: 'from-blue-200 to-blue-300 dark:from-blue-800 to-blue-700',
      hover: 'from-blue-600 to-blue-700',
    },
    
    message: {
      background: 'bg-blue-50/50 dark:bg-blue-950/20 backdrop-blur-sm',
      border: 'border-blue-200/50 dark:border-blue-800/50',
      shadow: 'shadow-blue-100/50 dark:shadow-blue-900/20',
      hoverShadow: 'hover:shadow-blue-200/60 dark:hover:shadow-blue-800/30',
      textColor: 'text-slate-800 dark:text-slate-200',
      metaColor: 'text-blue-600/70 dark:text-blue-400/70',
    },
    
    avatar: {
      background: 'bg-gradient-to-br from-blue-500 to-blue-600',
      border: 'ring-2 ring-blue-200 dark:ring-blue-800 ring-offset-2 ring-offset-background',
      shadow: 'shadow-lg shadow-blue-500/25',
      size: {
        default: 'w-8 h-8',
        compact: 'w-6 h-6',
      },
    },
    
    interactions: {
      buttons: {
        primary: 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500',
        secondary: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800',
        ghost: 'hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/50 dark:text-blue-400',
      },
      indicators: {
        typing: 'text-blue-500',
        online: 'bg-blue-500',
        processing: 'text-blue-400',
      },
    },
    
    content: {
      steps: {
        background: 'bg-blue-50/80 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-800',
        number: 'bg-blue-500 text-white',
        completed: 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-200',
      },
      callouts: {
        tip: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200',
        warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200',
        info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200',
        success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-200',
      },
      code: {
        background: 'bg-slate-100 dark:bg-slate-800',
        border: 'border-slate-200 dark:border-slate-700',
        text: 'text-slate-800 dark:text-slate-200',
      },
    },
    
    personality: {
      tone: 'Intelligent and analytical',
      approach: 'Understands needs and guides efficiently',
      expertise: ['Intent analysis', 'Smart routing', 'General assistance', 'Multi-specialist coordination'],
      strengths: ['Quick understanding', 'Accurate routing', 'Context awareness', 'Seamless handoffs'],
    },
  },

  'digital-mentor': {
    id: 'digital-mentor',
    name: 'Digital Mentor',
    displayName: 'Technology Learning Guide',
    description: 'Your patient guide to mastering essential digital skills',
    emoji: '🖥️',
    icon: Computer,
    
    colors: {
      primary: '#8B5CF6',      // purple-500
      secondary: '#A78BFA',    // purple-400
      light: '#F3E8FF',        // purple-100
      dark: '#7C3AED',         // purple-600
      text: '#FFFFFF',
      muted: '#94A3B8',        // slate-400
    },
    
    gradients: {
      primary: 'from-purple-500 to-purple-600',
      background: 'from-purple-50 to-purple-100 dark:from-purple-950/20 to-purple-900/20',
      border: 'from-purple-200 to-purple-300 dark:from-purple-800 to-purple-700',
      hover: 'from-purple-600 to-purple-700',
    },
    
    message: {
      background: 'bg-purple-50/50 dark:bg-purple-950/20 backdrop-blur-sm',
      border: 'border-purple-200/50 dark:border-purple-800/50',
      shadow: 'shadow-purple-100/50 dark:shadow-purple-900/20',
      hoverShadow: 'hover:shadow-purple-200/60 dark:hover:shadow-purple-800/30',
      textColor: 'text-slate-800 dark:text-slate-200',
      metaColor: 'text-purple-600/70 dark:text-purple-400/70',
    },
    
    avatar: {
      background: 'bg-gradient-to-br from-purple-500 to-purple-600',
      border: 'ring-2 ring-purple-200 dark:ring-purple-800 ring-offset-2 ring-offset-background',
      shadow: 'shadow-lg shadow-purple-500/25',
      size: {
        default: 'w-8 h-8',
        compact: 'w-6 h-6',
      },
    },
    
    interactions: {
      buttons: {
        primary: 'bg-purple-500 hover:bg-purple-600 text-white border-purple-500',
        secondary: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:hover:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800',
        ghost: 'hover:bg-purple-50 text-purple-600 dark:hover:bg-purple-950/50 dark:text-purple-400',
      },
      indicators: {
        typing: 'text-purple-500',
        online: 'bg-purple-500',
        processing: 'text-purple-400',
      },
    },
    
    content: {
      steps: {
        background: 'bg-purple-50/80 dark:bg-purple-950/30',
        border: 'border-purple-200 dark:border-purple-800',
        number: 'bg-purple-500 text-white',
        completed: 'bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/50 dark:border-purple-700 dark:text-purple-200',
      },
      callouts: {
        tip: 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-200',
        warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200',
        info: 'bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-200',
        success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-200',
      },
      code: {
        background: 'bg-slate-100 dark:bg-slate-800',
        border: 'border-purple-200 dark:border-purple-700',
        text: 'text-slate-800 dark:text-slate-200',
      },
    },
    
    personality: {
      tone: 'Patient and encouraging',
      approach: 'Step-by-step guidance with practical examples',
      expertise: ['Email setup', 'Web browsing', 'Digital security', 'Mobile apps', 'Online safety'],
      strengths: ['Clear explanations', 'Practical demos', 'Safety focus', 'Beginner-friendly'],
    },
  },

  'finance-guide': {
    id: 'finance-guide',
    name: 'Finance Guide',
    displayName: 'Personal Finance Advisor',
    description: 'Your trusted guide for smart money management and financial planning',
    emoji: '💰',
    icon: DollarSign,
    
    colors: {
      primary: '#10B981',      // green-500
      secondary: '#34D399',    // green-400
      light: '#D1FAE5',        // green-100
      dark: '#047857',         // green-700
      text: '#FFFFFF',
      muted: '#94A3B8',        // slate-400
    },
    
    gradients: {
      primary: 'from-green-500 to-green-600',
      background: 'from-green-50 to-green-100 dark:from-green-950/20 to-green-900/20',
      border: 'from-green-200 to-green-300 dark:from-green-800 to-green-700',
      hover: 'from-green-600 to-green-700',
    },
    
    message: {
      background: 'bg-green-50/50 dark:bg-green-950/20 backdrop-blur-sm',
      border: 'border-green-200/50 dark:border-green-800/50',
      shadow: 'shadow-green-100/50 dark:shadow-green-900/20',
      hoverShadow: 'hover:shadow-green-200/60 dark:hover:shadow-green-800/30',
      textColor: 'text-slate-800 dark:text-slate-200',
      metaColor: 'text-green-600/70 dark:text-green-400/70',
    },
    
    avatar: {
      background: 'bg-gradient-to-br from-green-500 to-green-600',
      border: 'ring-2 ring-green-200 dark:ring-green-800 ring-offset-2 ring-offset-background',
      shadow: 'shadow-lg shadow-green-500/25',
      size: {
        default: 'w-8 h-8',
        compact: 'w-6 h-6',
      },
    },
    
    interactions: {
      buttons: {
        primary: 'bg-green-500 hover:bg-green-600 text-white border-green-500',
        secondary: 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:hover:bg-green-900/50 dark:text-green-300 dark:border-green-800',
        ghost: 'hover:bg-green-50 text-green-600 dark:hover:bg-green-950/50 dark:text-green-400',
      },
      indicators: {
        typing: 'text-green-500',
        online: 'bg-green-500',
        processing: 'text-green-400',
      },
    },
    
    content: {
      steps: {
        background: 'bg-green-50/80 dark:bg-green-950/30',
        border: 'border-green-200 dark:border-green-800',
        number: 'bg-green-500 text-white',
        completed: 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/50 dark:border-green-700 dark:text-green-200',
      },
      callouts: {
        tip: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-200',
        warning: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200',
        info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200',
        success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-200',
      },
      code: {
        background: 'bg-slate-100 dark:bg-slate-800',
        border: 'border-green-200 dark:border-green-700',
        text: 'text-slate-800 dark:text-slate-200',
      },
    },
    
    personality: {
      tone: 'Trustworthy and professional',
      approach: 'Practical advice with real-world examples',
      expertise: ['Budgeting', 'Banking', 'Saving strategies', 'Investment basics', 'Financial planning'],
      strengths: ['Clear guidance', 'Risk awareness', 'Practical tools', 'Long-term thinking'],
    },
  },

  'health-coach': {
    id: 'health-coach',
    name: 'Health Coach',
    displayName: 'Wellness & Lifestyle Guide',
    description: 'Your caring companion for healthy living and wellness journey',
    emoji: '🏥',
    icon: Heart,
    
    colors: {
      primary: '#EF4444',      // red-500
      secondary: '#F87171',    // red-400
      light: '#FEE2E2',        // red-100
      dark: '#DC2626',         // red-600
      text: '#FFFFFF',
      muted: '#94A3B8',        // slate-400
    },
    
    gradients: {
      primary: 'from-red-500 to-red-600',
      background: 'from-red-50 to-red-100 dark:from-red-950/20 to-red-900/20',
      border: 'from-red-200 to-red-300 dark:from-red-800 to-red-700',
      hover: 'from-red-600 to-red-700',
    },
    
    message: {
      background: 'bg-red-50/50 dark:bg-red-950/20 backdrop-blur-sm',
      border: 'border-red-200/50 dark:border-red-800/50',
      shadow: 'shadow-red-100/50 dark:shadow-red-900/20',
      hoverShadow: 'hover:shadow-red-200/60 dark:hover:shadow-red-800/30',
      textColor: 'text-slate-800 dark:text-slate-200',
      metaColor: 'text-red-600/70 dark:text-red-400/70',
    },
    
    avatar: {
      background: 'bg-gradient-to-br from-red-500 to-red-600',
      border: 'ring-2 ring-red-200 dark:ring-red-800 ring-offset-2 ring-offset-background',
      shadow: 'shadow-lg shadow-red-500/25',
      size: {
        default: 'w-8 h-8',
        compact: 'w-6 h-6',
      },
    },
    
    interactions: {
      buttons: {
        primary: 'bg-red-500 hover:bg-red-600 text-white border-red-500',
        secondary: 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:hover:bg-red-900/50 dark:text-red-300 dark:border-red-800',
        ghost: 'hover:bg-red-50 text-red-600 dark:hover:bg-red-950/50 dark:text-red-400',
      },
      indicators: {
        typing: 'text-red-500',
        online: 'bg-red-500',
        processing: 'text-red-400',
      },
    },
    
    content: {
      steps: {
        background: 'bg-red-50/80 dark:bg-red-950/30',
        border: 'border-red-200 dark:border-red-800',
        number: 'bg-red-500 text-white',
        completed: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/50 dark:border-red-700 dark:text-red-200',
      },
      callouts: {
        tip: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200',
        warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200',
        info: 'bg-cyan-50 border-cyan-200 text-cyan-800 dark:bg-cyan-950/30 dark:border-cyan-800 dark:text-cyan-200',
        success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-200',
      },
      code: {
        background: 'bg-slate-100 dark:bg-slate-800',
        border: 'border-red-200 dark:border-red-700',
        text: 'text-slate-800 dark:text-slate-200',
      },
    },
    
    personality: {
      tone: 'Caring and motivational',
      approach: 'Gentle guidance with positive reinforcement',
      expertise: ['Nutrition basics', 'Exercise guidance', 'Wellness habits', 'Mental health', 'Preventive care'],
      strengths: ['Empathetic support', 'Motivation', 'Habit building', 'Holistic approach'],
    },
  },
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Get agent theme by agent ID or name
 */
export function getAgentTheme(agentId?: string | null): AgentTheme {
  if (!agentId) return AGENT_THEMES.router;
  
  // Direct ID match
  if (AGENT_THEMES[agentId]) {
    return AGENT_THEMES[agentId];
  }
  
  // Name mapping for backward compatibility
  const nameMapping: Record<string, string> = {
    'Smart Router': 'router',
    'Intelligent Router': 'router',
    'Simple Router': 'router',
    'Digital Mentor': 'digital-mentor',
    'Finance Guide': 'finance-guide', 
    'Health Coach': 'health-coach',
  };
  
  const mappedId = nameMapping[agentId];
  if (mappedId && AGENT_THEMES[mappedId]) {
    return AGENT_THEMES[mappedId];
  }
  
  // Fallback to router
  return AGENT_THEMES.router;
}

/**
 * Get all available agent themes
 */
export function getAllAgentThemes(): AgentTheme[] {
  return Object.values(AGENT_THEMES);
}

/**
 * Get agent theme IDs
 */
export function getAgentThemeIds(): string[] {
  return Object.keys(AGENT_THEMES);
}

/**
 * Check if agent theme exists
 */
export function hasAgentTheme(agentId: string): boolean {
  return agentId in AGENT_THEMES;
}