// src/app/api/voice/transcribe/route.ts
// Speech-to-text API route - converts audio to text using OpenAI Whisper

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// ==========================================
// TYPES & INTERFACES
// ==========================================

interface TranscribeRequest {
  audio: string; // Base64 encoded audio data
  language?: string;
  model?: 'whisper-1';
  prompt?: string;
  temperature?: number;
}

interface TranscribeResponse {
  success: boolean;
  transcript?: string;
  confidence?: number;
  language?: string;
  duration?: number;
  processingTime?: number;
  error?: string;
}

// ==========================================
// CONFIGURATION & VALIDATION
// ==========================================

/**
 * Server-side OpenAI configuration
 */
function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  
  return {
    apiKey,
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    timeout: parseInt(process.env.VOICE_TIMEOUT || '30000'),
  };
}

/**
 * Validate transcription request
 */
function validateRequest(body: any): { isValid: boolean; error?: string; data?: TranscribeRequest } {
  // Check required fields
  if (!body.audio || typeof body.audio !== 'string') {
    return { isValid: false, error: 'Audio data is required and must be a string' };
  }

  // Validate base64 audio data
  if (!body.audio.startsWith('data:audio/') && !body.audio.startsWith('data:application/octet-stream')) {
    return { isValid: false, error: 'Invalid audio data format' };
  }

  // Check audio size (limit to 25MB as per OpenAI)
  const audioData = body.audio.split(',')[1] || body.audio;
  const audioSize = (audioData.length * 3) / 4; // Approximate size in bytes
  if (audioSize > 25 * 1024 * 1024) {
    return { isValid: false, error: 'Audio file too large (max 25MB)' };
  }

  // Validate optional parameters
  if (body.language && typeof body.language !== 'string') {
    return { isValid: false, error: 'Language must be a string' };
  }

  if (body.temperature && (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 1)) {
    return { isValid: false, error: 'Temperature must be a number between 0 and 1' };
  }

  return {
    isValid: true,
    data: {
      audio: body.audio,
      language: body.language || 'en',
      model: body.model || 'whisper-1',
      prompt: body.prompt,
      temperature: body.temperature || 0,
    },
  };
}

/**
 * Rate limiting check for transcription
 */
const transcribeRateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkTranscribeRateLimit(userId: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 10; // 10 transcription requests per minute per user

  const userLimit = transcribeRateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize rate limit
    transcribeRateLimitMap.set(userId, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (userLimit.count >= maxRequests) {
    return { allowed: false, resetTime: userLimit.resetTime };
  }

  // Increment count
  transcribeRateLimitMap.set(userId, { ...userLimit, count: userLimit.count + 1 });
  return { allowed: true };
}

// ==========================================
// OPENAI WHISPER INTEGRATION
// ==========================================

/**
 * Convert base64 audio to blob for OpenAI API
 */
function base64ToBlob(base64Data: string, mimeType: string): Blob {
  // Remove data URL prefix if present
  const base64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  
  // Convert base64 to binary
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return new Blob([bytes], { type: mimeType });
}

/**
 * Call OpenAI Whisper API for transcription
 */
async function callOpenAIWhisper(request: TranscribeRequest): Promise<any> {
  const openAIConfig = getOpenAIConfig();
  
  console.log('🎙️ Calling OpenAI Whisper API:', {
    model: request.model,
    language: request.language,
    audioSize: request.audio.length,
  });

  // Convert base64 to blob
  const mimeType = request.audio.startsWith('data:audio/wav') ? 'audio/wav' :
                   request.audio.startsWith('data:audio/mp3') ? 'audio/mp3' :
                   request.audio.startsWith('data:audio/webm') ? 'audio/webm' :
                   request.audio.startsWith('data:audio/ogg') ? 'audio/ogg' :
                   'audio/wav'; // Default fallback

  const audioBlob = base64ToBlob(request.audio, mimeType);

  // Create form data
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model', request.model || 'whisper-1');
  
  if (request.language && request.language !== 'auto') {
    formData.append('language', request.language);
  }
  
  if (request.prompt) {
    formData.append('prompt', request.prompt);
  }
  
  if (request.temperature !== undefined) {
    formData.append('temperature', request.temperature.toString());
  }

  // Call OpenAI API
  const response = await fetch(`${openAIConfig.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIConfig.apiKey}`,
    },
    body: formData,
    signal: AbortSignal.timeout(openAIConfig.timeout),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ OpenAI Whisper API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    });
    
    // Handle specific error cases
    if (response.status === 401) {
      throw new Error('Invalid OpenAI API key');
    } else if (response.status === 429) {
      throw new Error('OpenAI API rate limit exceeded');
    } else if (response.status >= 500) {
      throw new Error('OpenAI API server error');
    } else {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
  }

  const result = await response.json();
  console.log('✅ OpenAI Whisper API success:', {
    transcriptLength: result.text?.length || 0,
  });

  return result;
}

/**
 * Estimate confidence score (Whisper doesn't provide this directly)
 */
function estimateConfidence(transcript: string): number {
  // Simple heuristic based on transcript characteristics
  if (!transcript || transcript.trim().length === 0) return 0;
  
  let confidence = 0.8; // Base confidence
  
  // Reduce confidence for very short transcripts
  if (transcript.length < 10) confidence -= 0.2;
  
  // Reduce confidence if contains many '[unintelligible]' or similar
  const uncertaintyMarkers = ['[unintelligible]', '[inaudible]', '...', '[?]'];
  const uncertaintyCount = uncertaintyMarkers.reduce((count, marker) => 
    count + (transcript.toLowerCase().includes(marker.toLowerCase()) ? 1 : 0), 0
  );
  confidence -= uncertaintyCount * 0.1;
  
  // Boost confidence for proper sentence structure
  if (transcript.includes('.') || transcript.includes('!') || transcript.includes('?')) {
    confidence += 0.1;
  }
  
  return Math.max(0.1, Math.min(1.0, confidence));
}

// ==========================================
// API ROUTE HANDLERS
// ==========================================

/**
 * POST /api/voice/transcribe
 * Transcribe audio to text using OpenAI Whisper
 */
export async function POST(request: NextRequest): Promise<NextResponse<TranscribeResponse>> {
  const startTime = Date.now();

  try {
    // 1. Authentication check
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      console.warn('🚫 Unauthorized transcription request');
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('❌ Invalid JSON in transcription request:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validation = validateRequest(body);
    if (!validation.isValid) {
      console.warn('⚠️ Invalid transcription request:', validation.error);
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const transcribeRequest = validation.data!;

    // 3. Rate limiting check
    const rateLimit = checkTranscribeRateLimit(clerkUserId);
    if (!rateLimit.allowed) {
      console.warn('🚫 Transcription rate limit exceeded for user:', clerkUserId);
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Reset': rateLimit.resetTime?.toString() || '',
            'Retry-After': '60',
          },
        }
      );
    }

    console.log('🎙️ Processing transcription request:', {
      userId: clerkUserId,
      language: transcribeRequest.language,
      model: transcribeRequest.model,
      audioSize: transcribeRequest.audio.length,
    });

    // 4. Call OpenAI Whisper API
    const whisperResult = await callOpenAIWhisper(transcribeRequest);
    
    const processingTime = Date.now() - startTime;
    
    // 5. Process and return result
    if (whisperResult.text) {
      const transcript = whisperResult.text.trim();
      const confidence = estimateConfidence(transcript);
      
      console.log('✅ Transcription successful:', {
        userId: clerkUserId,
        transcriptLength: transcript.length,
        confidence,
        processingTime,
      });

      return NextResponse.json({
        success: true,
        transcript,
        confidence,
        language: transcribeRequest.language,
        processingTime,
      });
    } else {
      console.warn('⚠️ No transcript returned from Whisper API');
      return NextResponse.json(
        { success: false, error: 'No speech detected in audio' },
        { status: 400 }
      );
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Transcription error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Invalid OpenAI API key')) {
        return NextResponse.json(
          { success: false, error: 'Voice transcription service temporarily unavailable. Please contact support.' },
          { status: 500 }
        );
      } else if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { success: false, error: 'Service busy. Please try again in a moment.' },
          { status: 429 }
        );
      } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return NextResponse.json(
          { success: false, error: 'Transcription timed out. Please try with a shorter audio clip.' },
          { status: 408 }
        );
      }
    }

    // Generic error response
    return NextResponse.json(
      { 
        success: false, 
        error: 'Voice transcription failed. Please try again.',
        processingTime,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/voice/transcribe
 * Return API information
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: 'Smartlyte Voice Transcription API',
    version: '1.0.0',
    description: 'Speech-to-text transcription using OpenAI Whisper',
    endpoints: {
      POST: {
        description: 'Transcribe audio to text',
        parameters: {
          audio: 'string (required) - Base64 encoded audio data',
          language: 'string (optional) - Language code (e.g., "en", "es")',
          model: 'string (optional) - Whisper model (default: "whisper-1")',
          prompt: 'string (optional) - Context prompt for better transcription',
          temperature: 'number (optional) - Sampling temperature (0-1)',
        },
        rateLimit: '10 requests per minute per user',
        maxFileSize: '25MB',
      },
    },
    supportedFormats: ['wav', 'mp3', 'webm', 'ogg'],
    supportedLanguages: [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
      // Add more languages as needed
    ],
  });
}

// ==========================================
// EXPORT TYPES FOR CLIENT USE
// ==========================================

export type { TranscribeRequest, TranscribeResponse };