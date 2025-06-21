
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const useTTS = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = async (text: string, isMemoryNarration: boolean = false) => {
    if (isPlaying) {
      stop();
      return;
    }

    try {
      setIsPlaying(true);

      // Check if browser supports speech synthesis as fallback
      if ('speechSynthesis' in window) {
        // Try to use the Gemini TTS function first
        try {
          const { data, error } = await supabase.functions.invoke('gemini-tts', {
            body: { 
              text,
              isMemoryNarration 
            }
          });

          if (error) throw error;

          if (data.audioContent) {
            // Play the generated audio
            const audioBlob = new Blob(
              [Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))],
              { type: 'audio/mp3' }
            );
            const audioUrl = URL.createObjectURL(audioBlob);
            
            audioRef.current = new Audio(audioUrl);
            audioRef.current.onended = () => {
              setIsPlaying(false);
              URL.revokeObjectURL(audioUrl);
            };
            audioRef.current.onerror = () => {
              setIsPlaying(false);
              URL.revokeObjectURL(audioUrl);
              fallbackToWebSpeech(text);
            };
            
            await audioRef.current.play();
            return;
          }
        } catch (error) {
          console.log('Gemini TTS failed, falling back to browser TTS:', error);
        }

        // Fallback to browser speech synthesis
        fallbackToWebSpeech(text);
      } else {
        toast.error('Text-to-speech is not supported in this browser');
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('TTS Error:', error);
      toast.error('Failed to play audio');
      setIsPlaying(false);
    }
  };

  const fallbackToWebSpeech = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    utterance.onend = () => {
      setIsPlaying(false);
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setIsPlaying(false);
      utteranceRef.current = null;
      toast.error('Failed to play audio');
    };
    utterance.onstart = () => {
      setIsPlaying(true);
    };
    
    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  };

  const stop = () => {
    console.log('Stop called - cleaning up all audio sources');
    
    // Stop HTML5 audio
    if (audioRef.current) {
      console.log('Stopping HTML5 audio');
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // Stop speech synthesis
    if ('speechSynthesis' in window) {
      console.log('Cancelling speech synthesis');
      speechSynthesis.cancel();
    }
    
    // Clear utterance reference
    utteranceRef.current = null;
    
    // Update state
    setIsPlaying(false);
  };

  return { speak, stop, isPlaying };
};
