
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
        console.log('Stopping previous audio');
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
        dataKeys: Object.keys(data || {}),
        audioContentLength: data?.audioContent?.length || 0
      });

      if (data?.audioContent && !data.fallbackToBrowser) {
        console.log('Playing audio from Gemini TTS, audio length:', data.audioContent.length);
        // Play the audio from Google TTS directly
        await playAudioFromBase64(data.audioContent);
      } else {
        console.log('No audio content received or fallback requested, data:', data);
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
        console.log('Decoded binary string length:', binaryString.length);
        
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log('Created bytes array, length:', bytes.length);
        
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        console.log('Created blob, size:', blob.size, 'type:', blob.type);
        
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
        
        audio.oncanplaythrough = () => {
          console.log('Audio can play through without buffering');
        };
        
        audio.onloadeddata = () => {
          console.log('Audio data loaded');
        };
        
        audio.onloadedmetadata = () => {
          console.log('Audio metadata loaded, duration:', audio.duration);
        };
        
        audio.onplay = () => {
          console.log('Audio playback started');
          setIsSpeaking(true);
        };
        
        audio.onplaying = () => {
          console.log('Audio is actually playing');
        };
        
        audio.onpause = () => {
          console.log('Audio paused');
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
            code: audio.error?.code,
            message: audio.error?.message,
            networkState: audio.networkState,
            readyState: audio.readyState,
            src: audio.src
          });
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          reject(error);
        };
        
        // Additional event listeners for debugging
        audio.onstalled = () => {
          console.log('Audio stalled');
        };
        
        audio.onsuspend = () => {
          console.log('Audio suspended');
        };
        
        audio.onwaiting = () => {
          console.log('Audio waiting for data');
        };
        
        audio.onabort = () => {
          console.log('Audio aborted');
        };
        
        // Check if audio context is allowed (for iOS/mobile)
        if (typeof window !== 'undefined' && 'webkitAudioContext' in window) {
          console.log('WebKit audio context available');
        }
        
        // Start playing with additional error handling
        console.log('Attempting to play audio...');
        console.log('Audio properties before play:', {
          src: audio.src,
          readyState: audio.readyState,
          networkState: audio.networkState,
          paused: audio.paused,
          ended: audio.ended,
          muted: audio.muted,
          volume: audio.volume
        });
        
        audio.play().then(() => {
          console.log('Audio.play() promise resolved successfully');
        }).catch(error => {
          console.error('Failed to play audio:', error);
          console.error('Play error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            audioState: {
              src: audio.src,
              readyState: audio.readyState,
              networkState: audio.networkState,
              error: audio.error
            }
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
