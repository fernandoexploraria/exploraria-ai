
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useGoogleTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speakText = useCallback(async (text: string) => {
    if (isSpeaking) {
      console.log('Already speaking, skipping');
      return;
    }

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
        console.log('Received audio content, playing...');
        
        // Convert base64 to audio blob
        const binaryString = atob(data.audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const audioBlob = new Blob([bytes], { type: 'audio/mp3' });
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
  }, [isSpeaking]);

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
