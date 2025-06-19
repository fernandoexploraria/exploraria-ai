
import { useState, useRef, useCallback } from 'react';

export const useGoogleTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const speakText = useCallback(async (text: string) => {
    try {
      console.log('Speaking text:', text.substring(0, 50) + '...');
      setIsSpeaking(true);
      
      // Stop any current audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      
      // For now, let's use the browser's speech synthesis as it's more reliable
      // than trying to implement Google Cloud TTS without proper server setup
      console.log('Using browser speech synthesis...');
      
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Try to find a good voice
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.name.includes('Google') || 
        voice.name.includes('Female') || 
        voice.name.includes('Samantha') ||
        voice.lang.startsWith('en')
      );
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
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
      };
      
      utterance.onerror = (error) => {
        console.error('Speech synthesis error:', error);
        setIsSpeaking(false);
      };
      
      speechSynthesis.speak(utterance);
      
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      setIsSpeaking(false);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    isSpeaking,
    speakText,
    cleanup
  };
};
