
import { useState, useRef, useCallback } from 'react';

export const useGoogleTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speakText = useCallback(async (text: string) => {
    try {
      console.log('=== TTS DEBUG START ===');
      console.log('Speaking text:', text.substring(0, 50) + '...');
      console.log('Speech synthesis available:', !!window.speechSynthesis);
      console.log('Current isSpeaking state:', isSpeaking);
      
      // Stop any current speech
      if (currentUtteranceRef.current) {
        console.log('Stopping current speech');
        speechSynthesis.cancel();
        currentUtteranceRef.current = null;
      }
      
      setIsSpeaking(true);
      console.log('Set isSpeaking to true');
      
      return new Promise<void>((resolve, reject) => {
        const speak = () => {
          console.log('Creating utterance...');
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
            console.log('TTS onstart event fired');
            setIsSpeaking(true);
          };
          
          utterance.onend = () => {
            console.log('TTS onend event fired');
            setIsSpeaking(false);
            currentUtteranceRef.current = null;
            console.log('=== TTS DEBUG END (SUCCESS) ===');
            resolve();
          };
          
          utterance.onerror = (error) => {
            console.error('TTS onerror event fired:', error);
            setIsSpeaking(false);
            currentUtteranceRef.current = null;
            console.log('=== TTS DEBUG END (ERROR) ===');
            reject(error);
          };
          
          // Ensure speech synthesis is not paused
          if (speechSynthesis.paused) {
            console.log('Speech synthesis was paused, resuming...');
            speechSynthesis.resume();
          }
          
          console.log('About to call speechSynthesis.speak()');
          speechSynthesis.speak(utterance);
          console.log('speechSynthesis.speak() called');
        };

        // Check if voices are loaded
        if (speechSynthesis.getVoices().length > 0) {
          console.log('Voices already loaded, speaking immediately');
          speak();
        } else {
          console.log('Waiting for voices to load...');
          // Wait for voices to be loaded
          const voicesChanged = () => {
            console.log('Voices loaded via voiceschanged event');
            speechSynthesis.removeEventListener('voiceschanged', voicesChanged);
            speak();
          };
          speechSynthesis.addEventListener('voiceschanged', voicesChanged);
          
          // Fallback timeout in case voices don't load
          setTimeout(() => {
            console.log('Timeout reached, attempting to speak anyway');
            speechSynthesis.removeEventListener('voiceschanged', voicesChanged);
            speak();
          }, 1000);
        }
      });
      
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      console.log('=== TTS DEBUG END (CATCH) ===');
      setIsSpeaking(false);
      throw error;
    }
  }, []);

  const cleanup = useCallback(() => {
    console.log('TTS cleanup called');
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
