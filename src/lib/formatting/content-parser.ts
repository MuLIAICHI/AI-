// src/lib/formatting/content-parser.ts

// ==========================================
// CONTENT TYPES & INTERFACES
// ==========================================

export interface ContentBlock {
  id: string;
  type: ContentType;
  content: string;
  originalText: string;
  metadata?: {
    steps?: Array<{number: number; content: string}>;
    items?: string[];
    language?: string;
    level?: number;
    startIndex?: number;
    [key: string]: any;
  };
}

export interface ParsedResponse {
  blocks: ContentBlock[];
  hasAgentHandoff: boolean;
  agentTransition?: {
    fromAgent: string;
    toAgent: string;
    transitionText: string;
  };
  contentTypes: ContentType[];
  processingTime?: number;
}

export type ContentType = 
  | 'text'           // Regular paragraph text
  | 'step-guide'     // Numbered steps (1. 2. 3.)
  | 'bullet-list'    // Bullet points (• - *)
  | 'tip'            // Tips and suggestions
  | 'warning'        // Warnings and cautions
  | 'important'      // Important information
  | 'success'        // Success messages
  | 'code'           // Code blocks
  | 'inline-code'    // Inline code
  | 'quote'          // Quoted text
  | 'agent-handoff'  // Agent transition
  | 'link'           // URLs and links
  | 'email'          // Email addresses
  | 'phone'          // Phone numbers
  | 'heading'        // Headers and titles
  | 'divider';       // Section separators

// ==========================================
// REGEX PATTERNS
// ==========================================

const PATTERNS = {
  // Step patterns (1. 2. 3. or Step 1: Step 2:)
  steps: {
    numbered: /^(\d+)\.\s+(.+)$/gm,
    stepPrefix: /^Step\s+(\d+):\s*(.+)$/gmi,
    numberedParens: /^(\d+)\)\s+(.+)$/gm,
  },
  
  // List patterns
  lists: {
    bullets: /^[•\-\*]\s+(.+)$/gm,
    dashes: /^[\-—]\s+(.+)$/gm,
    arrows: /^[→➤►]\s*(.+)$/gm,
  },
  
  // Callout patterns
  callouts: {
    tip: /^\*?\*?(tip|💡|hint|pro tip|suggestion)s?:?\*?\*?\s*(.+)$/gmi,
    warning: /^\*?\*?(warning|⚠️|caution|important|note|attention)s?:?\*?\*?\s*(.+)$/gmi,
    important: /^\*?\*?(important|❗|key|critical|remember)s?:?\*?\*?\s*(.+)$/gmi,
    success: /^\*?\*?(success|✅|done|completed|great|excellent)s?:?\*?\*?\s*(.+)$/gmi,
  },
  
  // Code patterns
  code: {
    block: /```(\w+)?\n?([\s\S]*?)```/g,
    inline: /`([^`]+)`/g,
  },
  
  // Agent handoff patterns
  agentHandoff: {
    connecting: /connecting you with|i'm connecting you|let me connect you|routing you to/gi,
    introducing: /here's|meet|this is|i'm the|hello.*i'm/gi,
    specialist: /digital mentor|finance guide|health coach|specialist|expert/gi,
  },
  
  // Contact patterns
  contact: {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
  },
  
  // Structure patterns
  structure: {
    heading: /^#{1,6}\s+(.+)$/gm,
    divider: /^[-=_]{3,}$/gm,
    quote: /^>\s+(.+)$/gm,
  },
};

// ==========================================
// PARSING FUNCTIONS
// ==========================================

/**
 * Parse AI response content into structured blocks
 */
export function parseContent(content: string): ParsedResponse {
  const startTime = Date.now();
  const blocks: ContentBlock[] = [];
  const contentTypes: Set<ContentType> = new Set();
  
  let processedContent = content;
  let blockId = 0;
  
  // Helper to generate unique block IDs
  const getBlockId = () => `block-${++blockId}`;
  
  // 1. Check for agent handoffs first
  const agentTransition = detectAgentHandoff(content);
  if (agentTransition) {
    contentTypes.add('agent-handoff');
  }
  
  // 2. Extract code blocks (to avoid processing them as other content)
  const codeBlocks: Array<{id: string, placeholder: string, content: string, language?: string}> = [];
  processedContent = processedContent.replace(PATTERNS.code.block, (match, language, code) => {
    const id = getBlockId();
    const placeholder = `__CODE_BLOCK_${id}__`;
    codeBlocks.push({ id, placeholder, content: code.trim(), language });
    contentTypes.add('code');
    return placeholder;
  });
  
  // 3. Split content into lines for processing
  const lines = processedContent.split('\n');
  let currentTextBlock = '';
  
  const flushTextBlock = () => {
    if (currentTextBlock.trim()) {
      blocks.push({
        id: getBlockId(),
        type: 'text',
        content: currentTextBlock.trim(),
        originalText: currentTextBlock.trim(),
      });
      contentTypes.add('text');
      currentTextBlock = '';
    }
  };
  
  // 4. Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      currentTextBlock += '\n';
      continue;
    }
    
    let processed = false;
    
    // Check for step patterns
    const stepMatch = 
      trimmedLine.match(/^(\d+)\.\s+(.+)$/) ||
      trimmedLine.match(/^Step\s+(\d+):\s*(.+)$/i) ||
      trimmedLine.match(/^(\d+)\)\s+(.+)$/);
    
    if (stepMatch) {
      flushTextBlock();
      
      // Look ahead for more steps
      const stepGroup = extractStepGroup(lines, i);
      blocks.push({
        id: getBlockId(),
        type: 'step-guide',
        content: stepGroup.content,
        originalText: stepGroup.originalText,
        metadata: { steps: stepGroup.steps, startIndex: i },
      });
      contentTypes.add('step-guide');
      i = stepGroup.endIndex;
      processed = true;
    }
    
    // Check for bullet lists
    else if (PATTERNS.lists.bullets.test(trimmedLine) || PATTERNS.lists.dashes.test(trimmedLine)) {
      flushTextBlock();
      
      const listGroup = extractListGroup(lines, i);
      blocks.push({
        id: getBlockId(),
        type: 'bullet-list',
        content: listGroup.content,
        originalText: listGroup.originalText,
        metadata: { items: listGroup.items },
      });
      contentTypes.add('bullet-list');
      i = listGroup.endIndex;
      processed = true;
    }
    
    // Check for callouts
    else {
      const calloutType = detectCalloutType(trimmedLine);
      if (calloutType) {
        flushTextBlock();
        
        const calloutContent = extractCalloutContent(trimmedLine);
        blocks.push({
          id: getBlockId(),
          type: calloutType,
          content: calloutContent,
          originalText: trimmedLine,
        });
        contentTypes.add(calloutType);
        processed = true;
      }
    }
    
    // Check for headings
    if (!processed) {
      const headingMatch = trimmedLine.match(/^#{1,6}\s+(.+)$/);
      if (headingMatch) {
        flushTextBlock();
        blocks.push({
          id: getBlockId(),
          type: 'heading',
          content: headingMatch[1],
          originalText: trimmedLine,
          metadata: { level: trimmedLine.indexOf(' ') },
        });
        contentTypes.add('heading');
        processed = true;
      }
    }
    
    // Add to text block if not processed
    if (!processed) {
      currentTextBlock += line + '\n';
    }
  }
  
  // Flush any remaining text
  flushTextBlock();
  
  // 5. Restore code blocks
  blocks.forEach(block => {
    codeBlocks.forEach(codeBlock => {
      if (block.content.includes(codeBlock.placeholder)) {
        // Replace placeholder with actual code block
        const codeBlockData: ContentBlock = {
          id: getBlockId(),
          type: 'code',
          content: codeBlock.content,
          originalText: `\`\`\`${codeBlock.language || ''}\n${codeBlock.content}\n\`\`\``,
          metadata: { language: codeBlock.language },
        };
        
        // Insert code block in place of placeholder
        const index = blocks.indexOf(block);
        blocks.splice(index + 1, 0, codeBlockData);
        
        // Update original block content
        block.content = block.content.replace(codeBlock.placeholder, '');
      }
    });
  });
  
  // 6. Process inline code and other patterns
  blocks.forEach(block => {
    if (block.type === 'text') {
      block.content = processInlinePatterns(block.content);
    }
  });
  
  const processingTime = Date.now() - startTime;
  
  return {
    blocks: blocks.filter(block => block.content.trim()),
    hasAgentHandoff: !!agentTransition,
    agentTransition,
    contentTypes: Array.from(contentTypes),
    processingTime,
  };
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Detect agent handoff in content
 */
function detectAgentHandoff(content: string): ParsedResponse['agentTransition'] | undefined {
  const lowerContent = content.toLowerCase();
  
  // Look for connecting patterns
  const connectingMatch = lowerContent.match(PATTERNS.agentHandoff.connecting);
  const specialistMatch = lowerContent.match(PATTERNS.agentHandoff.specialist);
  
  if (connectingMatch && specialistMatch) {
    // Try to extract agent names
    const sentences = content.split(/[.!?]\s+/);
    let transitionText = '';
    let fromAgent = 'router';
    let toAgent = '';
    
    // Find transition sentence
    for (const sentence of sentences) {
      if (PATTERNS.agentHandoff.connecting.test(sentence)) {
        transitionText = sentence;
        break;
      }
    }
    
    // Detect target agent
    if (lowerContent.includes('digital mentor')) toAgent = 'digital-mentor';
    else if (lowerContent.includes('finance guide')) toAgent = 'finance-guide';
    else if (lowerContent.includes('health coach')) toAgent = 'health-coach';
    
    if (toAgent) {
      return { fromAgent, toAgent, transitionText };
    }
  }
  
  return undefined;
}

/**
 * Extract a group of consecutive steps
 */
function extractStepGroup(lines: string[], startIndex: number) {
  const steps: Array<{number: number, content: string}> = [];
  let endIndex = startIndex;
  let content = '';
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      endIndex = i;
      continue;
    }
    
    const stepMatch = 
      line.match(/^(\d+)\.\s+(.+)$/) ||
      line.match(/^Step\s+(\d+):\s*(.+)$/i) ||
      line.match(/^(\d+)\)\s+(.+)$/);
    
    if (stepMatch) {
      const stepNumber = parseInt(stepMatch[1]);
      const stepContent = stepMatch[2];
      steps.push({ number: stepNumber, content: stepContent });
      content += line + '\n';
      endIndex = i;
    } else {
      // If we've started collecting steps and hit a non-step, stop
      if (steps.length > 0) {
        break;
      }
    }
  }
  
  return {
    steps,
    content: content.trim(),
    originalText: content.trim(),
    endIndex,
  };
}

/**
 * Extract a group of consecutive list items
 */
function extractListGroup(lines: string[], startIndex: number) {
  const items: string[] = [];
  let endIndex = startIndex;
  let content = '';
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      endIndex = i;
      continue;
    }
    
    const bulletMatch = line.match(/^[•\-\*]\s+(.+)$/);
    if (bulletMatch) {
      items.push(bulletMatch[1]);
      content += line + '\n';
      endIndex = i;
    } else {
      if (items.length > 0) {
        break;
      }
    }
  }
  
  return {
    items,
    content: content.trim(),
    originalText: content.trim(),
    endIndex,
  };
}

/**
 * Detect callout type from line
 */
function detectCalloutType(line: string): ContentType | null {
  if (PATTERNS.callouts.tip.test(line)) return 'tip';
  if (PATTERNS.callouts.warning.test(line)) return 'warning';
  if (PATTERNS.callouts.important.test(line)) return 'important';
  if (PATTERNS.callouts.success.test(line)) return 'success';
  return null;
}

/**
 * Extract callout content (remove the prefix)
 */
function extractCalloutContent(line: string): string {
  // Remove common prefixes
  return line
    .replace(/^\*?\*?(tip|💡|hint|pro tip|suggestion|warning|⚠️|caution|important|note|attention|key|critical|remember|success|✅|done|completed|great|excellent)s?:?\*?\*?\s*/gi, '')
    .trim();
}

/**
 * Process inline patterns like inline code, links, etc.
 */
function processInlinePatterns(content: string): string {
  // This could be extended to handle inline formatting
  // For now, we'll keep it simple
  return content;
}

/**
 * Get content statistics
 */
export function getContentStats(parsed: ParsedResponse) {
  const stats = {
    totalBlocks: parsed.blocks.length,
    contentTypes: parsed.contentTypes.length,
    hasSteps: parsed.contentTypes.includes('step-guide'),
    hasLists: parsed.contentTypes.includes('bullet-list'),
    hasCallouts: parsed.contentTypes.some(type => 
      ['tip', 'warning', 'important', 'success'].includes(type)
    ),
    hasCode: parsed.contentTypes.includes('code'),
    hasAgentHandoff: parsed.hasAgentHandoff,
    processingTime: parsed.processingTime,
  };
  
  return stats;
}

/**
 * Check if content needs enhanced formatting
 */
export function needsEnhancedFormatting(content: string): boolean {
  // Quick check for patterns that benefit from enhanced formatting
  return (
    /^\d+\.\s/.test(content) ||                    // Numbered steps
    /^[•\-\*]\s/.test(content) ||                  // Bullet lists  
    /\*\*?(tip|warning|important)s?:?\*\*?/gi.test(content) || // Callouts
    /```/.test(content) ||                         // Code blocks
    /connecting you with|digital mentor|finance guide|health coach/gi.test(content) // Agent handoffs
  );
}