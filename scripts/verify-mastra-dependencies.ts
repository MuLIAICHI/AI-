// scripts/verify-mastra-dependencies.ts
// Run with: npx tsx scripts/verify-mastra-dependencies.ts

import { getConfigurationStatus, validateRealtimeConfig } from '../src/lib/voice/voice-config';

/**
 * Verify Mastra dependencies and configuration
 */
async function verifyMastraDependencies() {
  console.log('🔍 Verifying Mastra Real-time Voice Dependencies...\n');

  // 1. Check package installations
  console.log('📦 Checking Package Installations:');
  
  try {
    // Test @mastra/core
    const mastraCore = await import('@mastra/core');
    console.log('✅ @mastra/core - OK');
    // console.log(`   Version: ${mastraCore.version || 'Unknown'}`);
  } catch (error) {
    console.log('❌ @mastra/core - MISSING or INVALID');
    console.log(`   Error: ${error}`);
  }

  try {
    // Test @mastra/voice-openai-realtime
    const mastraRealtime = await import('@mastra/voice-openai-realtime');
    console.log('✅ @mastra/voice-openai-realtime - OK');
    console.log(`   Has OpenAIRealtimeVoice: ${!!mastraRealtime.OpenAIRealtimeVoice}`);
  } catch (error) {
    console.log('❌ @mastra/voice-openai-realtime - MISSING or INVALID');
    console.log(`   Error: ${error}`);
  }

  try {
    // Test @mastra/node-audio
    const mastraAudio = await import('@mastra/node-audio');
    console.log('✅ @mastra/node-audio - OK');
    console.log(`   Has playAudio: ${!!mastraAudio.playAudio}`);
    console.log(`   Has getMicrophoneStream: ${!!mastraAudio.getMicrophoneStream}`);
  } catch (error) {
    console.log('❌ @mastra/node-audio - MISSING or INVALID');
    console.log(`   Error: ${error}`);
    console.log('   Note: This package is for Node.js environments, browser alternatives will be used');
  }

  try {
    // Test OpenAI package
    const openai = await import('openai');
    console.log('✅ openai - OK');
    // console.log(`   Version: ${openai.VERSION || 'Unknown'}`);
  } catch (error) {
    console.log('❌ openai - MISSING or INVALID');
    console.log(`   Error: ${error}`);
  }

  console.log('\n🔧 Checking Configuration:');
  
  // 2. Check environment configuration
  try {
    const configStatus = getConfigurationStatus();
    console.log(`✅ Configuration loaded successfully`);
    console.log(`   API Key Present: ${configStatus.environment.hasApiKey ? '✅' : '❌'}`);
    console.log(`   Real-time Enabled: ${configStatus.environment.realtimeEnabled ? '✅' : '⚠️'}`);
    console.log(`   Fallback Enabled: ${configStatus.environment.fallbackEnabled ? '✅' : '⚠️'}`);
    console.log(`   Debug Mode: ${configStatus.environment.debugMode ? '🐛' : '📵'}`);
    
    console.log('\n🔊 Audio Configuration:');
    console.log(`   Sample Rate: ${configStatus.audio.sampleRate}Hz`);
    console.log(`   Buffer Size: ${configStatus.audio.bufferSize}`);
    console.log(`   Format: ${configStatus.audio.format}`);
    
    console.log('\n⏱️ Session Configuration:');
    console.log(`   Max Duration: ${configStatus.session.maxDuration}s`);
    console.log(`   Requires Auth: ${configStatus.session.requireAuth ? '✅' : '❌'}`);
    console.log(`   Daily Limit: ${configStatus.session.maxDailySessions}`);
    
  } catch (error) {
    console.log('❌ Configuration error');
    console.log(`   Error: ${error}`);
  }

  console.log('\n🛡️ Validation Results:');
  
  // 3. Validate real-time configuration
  try {
    const validation = validateRealtimeConfig();
    console.log(`   Overall Valid: ${validation.isValid ? '✅' : '❌'}`);
    console.log(`   Ready for Real-time: ${validation.readyForRealtime ? '✅' : '❌'}`);
    
    if (validation.errors.length > 0) {
      console.log('\n❌ Errors:');
      validation.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      validation.warnings.forEach(warning => console.log(`   - ${warning}`));
    }
    
  } catch (error) {
    console.log('❌ Validation failed');
    console.log(`   Error: ${error}`);
  }

  console.log('\n🌐 Browser Environment Check:');
  
  // 4. Check browser-specific requirements (if available)
  if (typeof window !== 'undefined') {
    console.log(`   HTTPS: ${location.protocol === 'https:' ? '✅' : location.hostname === 'localhost' ? '⚠️ (localhost)' : '❌'}`);
    // console.log(`   WebAudio API: ${!!window.AudioContext || !!window.webkitAudioContext ? '✅' : '❌'}`);
    console.log(`   MediaDevices API: ${!!navigator.mediaDevices ? '✅' : '❌'}`);
    console.log(`   WebSocket Support: ${!!window.WebSocket ? '✅' : '❌'}`);
  } else {
    console.log('   Running in Node.js environment');
    console.log('   Browser checks will be performed at runtime');
  }

  console.log('\n📋 Next Steps:');
  console.log('   1. Ensure all ✅ checks pass');
  console.log('   2. Fix any ❌ errors before proceeding');
  console.log('   3. Address ⚠️ warnings for optimal performance');
  console.log('   4. Proceed to Phase 1, Step 1.2 when ready');
  
  console.log('\n🚀 Ready to proceed with Mastra Real-time Voice implementation!');
}

// Run verification if called directly
if (require.main === module) {
  verifyMastraDependencies().catch(console.error);
}

export { verifyMastraDependencies };