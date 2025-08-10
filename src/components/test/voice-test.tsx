// src/components/test/voice-test.tsx
// Complete voice test component with detailed debugging

'use client';

import React from 'react';
import { useUser } from '@clerk/nextjs';
import { useMastraVoice } from '@/hooks/use-mastra-voice';
import { useRealtimeSession } from '@/hooks/use-realtime-session';
import { useVoicePreferences } from '@/hooks/use-voice-preferences';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mic, 
  MicOff, 
  Play, 
  Square, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Info
} from 'lucide-react';

export function VoiceTest() {
  const { user, isLoaded } = useUser();
  const { preferences, isVoiceEnabled } = useVoicePreferences();
  
  const {
    state,
    isConnected,
    canSpeak,
    initializeVoice,
    speak,
    checkSupport,
    clearError,
  } = useMastraVoice();

  const {
    sessionState,
    isRealtimeEnabled,
    canStartSession,
    startRealtimeSession,
    endRealtimeSession,
  } = useRealtimeSession();

  // 🔍 COMPREHENSIVE DEBUG INFO
  const debugInfo = {
    // User & Authentication
    userLoaded: isLoaded,
    userAuthenticated: !!user,
    userId: user?.id || 'None',
    
    // Voice Preferences
    voicePreferencesLoaded: !!preferences,
    isVoiceEnabledHook: isVoiceEnabled,
    preferencesVoiceEnabled: preferences?.voiceEnabled,
    preferredVoice: preferences?.preferredVoice || 'None',
    voiceProvider: preferences?.voiceProvider || 'None',
    
    // Mastra Voice State
    voiceStateSupported: state.isSupported,
    voiceStateInitialized: state.isInitialized,
    voiceStateReady: state.isReady,
    voiceConnectionStatus: state.connectionStatus,
    voiceHasPermissions: state.hasPermissions,
    
    // Session State
    sessionNotActive: !sessionState.isActive,
    voiceSessionNotActive: !state.sessionActive,
    
    // Final Conditions
    isRealtimeEnabled: isRealtimeEnabled,
    canStartSession: canStartSession,
  };

  // Calculate overall readiness
  const readinessChecks = [
    { name: 'User Authenticated', passed: !!user },
    { name: 'Voice Preferences Loaded', passed: !!preferences },
    { name: 'Voice Enabled in Preferences', passed: preferences?.voiceEnabled === true },
    { name: 'Browser Support Check', passed: state.isSupported },
    { name: 'Voice Client Initialized', passed: state.isInitialized },
    { name: 'Voice Client Ready', passed: state.isReady },
    { name: 'No Active Session', passed: !sessionState.isActive },
  ];

  const passedChecks = readinessChecks.filter(check => check.passed).length;
  const totalChecks = readinessChecks.length;

  // Environment check
  const envCheck = {
    hasOpenAIKey: typeof process !== 'undefined' && (
      !!process.env.OPENAI_API_KEY || 
      !!process.env.NEXT_PUBLIC_OPENAI_API_KEY
    ),
    httpsOrLocalhost: typeof window !== 'undefined' && (
      window.location.protocol === 'https:' || 
      window.location.hostname === 'localhost'
    ),
    webAudioSupported: typeof window !== 'undefined' && !!(
      window.AudioContext || (window as any).webkitAudioContext
    ),
    mediaDevicesSupported: typeof window !== 'undefined' && !!navigator.mediaDevices,
    webSocketSupported: typeof window !== 'undefined' && !!window.WebSocket,
  };

  const handleTestSupport = async () => {
    try {
      const support = await checkSupport();
      alert(`Support Check Results:\n\nSupported: ${support.supported}\n\nErrors:\n${support.errors.join('\n') || 'None'}`);
    } catch (error) {
      alert(`Support check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleInitialize = async () => {
    try {
      await initializeVoice();
      alert('Voice initialization successful!');
    } catch (error) {
      alert(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleStartSession = async () => {
    try {
      await startRealtimeSession({
        conversationId: `test_${Date.now()}`,
        autoStart: true,
      });
      alert('Real-time session started successfully!');
    } catch (error) {
      alert(`Session start failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleTestSpeech = async () => {
    try {
      await speak("Hello! This is a test of the Mastra real-time voice system. If you can hear this, everything is working correctly.");
      alert('Speech test completed!');
    } catch (error) {
      alert(`Speech test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎤 Real-time Voice Test
            <Badge variant={canStartSession ? 'default' : 'destructive'}>
              {canStartSession ? 'Ready' : 'Not Ready'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Readiness Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Readiness Progress</span>
              <span className="text-sm text-gray-500">{passedChecks}/{totalChecks}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(passedChecks / totalChecks) * 100}%` }}
              />
            </div>
          </div>

          {/* Quick Status */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <span>Supported:</span>
              <Badge variant={state.isSupported ? 'default' : 'destructive'}>
                {state.isSupported ? 'Yes' : 'No'}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <span>Initialized:</span>
              <Badge variant={state.isInitialized ? 'default' : 'secondary'}>
                {state.isInitialized ? 'Yes' : 'No'}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <span>Connected:</span>
              <Badge variant={isConnected ? 'default' : 'secondary'}>
                {state.connectionStatus}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <span>Session:</span>
              <Badge variant={sessionState.isActive ? 'default' : 'secondary'}>
                {sessionState.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>

          {/* Error Display */}
          {state.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {state.error}
                <Button onClick={clearError} size="sm" className="ml-2">
                  Clear
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Test Controls */}
          <div className="space-y-2">
            <Button 
              onClick={handleTestSupport} 
              className="w-full"
              variant="outline"
            >
              <Info className="w-4 h-4 mr-2" />
              1. Check Browser Support
            </Button>
            
            <Button 
              onClick={handleInitialize} 
              disabled={state.isInitialized}
              className="w-full"
            >
              {state.isInitialized ? (
                <CheckCircle className="w-4 h-4 mr-2" />
              ) : (
                <Loader2 className="w-4 h-4 mr-2" />
              )}
              2. {state.isInitialized ? 'Voice Initialized ✅' : 'Initialize Voice'}
            </Button>
            
            <Button 
              onClick={handleStartSession}
              disabled={!canStartSession}
              className="w-full"
            >
              {sessionState.isActive ? (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Session Active ✅
                </>
              ) : (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  3. Start Real-time Session
                </>
              )}
            </Button>
            
            <Button 
              onClick={handleTestSpeech}
              disabled={!canSpeak}
              className="w-full"
            >
              <Play className="w-4 h-4 mr-2" />
              4. Test Speech Output
            </Button>
            
            {sessionState.isActive && (
              <Button 
                onClick={endRealtimeSession}
                variant="outline"
                className="w-full"
              >
                <Square className="w-4 h-4 mr-2" />
                End Session
              </Button>
            )}
          </div>

          {/* Session Info */}
          {sessionState.isActive && (
            <div className="text-sm space-y-1 p-3 bg-green-50 rounded">
              <div className="font-medium text-green-800">Active Session Info:</div>
              <div>Duration: {sessionState.duration}s</div>
              <div>Messages: {sessionState.messageCount}</div>
              <div>User Speech: {sessionState.userSpeechTime}ms</div>
              <div>AI Speech: {sessionState.aiSpeechTime}ms</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Environment Check Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🌐 Environment Check</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {Object.entries(envCheck).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>
                <div className="flex items-center gap-1">
                  {value ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={value ? 'text-green-600' : 'text-red-600'}>
                    {value ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Readiness Checklist Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">✅ Readiness Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {readinessChecks.map((check, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm">{check.name}:</span>
                <div className="flex items-center gap-1">
                  {check.passed ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={check.passed ? 'text-green-600' : 'text-red-600'}>
                    {check.passed ? 'Pass' : 'Fail'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Debug Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🔍 Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs font-mono bg-gray-50 p-3 rounded max-h-64 overflow-y-auto">
            {Object.entries(debugInfo).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-600">{key}:</span>
                <span className={
                  typeof value === 'boolean' 
                    ? value ? 'text-green-600' : 'text-red-600'
                    : 'text-blue-600'
                }>
                  {typeof value === 'boolean' 
                    ? (value ? '✅ true' : '❌ false')
                    : String(value)
                  }
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📋 Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div><strong>Step 1:</strong> Check that all environment checks show "Yes"</div>
            <div><strong>Step 2:</strong> Ensure all readiness checklist items show "Pass"</div>
            <div><strong>Step 3:</strong> Click buttons in order: Support → Initialize → Start Session → Test Speech</div>
            <div><strong>Step 4:</strong> If anything fails, check the debug information for clues</div>
            <div className="mt-3 p-2 bg-blue-50 rounded">
              <strong>Common Issues:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Missing OPENAI_API_KEY in environment variables</li>
                <li>Voice disabled in user preferences</li>
                <li>Browser microphone permissions not granted</li>
                <li>Not using HTTPS (required for microphone access)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}