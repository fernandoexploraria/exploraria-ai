
import { useState, useCallback } from 'react';
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
  const { toast } = useToast();

  const playTTS = useCallback(async (interaction: Interaction, cardIndex: number) => {
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
          return;
        }

        if (data.audioContent) {
          // Play the enhanced memory narration audio
          const audioBlob = new Blob([Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))], { type: 'audio/mp3' });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
          };
          
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
          };
          
          audio.play();
        } else if (data.fallbackToBrowser && data.enhancedText) {
          // Use browser TTS with enhanced text
          const utterance = new SpeechSynthesisUtterance(data.enhancedText);
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
          return;
        }

        if (data.audioContent) {
          // Play the audio
          const audioBlob = new Blob([Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))], { type: 'audio/mp3' });
          const audioUrl = URL.createObjectURL(audioUrl);
          const audio = new Audio(audioUrl);
          
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
          };
          
          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl);
          };
          
          audio.play();
        } else if (data.fallbackToBrowser && data.enhancedText) {
          // Use browser TTS as fallback
          const utterance = new SpeechSynthesisUtterance(data.enhancedText);
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
    }
  }, [toast]);

  return {
    playTTS
  };
};
