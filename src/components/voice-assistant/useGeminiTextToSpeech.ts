
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useGeminiTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speakText = useCallback(async (text: string) => {
    try {
      console.log('Enhancing text with Gemini for TTS:', text.substring(0, 50) + '...');
      setIsSpeaking(true);
      
      // Stop any current speech
      if (currentUtteranceRef.current) {
        speechSynthesis.cancel();
        currentUtteranceRef.current = null;
      }
      
      // Call Supabase edge function to enhance text with Gemini
      const { data, error } = await supabase.functions.invoke('gemini-tts', {
        body: { text }
      });

      if (error) {
        console.error('Gemini TTS error:', error);
        // Fallback to original text if Gemini fails
        await speakWithBrowser(text);
        return;
      }

      const textToSpeak = data?.enhancedText || text;
      await speakWithBrowser(textToSpeak);
      
    } catch (error) {
      console.error('Error with Gemini-enhanced TTS:', error);
      // Fallback to original text
      await speakWithBrowser(text);
    }
  }, []);

  const speakWithBrowser = async (text: string) => {
    return new Promise<void>((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        console.error('Speech synthesis not supported');
        setIsSpeaking(false);
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      currentUtteranceRef.current = utterance;
      
      // Configure speech settings
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => {
        console.log('Gemini-enhanced TTS started');
        setIsSpeaking(true);
      };
      
      utterance.onend = () => {
        console.log('Gemini-enhanced TTS ended');
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        resolve();
      };
      
      utterance.onerror = (error) => {
        console.error('TTS error:', error);
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        reject(error);
      };
      
      speechSynthesis.speak(utterance);
    });
  };

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
