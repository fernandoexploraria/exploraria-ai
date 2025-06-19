
import { useState, useRef, useCallback } from 'react';

export const useGoogleTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speakText = useCallback(async (text: string) => {
    try {
      console.log('=== TTS ASSISTANT START ===');
      console.log('Text to speak:', text.substring(0, 100) + '...');
      
      // Stop any current speech
      if (currentUtteranceRef.current) {
        console.log('Stopping current speech');
        speechSynthesis.cancel();
        currentUtteranceRef.current = null;
      }
      
      // Ensure speech synthesis is available
      if (!window.speechSynthesis) {
        throw new Error('Speech synthesis not supported');
      }
      
      setIsSpeaking(true);
      
      return new Promise<void>((resolve, reject) => {
        const speak = () => {
          console.log('Creating utterance for assistant...');
          const utterance = new SpeechSynthesisUtterance(text);
          currentUtteranceRef.current = utterance;
          
          // Get available voices
          const voices = speechSynthesis.getVoices();
          console.log('Available voices count:', voices.length);
          
          // Try to find a good English voice
          const preferredVoice = voices.find(voice => 
            voice.lang.startsWith('en') && (
              voice.name.includes('Google') || 
              voice.name.includes('Natural') ||
              voice.name.includes('Enhanced') ||
              voice.name.includes('Premium')
            )
          ) || voices.find(voice => voice.lang.startsWith('en-US')) 
            || voices.find(voice => voice.lang.startsWith('en'));
          
          if (preferredVoice) {
            utterance.voice = preferredVoice;
            console.log('Using voice for assistant:', preferredVoice.name);
          } else {
            console.log('No preferred voice found, using default');
          }
          
          // Configure speech parameters for assistant
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          
          utterance.onstart = () => {
            console.log('Assistant TTS started');
            setIsSpeaking(true);
          };
          
          utterance.onend = () => {
            console.log('Assistant TTS ended');
            setIsSpeaking(false);
            currentUtteranceRef.current = null;
            console.log('=== TTS ASSISTANT END (SUCCESS) ===');
            resolve();
          };
          
          utterance.onerror = (error) => {
            console.error('Assistant TTS error:', error);
            setIsSpeaking(false);
            currentUtteranceRef.current = null;
            console.log('=== TTS ASSISTANT END (ERROR) ===');
            reject(new Error(`Speech synthesis error: ${error.error}`));
          };
          
          // Make sure speech synthesis is ready
          if (speechSynthesis.paused) {
            console.log('Speech synthesis was paused, resuming...');
            speechSynthesis.resume();
          }
          
          // Clear any pending speech
          speechSynthesis.cancel();
          
          // Small delay to ensure clean state
          setTimeout(() => {
            console.log('Speaking with assistant TTS...');
            speechSynthesis.speak(utterance);
          }, 100);
        };

        // Ensure voices are loaded
        if (speechSynthesis.getVoices().length > 0) {
          console.log('Voices already loaded for assistant');
          speak();
        } else {
          console.log('Waiting for voices to load for assistant...');
          const voicesChanged = () => {
            console.log('Voices loaded for assistant');
            speechSynthesis.removeEventListener('voiceschanged', voicesChanged);
            speak();
          };
          speechSynthesis.addEventListener('voiceschanged', voicesChanged);
          
          // Fallback timeout
          setTimeout(() => {
            console.log('Timeout reached for assistant, attempting anyway');
            speechSynthesis.removeEventListener('voiceschanged', voicesChanged);
            speak();
          }, 2000);
        }
      });
      
    } catch (error) {
      console.error('Assistant TTS Error:', error);
      setIsSpeaking(false);
      throw error;
    }
  }, []);

  const cleanup = useCallback(() => {
    console.log('Assistant TTS cleanup called');
    if (currentUtteranceRef.current) {
      speechSynthesis.cancel();
      currentUtteranceRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  return {
    isSpeaking,
    speakText,
    cleanup
  };
};
