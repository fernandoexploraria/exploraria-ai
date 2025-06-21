
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Interaction {
  id: string;
  interaction_type: string;
  full_transcript: any;
  user_input: string;
  assistant_response: string;
}

export const useTTSManager = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playingCardIndex, setPlayingCardIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const stopAllTTSPlayback = useCallback(() => {
    // Stop HTML5 audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    
    // Stop browser speech synthesis
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    
    // Reset state
    setIsPlaying(false);
    setPlayingCardIndex(null);
  }, [currentAudio]);

  const playTTS = useCallback(async (interaction: Interaction, cardIndex: number) => {
    // Always stop any currently playing audio first
    stopAllTTSPlayback();

    // Set playing state immediately
    setIsPlaying(true);
    setPlayingCardIndex(cardIndex);

    try {
      if (interaction.interaction_type === 'voice' && interaction.full_transcript) {
        // For voice transcripts, create a memory-style narration
        const transcript = interaction.full_transcript;
        let transcriptText = '';
        
        if (transcript && Array.isArray(transcript)) {
          transcriptText = transcript
            .filter((entry: any) => entry.message && (entry.role === 'user' || entry.role === 'agent'))
            .map((entry: any) => {
              const speaker = entry.role === 'user' ? 'User' : 'Assistant';
              const message = entry.message;
              const interrupted = entry.role === 'agent' && entry.interrupted ? ' (interrupted)' : '';
              return `${speaker}: ${message}${interrupted}`;
            })
            .join('. ');
        } else {
          transcriptText = `User: ${interaction.user_input}. Assistant: ${interaction.assistant_response}`;
        }

        const { data, error } = await supabase.functions.invoke('gemini-tts', {
          body: { 
            text: transcriptText,
            isMemoryNarration: true
          }
        });

        if (error) {
          console.error('Memory TTS error:', error);
          toast({
            title: "Audio generation failed",
            description: "Could not generate memory narration.",
            variant: "destructive"
          });
          setIsPlaying(false);
          setPlayingCardIndex(null);
          return;
        }

        if (data.audioContent) {
          // Play the enhanced memory narration audio
          const audioBlob = new Blob([Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))], { type: 'audio/mp3' });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          
          setCurrentAudio(audio);
          
          audio.onended = () => {
            setIsPlaying(false);
            setPlayingCardIndex(null);
            setCurrentAudio(null);
            URL.revokeObjectURL(audioUrl);
          };
          
          audio.onerror = () => {
            setIsPlaying(false);
            setPlayingCardIndex(null);
            setCurrentAudio(null);
            URL.revokeObjectURL(audioUrl);
          };
          
          audio.play();
        } else if (data.fallbackToBrowser && data.enhancedText) {
          // Use browser TTS with enhanced text
          const utterance = new SpeechSynthesisUtterance(data.enhancedText);
          utterance.onend = () => {
            setIsPlaying(false);
            setPlayingCardIndex(null);
          };
          utterance.onerror = () => {
            setIsPlaying(false);
            setPlayingCardIndex(null);
          };
          speechSynthesis.speak(utterance);
        }
      } else {
        // For non-voice interactions, use the enhanced TTS
        const { data, error } = await supabase.functions.invoke('gemini-tts', {
          body: { text: interaction.assistant_response }
        });

        if (error) {
          console.error('TTS error:', error);
          toast({
            title: "Audio generation failed",
            description: "Could not generate audio for this text.",
            variant: "destructive"
          });
          setIsPlaying(false);
          setPlayingCardIndex(null);
          return;
        }

        if (data.audioContent) {
          // Play the audio
          const audioBlob = new Blob([Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))], { type: 'audio/mp3' });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          
          setCurrentAudio(audio);
          
          audio.onended = () => {
            setIsPlaying(false);
            setPlayingCardIndex(null);
            setCurrentAudio(null);
            URL.revokeObjectURL(audioUrl);
          };
          
          audio.onerror = () => {
            setIsPlaying(false);
            setPlayingCardIndex(null);
            setCurrentAudio(null);
            URL.revokeObjectURL(audioUrl);
          };
          
          audio.play();
        } else if (data.fallbackToBrowser && data.enhancedText) {
          // Use browser TTS as fallback
          const utterance = new SpeechSynthesisUtterance(data.enhancedText);
          utterance.onend = () => {
            setIsPlaying(false);
            setPlayingCardIndex(null);
          };
          utterance.onerror = () => {
            setIsPlaying(false);
            setPlayingCardIndex(null);
          };
          speechSynthesis.speak(utterance);
        }
      }
    } catch (error) {
      console.error('TTS error:', error);
      toast({
        title: "Audio generation failed",
        description: "Could not generate audio for this text.",
        variant: "destructive"
      });
      setIsPlaying(false);
      setPlayingCardIndex(null);
    }
  }, [stopAllTTSPlayback, toast]);

  return {
    isPlaying,
    playingCardIndex,
    stopAllTTSPlayback,
    playTTS
  };
};
