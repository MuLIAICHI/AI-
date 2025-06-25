// src/mastra/agents/index.ts

// Export all agents for easy importing
export * from "./router-agent";
export * from "./digital-mentor-agent";
export * from "./finance-guide-agent";
export * from "./health-coach-agent";

// Grouped exports for convenience
export { routerAgent } from "./router-agent";
export { digitalMentorAgent } from "./digital-mentor-agent";
export { financeGuideAgent } from "./finance-guide-agent";
export { healthCoachAgent } from "./health-coach-agent";

// Helper function exports
export { 
  getDigitalMentorGreeting, 
  getDigitalTopicIntro 
} from "./digital-mentor-agent";

export { 
  getFinanceGuideGreeting, 
  getFinanceTopicIntro, 
  getFinancePracticalExample 
} from "./finance-guide-agent";

export { 
  getHealthCoachGreeting, 
  getHealthTopicIntro, 
  getHealthSafetyReminder,
  getHealthEncouragement 
} from "./health-coach-agent";