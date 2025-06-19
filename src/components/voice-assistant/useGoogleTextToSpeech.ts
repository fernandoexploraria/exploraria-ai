
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
      console.log('Starting TTS for text:', text.substring(0, 50) + '...');
      setIsSpeaking(true);

      // Try Google TTS first, fallback to browser TTS
      try {
        const { data, error } = await supabase.functions.invoke('google-text-to-speech', {
          body: { text }
        });

        if (error) {
          console.error('Google TTS error, falling back to browser TTS:', error);
          throw error;
        }

        if (data && data.audioContent) {
          console.log('Playing Google TTS audio');
          const audioBlob = new Blob([
            new Uint8Array(atob(data.audioContent).split('').map(c => c.charCodeAt(0)))
          ], { type: 'audio/mp3' });
          
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          
          await new Promise((resolve, reject) => {
            audio.onended = () => {
              URL.revokeObjectURL(audioUrl);
              resolve(void 0);
            };
            audio.onerror = reject;
            audio.play().catch(reject);
          });
        }
      } catch (googleError) {
        console.log('Google TTS failed, using browser TTS:', googleError);
        
        // Fallback to browser speech synthesis
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(text);
        
        await new Promise<void>((resolve) => {
          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          synth.speak(utterance);
        });
      }

    } catch (error) {
      console.error('TTS Error:', error);
    } finally {
      setIsSpeaking(false);
    }
  }, [isSpeaking]);

  const cleanup = useCallback(() => {
    console.log('TTS cleanup');
    setIsSpeaking(false);
    // Stop any ongoing speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return {
    isSpeaking,
    speakText,
    cleanup
  };
};
