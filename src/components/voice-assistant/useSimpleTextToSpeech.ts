
import { useState, useCallback, useRef } from 'react';

export const useSimpleTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speakText = useCallback(async (text: string) => {
    try {
      console.log('Speaking text:', text.substring(0, 50) + '...');
      
      // Stop any current speech first
      if (currentUtteranceRef.current) {
        speechSynthesis.cancel();
        currentUtteranceRef.current = null;
      }
      
      setIsSpeaking(true);
      
      // Check if speech synthesis is available
      if (!('speechSynthesis' in window)) {
        console.error('Speech synthesis not supported');
        setIsSpeaking(false);
        return;
      }
      
      // Cancel any ongoing speech
      speechSynthesis.cancel();
      
      // Wait a moment for cancellation to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create new utterance
      const utterance = new SpeechSynthesisUtterance(text);
      currentUtteranceRef.current = utterance;
      
      // Configure utterance
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Set up event handlers
      utterance.onstart = () => {
        console.log('Speech started');
        setIsSpeaking(true);
      };
      
      utterance.onend = () => {
        console.log('Speech ended');
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
      };
      
      utterance.onerror = (error) => {
        console.error('Speech synthesis error:', error);
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
      };
      
      // Function to set voice after voices are loaded
      const setVoiceAndSpeak = () => {
        const voices = speechSynthesis.getVoices();
        console.log('Available voices:', voices.length);
        
        if (voices.length > 0) {
          // Try to find a good English voice
          const englishVoice = voices.find(voice => 
            voice.lang.startsWith('en') && voice.localService
          ) || voices.find(voice => 
            voice.lang.startsWith('en')
          ) || voices[0];
          
          if (englishVoice) {
            utterance.voice = englishVoice;
            console.log('Selected voice:', englishVoice.name, englishVoice.lang);
          }
        }
        
        // Start speaking
        console.log('Starting speech synthesis...');
        speechSynthesis.speak(utterance);
      };
      
      // Handle voice loading
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Voices already loaded
        setVoiceAndSpeak();
      } else {
        // Wait for voices to load
        console.log('Waiting for voices to load...');
        const handleVoicesChanged = () => {
          console.log('Voices loaded');
          speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
          setVoiceAndSpeak();
        };
        
        speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
        
        // Fallback timeout in case voiceschanged never fires
        setTimeout(() => {
          speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
          setVoiceAndSpeak();
        }, 1000);
      }
      
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    console.log('Cleaning up text-to-speech');
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
