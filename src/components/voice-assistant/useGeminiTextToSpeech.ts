
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
      console.log('Calling gemini-tts edge function...');
      const { data, error } = await supabase.functions.invoke('gemini-tts', {
        body: { text }
      });

      if (error) {
        console.error('Gemini TTS error:', error);
        setIsSpeaking(false);
        return;
      }

      console.log('TTS response received:', { 
        hasAudioContent: !!data?.audioContent, 
        fallbackToBrowser: data?.fallbackToBrowser,
        dataKeys: Object.keys(data || {})
      });

      if (data?.audioContent && !data.fallbackToBrowser) {
        console.log('Playing audio from Gemini TTS');
        // Play the audio from Google TTS directly
        await playAudioFromBase64(data.audioContent);
      } else {
        console.log('No audio content received or fallback requested');
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
        console.log('Converting base64 to audio blob, length:', base64Audio.length);
        
        // Convert base64 to blob URL
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);
        
        console.log('Created audio URL:', audioUrl);
        
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
          console.error('Audio error details:', {
            error: audio.error,
            networkState: audio.networkState,
            readyState: audio.readyState
          });
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          reject(error);
        };
        
        // Start playing with additional error handling
        console.log('Attempting to play audio...');
        audio.play().then(() => {
          console.log('Audio.play() promise resolved successfully');
        }).catch(error => {
          console.error('Failed to play audio:', error);
          console.error('Play error details:', {
            name: error.name,
            message: error.message,
            code: error.code
          });
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
    console.log('Cleaning up TTS');
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
