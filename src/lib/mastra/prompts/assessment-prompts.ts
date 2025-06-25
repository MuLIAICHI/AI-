// src/mastra/prompts/assessment-prompts.ts

/**
 * Specialized prompts for conducting skill assessments
 * These guide the conversation during assessment workflows
 */
export const assessmentPrompts = {
  /**
   * Pre-assessment conversation starters
   */
  welcomeMessages: {
    firstTime: "Welcome to Smartlyte! I'm excited to help you on your learning journey. To get started, I'd like to understand what you're hoping to achieve and what experience you already have. This isn't a test - I just want to make sure we start at the right level for you.",
    
    returning: "Welcome back! It looks like you might be ready to explore a new learning area or retake an assessment. What would you like to focus on today?",
    
    subjectSelection: "I can help you learn about three main areas: Digital Skills (like email and web browsing), Financial Skills (like budgeting and online banking), or Health Resources (like using the NHS app). Which area interests you most right now?"
  },

  /**
   * Question guidance and explanations
   */
  questionGuidance: {
    beforeStarting: "I'm going to ask you about some everyday tasks. For each one, I want to know two things: whether you feel comfortable doing it, and if yes, how confident you feel. Remember, this helps me find the perfect starting point for you!",
    
    explainConfidenceScale: "When I ask about confidence, think of it this way: 1 means 'I can do it but feel nervous,' 3 means 'I'm comfortable with it,' and 5 means 'I could help someone else do it.' Just pick the number that feels right!",
    
    noWrongAnswers: "There are no wrong answers here. Being honest about what you can and can't do means I can recommend exactly the right learning materials for you."
  },

  /**
   * Transition phrases between assessment sections
   */
  transitions: {
    toCapabilityQuestions: "Great! Now let's go through some specific tasks. I'll ask if you feel comfortable doing each one.",
    
    toConfidenceQuestions: "Perfect! Now, for the tasks you said you can do, I'd like to know how confident you feel doing them.",
    
    toResults: "Excellent! Thank you for those answers. Let me put together some personalized recommendations for you based on what you've told me.",
    
    toNextSteps: "Based on your responses, I can see exactly where to focus your learning to get the best results. Here's what I recommend..."
  },

  /**
   * Encouraging responses during assessment
   */
  encouragement: {
    beginnerLevel: "It sounds like you're starting your journey with these skills, which is exciting! Starting with the fundamentals and building confidence step by step is a great approach.",
    
    intermediateLevel: "You have a nice foundation! It looks like you're ready to build on what you know and fill in some gaps. That's a great place to be.",
    
    advancedLevel: "You clearly have strong skills in this area! We can focus on fine-tuning your approach and maybe exploring some advanced techniques.",
    
    mixedLevels: "I can see you're strong in some areas and newer to others. That's very common! We'll build on your strengths while addressing the areas where you'd like more confidence."
  },

  /**
   * Results explanation templates
   */
  resultsExplanation: {
    skillLevelExplanation: "Based on your responses, I'd recommend starting at the {level} level. This means {explanation}. Does this sound like a good fit for where you are right now?",
    
    recommendationIntro: "Here are some learning modules I think would be perfect for you:",
    
    nextStepsIntro: "To get the most from your learning, I suggest these next steps:",
    
    reassessmentReminder: "Remember, you can always retake this assessment as you learn and grow. Your skill level isn't fixed - it's just your starting point!"
  },

  /**
   * Subject-specific assessment context
   */
  subjectContext: {
    digital: {
      importance: "Digital skills help you stay connected with family, access services online, and navigate the modern world with confidence.",
      relevance: "These skills can make everyday tasks easier and help you feel more confident with technology.",
      encouragement: "Everyone learns technology at their own pace, and there's no rush. Let's find the right starting point for you."
    },
    
    finance: {
      importance: "Financial skills help you feel more secure and in control of your money, whether you're budgeting, saving, or planning for the future.",
      relevance: "Understanding these basics can help you make informed decisions and feel more confident about your financial situation.",
      encouragement: "Money management is something everyone can learn, regardless of their starting point. Let's see where you are now."
    },
    
    health: {
      importance: "Digital health skills help you take charge of your healthcare, communicate better with providers, and access services more easily.",
      relevance: "These tools can save you time and help you be more proactive about your health and wellbeing.",
      encouragement: "Learning to navigate health resources online can be empowering. Let's start with what feels most useful to you."
    }
  }
};

export default assessmentPrompts;