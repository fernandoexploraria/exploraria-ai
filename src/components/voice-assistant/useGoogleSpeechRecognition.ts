
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
    // Setup the result callback for when audio recording completes
    console.log('Google Speech Recognition setup complete');
  }, []);

  const startListening = useCallback(async () => {
    try {
      setTranscript('');
      console.log('Starting speech recognition...');
      
      // Start recording and set up automatic processing
      await startRecording();
      
      // Set up a listener for when recording stops (either manually or automatically)
      const checkForCompletion = setInterval(async () => {
        if (!isRecording && !isProcessing) {
          clearInterval(checkForCompletion);
          
          try {
            console.log('Recording completed, processing speech...');
            const audioData = await stopRecording();
            
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
              // Call the result handler if available
              if (window.speechResultHandler) {
                window.speechResultHandler(transcriptText);
              }
            } else {
              toast({
                title: "No Speech Detected",
                description: "Please try speaking more clearly.",
                variant: "destructive"
              });
            }
          } catch (error) {
            console.error('Error processing completed recording:', error);
            toast({
              title: "Speech Recognition Error",
              description: "An error occurred while processing your speech.",
              variant: "destructive"
            });
          }
        }
      }, 500); // Check every 500ms
      
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      toast({
        title: "Speech Recognition Error",
        description: "Could not start recording. Please try again.",
        variant: "destructive"
      });
    }
  }, [startRecording, isRecording, isProcessing, stopRecording, toast]);

  const stopListening = useCallback(async (onResult: (transcript: string) => void) => {
    try {
      // Store the result handler globally so it can be called when processing completes
      window.speechResultHandler = onResult;
      
      console.log('Manually stopping recording...');
      if (isRecording) {
        const audioData = await stopRecording();
        
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
    // Clean up global handler
    if (window.speechResultHandler) {
      delete window.speechResultHandler;
    }
  }, [cleanupRecorder]);

  return {
    isListening: isRecording || isProcessing,
    transcript,
    isSpeechRecognitionSupported: true, // Always supported with Google API
    setupRecognition,
    startListening,
    stopListening,
    forceStopListening,
    cleanup
  };
};

// Extend Window interface for TypeScript
declare global {
  interface Window {
    speechResultHandler?: (transcript: string) => void;
  }
}
