// src/app/api/voice/synthesize/route.ts
// Secure server-side TTS API route - handles OpenAI API calls safely

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { OpenAITTSConfig } from '@/lib/voice/voice-types';

// ==========================================
// TYPES & INTERFACES
// ==========================================

interface SynthesizeRequest {
  text: string;
  config: OpenAITTSConfig;
  userId: string;
}

interface SynthesizeResponse {
  success: boolean;
  audioUrl?: string;
  metadata?: {
    duration: number;
    format: string;
    bitrate?: number;
    fileSize?: number;
    processingTime: number;
  };
  error?: string;
}

type OpenAITTSResponse = Response;

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
 * Validate TTS request
 */
function validateRequest(body: any): { isValid: boolean; error?: string; data?: SynthesizeRequest } {
  // Check required fields
  if (!body.text || typeof body.text !== 'string') {
    return { isValid: false, error: 'Text is required and must be a string' };
  }

  if (!body.config || typeof body.config !== 'object') {
    return { isValid: false, error: 'Config is required and must be an object' };
  }

  if (!body.userId || typeof body.userId !== 'string') {
    return { isValid: false, error: 'User ID is required' };
  }

  // Validate text length
  if (body.text.length > 4000) {
    return { isValid: false, error: 'Text too long (max 4000 characters)' };
  }

  if (body.text.trim().length === 0) {
    return { isValid: false, error: 'Text cannot be empty' };
  }

  // Validate TTS config
  const config = body.config as OpenAITTSConfig;
  
  if (!config.model || !['tts-1', 'tts-1-hd'].includes(config.model)) {
    return { isValid: false, error: 'Invalid TTS model' };
  }

  if (!config.voice || !['alloy', 'nova', 'shimmer', 'echo', 'fable', 'onyx'].includes(config.voice)) {
    return { isValid: false, error: 'Invalid voice ID' };
  }

  if (config.speed && (config.speed < 0.25 || config.speed > 4.0)) {
    return { isValid: false, error: 'Speed must be between 0.25 and 4.0' };
  }

  return {
    isValid: true,
    data: {
      text: body.text.trim(),
      config,
      userId: body.userId,
    },
  };
}

/**
 * Rate limiting check (basic implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 20; // 20 requests per minute per user

  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize rate limit
    rateLimitMap.set(userId, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (userLimit.count >= maxRequests) {
    return { allowed: false, resetTime: userLimit.resetTime };
  }

  // Increment count
  rateLimitMap.set(userId, { ...userLimit, count: userLimit.count + 1 });
  return { allowed: true };
}

// ==========================================
// OPENAI TTS API INTEGRATION
// ==========================================

/**
 * Call OpenAI TTS API
 */
async function callOpenAITTS(text: string, config: OpenAITTSConfig): Promise<ArrayBuffer> {
  const openAIConfig = getOpenAIConfig();
  
  console.log('📡 Calling OpenAI TTS API:', {
    model: config.model,
    voice: config.voice,
    speed: config.speed,
    textLength: text.length,
  });

  const response = await fetch(`${openAIConfig.baseUrl}/audio/speech`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      input: text,
      voice: config.voice,
      speed: config.speed || 1.0,
      response_format: config.responseFormat || 'mp3',
    }),
    // Add timeout
    signal: AbortSignal.timeout(openAIConfig.timeout),
  }) as OpenAITTSResponse;

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ OpenAI TTS API error:', {
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

  // Get audio data as ArrayBuffer
  const audioBuffer = await response.arrayBuffer();
  console.log('✅ OpenAI TTS API success:', {
    audioSize: audioBuffer.byteLength,
    format: config.responseFormat || 'mp3',
  });

  return audioBuffer;
}

/**
 * Convert ArrayBuffer to Base64 data URL
 */
function arrayBufferToDataUrl(buffer: ArrayBuffer, format: string = 'mp3'): string {
  const bytes = new Uint8Array(buffer);
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  const base64 = btoa(binary);
  
  const mimeType = format === 'mp3' ? 'audio/mpeg' : 
                   format === 'wav' ? 'audio/wav' :
                   format === 'ogg' ? 'audio/ogg' : 'audio/mpeg';
  
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Estimate audio duration (rough approximation)
 */
function estimateAudioDuration(text: string, speed: number = 1.0): number {
  // Rough estimate: ~150 words per minute at normal speed
  const words = text.split(/\s+/).length;
  const baseWpm = 150;
  const adjustedWpm = baseWpm * speed;
  const durationMinutes = words / adjustedWpm;
  return Math.max(0.1, durationMinutes * 60); // At least 0.1 seconds
}

// ==========================================
// API ROUTE HANDLERS
// ==========================================

/**
 * POST /api/voice/synthesize
 * Synthesize text to speech using OpenAI TTS API
 */
export async function POST(request: NextRequest): Promise<NextResponse<SynthesizeResponse>> {
  const startTime = Date.now();

  try {
    // 1. Authentication check
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      console.warn('🚫 Unauthorized TTS request');
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
      console.error('❌ Invalid JSON in TTS request:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validation = validateRequest(body);
    if (!validation.isValid) {
      console.warn('⚠️ Invalid TTS request:', validation.error);
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { text, config, userId } = validation.data!;

    // 3. Verify user ID matches authenticated user
    if (userId !== clerkUserId) {
      console.warn('🚫 User ID mismatch in TTS request:', { provided: userId, authenticated: clerkUserId });
      return NextResponse.json(
        { success: false, error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // 4. Rate limiting check
    const rateLimit = checkRateLimit(clerkUserId);
    if (!rateLimit.allowed) {
      console.warn('🚫 Rate limit exceeded for user:', clerkUserId);
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

    console.log('🎤 Processing TTS request:', {
      userId: clerkUserId,
      textLength: text.length,
      voice: config.voice,
      model: config.model,
      speed: config.speed,
    });

    // 5. Call OpenAI TTS API
    const audioBuffer = await callOpenAITTS(text, config);
    
    // 6. Convert to data URL for client consumption
    const audioUrl = arrayBufferToDataUrl(audioBuffer, config.responseFormat || 'mp3');
    
    // 7. Prepare response metadata
    const processingTime = Date.now() - startTime;
    const estimatedDuration = estimateAudioDuration(text, config.speed || 1.0);
    
    const metadata = {
      duration: estimatedDuration,
      format: config.responseFormat || 'mp3',
      bitrate: config.model === 'tts-1-hd' ? 128 : 64, // Rough estimate
      fileSize: audioBuffer.byteLength,
      processingTime,
    };

    console.log('✅ TTS synthesis completed:', {
      userId: clerkUserId,
      processingTime,
      audioSize: audioBuffer.byteLength,
      estimatedDuration,
    });

    // 8. Return success response
    return NextResponse.json({
      success: true,
      audioUrl,
      metadata,
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ TTS synthesis failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Determine appropriate error response
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { success: false, error: 'API rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      } else if (error.message.includes('API key')) {
        return NextResponse.json(
          { success: false, error: 'Voice service configuration error. Please contact support.' },
          { status: 500 }
        );
      } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return NextResponse.json(
          { success: false, error: 'Request timed out. Please try again with a shorter message.' },
          { status: 408 }
        );
      }
    }

    // Generic error response
    return NextResponse.json(
      { 
        success: false, 
        error: 'Voice synthesis failed. Please try again later.' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/voice/synthesize
 * Return API information (optional)
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: 'Smartlyte Voice Synthesis API',
    version: '1.0.0',
    description: 'Text-to-speech synthesis using OpenAI TTS',
    endpoints: {
      POST: {
        description: 'Synthesize text to speech',
        parameters: {
          text: 'string (required) - Text to synthesize',
          config: 'object (required) - TTS configuration',
          userId: 'string (required) - User ID',
        },
      },
    },
  });
}

// ==========================================
// EXPORT TYPES FOR CLIENT USE
// ==========================================

export type { SynthesizeRequest, SynthesizeResponse };