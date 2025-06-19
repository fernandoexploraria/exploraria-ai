
import { useState, useRef, useCallback } from 'react';

export const useGoogleTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speakText = useCallback(async (text: string) => {
    try {
      console.log('Speaking text:', text.substring(0, 50) + '...');
      
      // Stop any current speech
      if (currentUtteranceRef.current) {
        speechSynthesis.cancel();
        currentUtteranceRef.current = null;
      }
      
      setIsSpeaking(true);
      
      return new Promise<void>((resolve, reject) => {
        const speak = () => {
          const utterance = new SpeechSynthesisUtterance(text);
          currentUtteranceRef.current = utterance;
          
          // Get available voices
          const voices = speechSynthesis.getVoices();
          console.log('Available voices:', voices.length);
          
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
            console.log('Using voice:', preferredVoice.name, preferredVoice.lang);
          } else {
            console.log('No preferred voice found, using default');
          }
          
          // Configure speech parameters
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          
          utterance.onstart = () => {
            console.log('Speech started');
            setIsSpeaking(true);
          };
          
          utterance.onend = () => {
            console.log('Speech ended');
            setIsSpeaking(false);
            currentUtteranceRef.current = null;
            resolve();
          };
          
          utterance.onerror = (error) => {
            console.error('Speech synthesis error:', error);
            setIsSpeaking(false);
            currentUtteranceRef.current = null;
            reject(error);
          };
          
          // Ensure speech synthesis is not paused
          if (speechSynthesis.paused) {
            speechSynthesis.resume();
          }
          
          speechSynthesis.speak(utterance);
        };

        // Check if voices are loaded
        if (speechSynthesis.getVoices().length > 0) {
          speak();
        } else {
          // Wait for voices to be loaded
          const voicesChanged = () => {
            speechSynthesis.removeEventListener('voiceschanged', voicesChanged);
            speak();
          };
          speechSynthesis.addEventListener('voiceschanged', voicesChanged);
          
          // Fallback timeout in case voices don't load
          setTimeout(() => {
            speechSynthesis.removeEventListener('voiceschanged', voicesChanged);
            speak();
          }, 1000);
        }
      });
      
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      setIsSpeaking(false);
      throw error;
    }
  }, []);

  const cleanup = useCallback(() => {
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
