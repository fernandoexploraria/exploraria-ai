
import { useState, useRef, useCallback } from 'react';

export const useGoogleTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speakText = useCallback(async (text: string) => {
    try {
      console.log('=== TTS START ===');
      console.log('Text to speak:', text.substring(0, 100) + '...');
      
      // Stop any current speech
      if (currentUtteranceRef.current) {
        console.log('Stopping current speech');
        speechSynthesis.cancel();
        currentUtteranceRef.current = null;
        setIsSpeaking(false);
      }
      
      // Check if browser supports speech synthesis
      if (!window.speechSynthesis) {
        throw new Error('Speech synthesis not supported in this browser');
      }
      
      setIsSpeaking(true);
      
      return new Promise<void>((resolve, reject) => {
        console.log('Creating new utterance...');
        const utterance = new SpeechSynthesisUtterance(text);
        currentUtteranceRef.current = utterance;
        
        // Configure speech parameters
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Set up event handlers
        utterance.onstart = () => {
          console.log('TTS started successfully');
        };
        
        utterance.onend = () => {
          console.log('TTS ended successfully');
          setIsSpeaking(false);
          currentUtteranceRef.current = null;
          resolve();
        };
        
        utterance.onerror = (error) => {
          console.error('TTS error:', error);
          setIsSpeaking(false);
          currentUtteranceRef.current = null;
          reject(new Error(`Speech synthesis error: ${error.error}`));
        };
        
        // Try to get a good voice
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
          const englishVoice = voices.find(voice => 
            voice.lang.startsWith('en') && voice.localService
          ) || voices.find(voice => voice.lang.startsWith('en'));
          
          if (englishVoice) {
            utterance.voice = englishVoice;
            console.log('Using voice:', englishVoice.name);
          }
        }
        
        // Clear any pending speech and speak
        speechSynthesis.cancel();
        console.log('Speaking text...');
        speechSynthesis.speak(utterance);
      });
      
    } catch (error) {
      console.error('TTS Error:', error);
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
