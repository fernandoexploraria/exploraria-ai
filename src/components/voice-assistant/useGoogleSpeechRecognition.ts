
import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAudioRecorder } from './useAudioRecorder';

export const useGoogleSpeechRecognition = () => {
  const [transcript, setTranscript] = useState('');
  const { toast } = useToast();
  const { 
    isRecording, 
    isProcessing, 
    startRecording, 
    stopRecording, 
    cleanup: cleanupRecorder 
  } = useAudioRecorder();

  const continuousListeningRef = useRef(false);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onResultCallbackRef = useRef<((transcript: string) => void) | null>(null);

  const processSpeechAfterPause = useCallback(async () => {
    console.log('Processing speech after pause detected...');
    
    if (!isRecording) {
      console.log('Not currently recording, skipping processing');
      return;
    }

    try {
      const audioData = await stopRecording();
      
      if (!audioData) {
        console.log('No audio data, restarting recording...');
        // Restart recording for continuous listening
        if (continuousListeningRef.current) {
          setTimeout(() => startRecording(), 100);
        }
        return;
      }

      console.log('Sending audio to Google Speech-to-Text...');
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audioData }
      });

      if (error) {
        console.error('Speech-to-Text error:', error);
        toast({
          title: "Speech Recognition Error",
          description: "Could not process speech. Please try again.",
          variant: "destructive"
        });
      } else {
        const transcriptText = data?.transcript || '';
        console.log('Received transcript:', transcriptText);
        
        if (transcriptText && onResultCallbackRef.current) {
          setTranscript(transcriptText);
          onResultCallbackRef.current(transcriptText);
        }
      }

      // Restart recording for continuous listening
      if (continuousListeningRef.current) {
        console.log('Restarting recording for continuous listening...');
        setTimeout(() => startRecording(), 500); // Small delay to prevent audio conflicts
      }

    } catch (error) {
      console.error('Error processing speech:', error);
      
      // Restart recording even on error for continuous listening
      if (continuousListeningRef.current) {
        setTimeout(() => startRecording(), 1000);
      }
    }
  }, [stopRecording, startRecording, isRecording, toast]);

  const startListening = useCallback(async (onResult?: (transcript: string) => void) => {
    try {
      setTranscript('');
      continuousListeningRef.current = true;
      onResultCallbackRef.current = onResult || null;
      
      console.log('Starting continuous speech recognition...');
      await startRecording();

      // Set up automatic processing after speech pauses
      const resetSpeechTimeout = () => {
        if (speechTimeoutRef.current) {
          clearTimeout(speechTimeoutRef.current);
        }
        
        speechTimeoutRef.current = setTimeout(() => {
          console.log('Speech pause detected, processing...');
          processSpeechAfterPause();
        }, 2000); // 2 second pause before processing
      };

      // Monitor for speech activity (this is a simplified approach)
      // In a real implementation, you might want to use voice activity detection
      resetSpeechTimeout();

    } catch (error) {
      console.error('Error starting continuous listening:', error);
      continuousListeningRef.current = false;
      toast({
        title: "Speech Recognition Error",
        description: "Could not start recording. Please try again.",
        variant: "destructive"
      });
    }
  }, [startRecording, toast, processSpeechAfterPause]);

  const stopListening = useCallback(async (onResult: (transcript: string) => void) => {
    try {
      console.log('Stopping continuous listening...');
      continuousListeningRef.current = false;
      
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }

      // Process any remaining audio
      if (isRecording) {
        const audioData = await stopRecording();
        
        if (audioData) {
          console.log('Processing final audio before stopping...');
          const { data, error } = await supabase.functions.invoke('speech-to-text', {
            body: { audioData }
          });

          if (!error && data?.transcript) {
            const transcriptText = data.transcript;
            console.log('Final transcript:', transcriptText);
            setTranscript(transcriptText);
            onResult(transcriptText);
          }
        }
      }
    } catch (error) {
      console.error('Error stopping listening:', error);
      continuousListeningRef.current = false;
    }
  }, [stopRecording, isRecording]);

  const forceStopListening = useCallback(() => {
    continuousListeningRef.current = false;
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    cleanupRecorder();
  }, [cleanupRecorder]);

  const cleanup = useCallback(() => {
    continuousListeningRef.current = false;
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    cleanupRecorder();
  }, [cleanupRecorder]);

  return {
    isListening: isRecording || isProcessing,
    transcript,
    isSpeechRecognitionSupported: true,
    startListening,
    stopListening,
    forceStopListening,
    cleanup
  };
};
