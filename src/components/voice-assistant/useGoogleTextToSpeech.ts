
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useGoogleTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speakText = useCallback(async (text: string) => {
    try {
      console.log('Starting Google TTS for text:', text.substring(0, 50) + '...');
      setIsSpeaking(true);

      const { data, error } = await supabase.functions.invoke('google-text-to-speech', {
        body: { text }
      });

      if (error) {
        console.error('Google TTS error:', error);
        throw error;
      }

      if (data && data.audioContent) {
        // Convert base64 to audio and play
        const audioBlob = new Blob([
          Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))
        ], { type: 'audio/mp3' });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          console.log('Google TTS playback completed');
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = (error) => {
          console.error('Audio playback error:', error);
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
        console.log('Google TTS audio started playing');
      }

    } catch (error) {
      console.error('Google TTS Error:', error);
      setIsSpeaking(false);
    }
  }, []);

  const cleanup = useCallback(() => {
    console.log('Google TTS cleanup');
    setIsSpeaking(false);
  }, []);

  return {
    isSpeaking,
    speakText,
    cleanup
  };
};
