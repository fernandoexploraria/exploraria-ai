
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useGeminiTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const speakText = useCallback(async (text: string) => {
    try {
      console.log('Speaking text with Gemini TTS:', text.substring(0, 50) + '...');
      setIsSpeaking(true);
      
      // Stop any current audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      
      // Call Supabase edge function for TTS
      const { data, error } = await supabase.functions.invoke('gemini-tts', {
        body: { text }
      });

      if (error) {
        console.error('Gemini TTS error:', error);
        setIsSpeaking(false);
        return;
      }

      if (data && data.audioContent) {
        // Convert base64 to audio blob
        const audioBlob = new Blob([
          new Uint8Array(
            atob(data.audioContent)
              .split('')
              .map(char => char.charCodeAt(0))
          )
        ], { type: 'audio/mp3' });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        
        // Set up audio event handlers
        audio.onplay = () => {
          console.log('Gemini TTS audio started playing');
          setIsSpeaking(true);
        };
        
        audio.onended = () => {
          console.log('Gemini TTS audio ended');
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
        };
        
        audio.onerror = (error) => {
          console.error('Gemini TTS audio playback error:', error);
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
        };
        
        // Play the audio
        try {
          await audio.play();
          console.log('Gemini TTS audio playing successfully');
        } catch (playError) {
          console.error('Error playing Gemini TTS audio:', playError);
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error with Gemini Text-to-Speech:', error);
      setIsSpeaking(false);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  return {
    isSpeaking,
    speakText,
    cleanup
  };
};
