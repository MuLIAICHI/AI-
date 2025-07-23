// src/app/(dashboard)/voice-test/page.tsx
'use client';

// Add this to your voice-test.tsx component
import { useVoicePreferences } from '@/hooks/use-voice-preferences';
import { useState, useCallback } from 'react';
import {VoiceTest} from '@/components/voice/voice-test'; // Adjust the import path as necessary

// function VoiceTest() {
//   const { preferences, updatePreferences } = useVoicePreferences();
//   const { speak, isLoading, error, canSpeak } = useVoice();

//   // Add this function
//   const enableVoice = async () => {
//     console.log('🔧 Enabling voice for testing...');
//     await updatePreferences({ voiceEnabled: true });
//   };

//   return (
//     <div className="space-y-4">
//       {/* Add this section at the top */}
//       <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
//         <h3 className="font-semibold text-yellow-800">Voice Status</h3>
//         <p className="text-sm text-yellow-700">
//           Voice Enabled: {preferences?.voiceEnabled ? '✅ Yes' : '❌ No'}
//         </p>
//         <p className="text-sm text-yellow-700">
//           Can Speak: {canSpeak ? '✅ Yes' : '❌ No'}
//         </p>
        
//         {/* Enable voice button */}
//         {!preferences?.voiceEnabled && (
//           <button 
//             onClick={enableVoice}
//             className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm"
//           >
//             🔧 Enable Voice for Testing
//           </button>
//         )}
//       </div>

//       {/* Your existing test buttons */}
//       <button 
//         onClick={() => speak("Hello! This is a test of your voice system.")}
//         disabled={!canSpeak || isLoading}
//         className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
//       >
//         {isLoading ? 'Loading...' : '🎤 Test Basic Voice'}
//       </button>

//       {error && (
//         <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
//           Error: {error}
//         </div>
//       )}
//     </div>
//   );
// }

export default function VoiceTestPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">🎤 Voice System Test</h1>
      <VoiceTest />
    </div>
  );
}


function useVoice(): {
    speak: (text: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
    canSpeak: boolean;
} {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSpeak =
        typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        typeof window.speechSynthesis.speak === 'function';

    const speak = useCallback(async (text: string) => {
        setError(null);
        if (!canSpeak) {
            setError('Speech synthesis is not supported in this browser.');
            return;
        }
        setIsLoading(true);
        try {
            const utterance = new window.SpeechSynthesisUtterance(text);
            await new Promise<void>((resolve, reject) => {
                utterance.onend = () => resolve();
                utterance.onerror = (e) => {
                    setError('Speech synthesis error.');
                    reject(e);
                };
                window.speechSynthesis.speak(utterance);
            });
        } catch (e) {
            setError('Failed to speak.');
        } finally {
            setIsLoading(false);
        }
    }, [canSpeak]);

    return { speak, isLoading, error, canSpeak };
}


