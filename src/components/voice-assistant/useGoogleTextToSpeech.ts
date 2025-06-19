
import { useState, useCallback } from 'react';

export const useGoogleTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speakText = useCallback(async (text: string) => {
    try {
      console.log('Starting TTS for text:', text.substring(0, 50) + '...');
      
      if (!window.speechSynthesis) {
        console.error('Speech synthesis not supported');
        return;
      }

      // Stop any current speech
      speechSynthesis.cancel();
      setIsSpeaking(true);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        console.log('TTS completed');
        setIsSpeaking(false);
      };

      utterance.onerror = (error) => {
        console.error('TTS error:', error);
        setIsSpeaking(false);
      };

      // Get available voices and use English voice if available
      const voices = speechSynthesis.getVoices();
      const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      speechSynthesis.speak(utterance);
      console.log('TTS started successfully');

    } catch (error) {
      console.error('TTS Error:', error);
      setIsSpeaking(false);
    }
  }, []);

  const cleanup = useCallback(() => {
    console.log('TTS cleanup');
    speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    isSpeaking,
    speakText,
    cleanup
  };
};
