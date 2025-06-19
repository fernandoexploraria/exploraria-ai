
import { useState, useCallback } from 'react';
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

  const setupRecognition = useCallback((onResult: (transcript: string) => void) => {
    console.log('Google Speech Recognition setup complete');
  }, []);

  const startListening = useCallback(async () => {
    try {
      setTranscript('');
      console.log('Starting speech recognition...');
      await startRecording();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      toast({
        title: "Speech Recognition Error",
        description: "Could not start recording. Please try again.",
        variant: "destructive"
      });
    }
  }, [startRecording, toast]);

  const stopListening = useCallback(async (onResult: (transcript: string) => void) => {
    try {
      console.log('Stopping recording and processing speech...');
      
      if (!isRecording) {
        console.log('Not currently recording');
        return;
      }

      const audioData = await stopRecording();
      
      if (!audioData) {
        console.error('No audio data received');
        toast({
          title: "Recording Error",
          description: "No audio was recorded. Please try again.",
          variant: "destructive"
        });
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
        return;
      }

      const transcriptText = data?.transcript || '';
      console.log('Received transcript:', transcriptText);
      
      if (transcriptText) {
        setTranscript(transcriptText);
        onResult(transcriptText);
      } else {
        toast({
          title: "No Speech Detected",
          description: "Please try speaking more clearly.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error processing speech:', error);
      toast({
        title: "Speech Recognition Error",
        description: "An error occurred while processing your speech.",
        variant: "destructive"
      });
    }
  }, [stopRecording, isRecording, toast]);

  const forceStopListening = useCallback(() => {
    cleanupRecorder();
  }, [cleanupRecorder]);

  const cleanup = useCallback(() => {
    cleanupRecorder();
  }, [cleanupRecorder]);

  return {
    isListening: isRecording || isProcessing,
    transcript,
    isSpeechRecognitionSupported: true,
    setupRecognition,
    startListening,
    stopListening,
    forceStopListening,
    cleanup
  };
};
