// src/mastra/test-setup.ts
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { languageTool } from './tools/language-tool';

// Create a test agent that uses our tool
const testAgent = new Agent({
  name: 'Language Test Agent',
  instructions: 'You help test the language detection tool. When provided with text, use the language detection tool to identify the language.',
  model: openai('gpt-4o-mini'),
  tools: {
    languageDetection: languageTool
  }
});

// Initialize Mastra with our test agent
export const mastra = new Mastra({
  agents: {
    testAgent
  }
});