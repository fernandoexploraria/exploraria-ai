
import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface TTSContextType {
  speak: (text: string, isMemoryNarration?: boolean, interactionId?: string, voiceGender?: 'male' | 'female') => Promise<void>;
  stop: () => void;
  isPlaying: boolean;
  currentPlayingId: string | null;
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

export const useTTSContext = () => {
  const context = useContext(TTSContext);
  if (!context) {
    throw new Error('useTTSContext must be used within a TTSProvider');
  }
  return context;
};

interface TTSProviderProps {
  children: ReactNode;
  isVoiceAgentActive?: boolean;
}

export const TTSProvider: React.FC<TTSProviderProps> = ({ children, isVoiceAgentActive = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = async (text: string, isMemoryNarration: boolean = false, interactionId?: string, voiceGender: 'male' | 'female' = 'female') => {
    // Don't play TTS if voice agent is active to avoid overlapping audio
    if (isVoiceAgentActive) {
      console.log('TTS blocked: Voice agent is active');
      return;
    }
    
    if (isPlaying) {
      stop();
      return;
    }

    try {
      setIsPlaying(true);
      setCurrentPlayingId(interactionId || null);

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
              setCurrentPlayingId(null);
              URL.revokeObjectURL(audioUrl);
            };
            audioRef.current.onerror = () => {
              setIsPlaying(false);
              setCurrentPlayingId(null);
              URL.revokeObjectURL(audioUrl);
              fallbackToWebSpeech(text, voiceGender);
            };
            
            await audioRef.current.play();
            return;
          }
        } catch (error) {
          console.log('Gemini TTS failed, falling back to browser TTS:', error);
        }

        // Fallback to browser speech synthesis
        fallbackToWebSpeech(text, voiceGender);
      } else {
        toast.error('Text-to-speech is not supported in this browser');
        setIsPlaying(false);
        setCurrentPlayingId(null);
      }
    } catch (error) {
      console.error('TTS Error:', error);
      toast.error('Failed to play audio');
      setIsPlaying(false);
      setCurrentPlayingId(null);
    }
  };

  const fallbackToWebSpeech = (text: string, voiceGender: 'male' | 'female' = 'female') => {
    // Ensure voices are loaded
    const selectVoiceAndSpeak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = voiceGender === 'male' ? 0.7 : 1.1; // Lower pitch for male, higher for female
      utterance.volume = 1;
      
      // Try to select appropriate voice
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Look for gender-appropriate voice
        const preferredVoice = voices.find(voice => {
          const voiceName = voice.name.toLowerCase();
          const voiceLang = voice.lang.toLowerCase();
          
          // Prefer English voices
          if (!voiceLang.startsWith('en')) return false;
          
          if (voiceGender === 'male') {
            return voiceName.includes('male') || voiceName.includes('david') || 
                   voiceName.includes('alex') || voiceName.includes('daniel');
          } else {
            return voiceName.includes('female') || voiceName.includes('samantha') || 
                   voiceName.includes('karen') || voiceName.includes('victoria');
          }
        });
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
          console.log(`🎭 Using voice: ${preferredVoice.name} for ${voiceGender}`);
        } else {
          // Fallback: use first available English voice
          const englishVoice = voices.find(voice => voice.lang.toLowerCase().startsWith('en'));
          if (englishVoice) {
            utterance.voice = englishVoice;
            console.log(`🎭 Using fallback English voice: ${englishVoice.name} for ${voiceGender}`);
          }
        }
      }
      
      utterance.onend = () => {
        setIsPlaying(false);
        setCurrentPlayingId(null);
        utteranceRef.current = null;
      };
      utterance.onerror = () => {
        setIsPlaying(false);
        setCurrentPlayingId(null);
        utteranceRef.current = null;
        toast.error('Failed to play audio');
      };
      utterance.onstart = () => {
        setIsPlaying(true);
      };
      
      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    };

    // If voices aren't loaded yet, wait for them
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) {
      speechSynthesis.addEventListener('voiceschanged', selectVoiceAndSpeak, { once: true });
    } else {
      selectVoiceAndSpeak();
    }
  };

  const stop = () => {
    // console.log('Stop called - cleaning up all audio sources');
    
    // Stop HTML5 audio
    if (audioRef.current) {
      console.log('Stopping HTML5 audio');
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // Stop speech synthesis
    if ('speechSynthesis' in window) {
      // console.log('Cancelling speech synthesis');
      speechSynthesis.cancel();
    }
    
    // Clear utterance reference
    utteranceRef.current = null;
    
    // Update state
    setIsPlaying(false);
    setCurrentPlayingId(null);
  };

  return (
    <TTSContext.Provider value={{ speak, stop, isPlaying, currentPlayingId }}>
      {children}
    </TTSContext.Provider>
  );
};
