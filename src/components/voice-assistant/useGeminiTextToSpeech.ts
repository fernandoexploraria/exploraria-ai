
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useGeminiTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const speakText = useCallback(async (text: string) => {
    try {
      console.log('Starting Gemini TTS for:', text.substring(0, 50) + '...');
      setIsSpeaking(true);
      
      // Stop any current audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      
      // Call Supabase edge function for Gemini-enhanced TTS
      const { data, error } = await supabase.functions.invoke('gemini-tts', {
        body: { text }
      });

      if (error) {
        console.error('Gemini TTS error:', error);
        setIsSpeaking(false);
        return;
      }

      if (data?.audioContent && !data.fallbackToBrowser) {
        // Play the audio from Google TTS directly
        await playAudioFromBase64(data.audioContent);
      } else {
        console.log('No audio content received, TTS may have failed');
        setIsSpeaking(false);
      }
      
    } catch (error) {
      console.error('Error with Gemini TTS:', error);
      setIsSpeaking(false);
    }
  }, []);

  const playAudioFromBase64 = async (base64Audio: string) => {
    return new Promise<void>((resolve, reject) => {
      try {
        // Convert base64 to blob URL
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);
        
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        
        audio.onloadstart = () => {
          console.log('Audio loading started');
        };
        
        audio.oncanplay = () => {
          console.log('Audio can start playing');
        };
        
        audio.onplay = () => {
          console.log('Audio playback started');
          setIsSpeaking(true);
        };
        
        audio.onended = () => {
          console.log('Audio playback ended');
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          resolve();
        };
        
        audio.onerror = (error) => {
          console.error('Audio playback error:', error);
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          reject(error);
        };
        
        // Start playing
        audio.play().catch(error => {
          console.error('Failed to play audio:', error);
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          reject(error);
        });
        
      } catch (error) {
        console.error('Error creating audio from base64:', error);
        setIsSpeaking(false);
        reject(error);
      }
    });
  };

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
