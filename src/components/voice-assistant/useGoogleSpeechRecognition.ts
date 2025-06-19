
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useGoogleSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const setupRecognition = useCallback((onResult: (transcript: string) => void) => {
    console.log('Setting up Google Speech Recognition...');
    
    // Store the result handler for later use
    (window as any).googleSpeechOnResult = onResult;
  }, []);

  const startListening = useCallback(async () => {
    if (isListening) {
      console.log('Already listening');
      return;
    }

    try {
      console.log('Starting Google Speech Recognition...');
      setIsListening(true);
      setTranscript('');
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        console.log('Recording stopped, processing audio...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          
          try {
            const { data, error } = await supabase.functions.invoke('google-speech-to-text', {
              body: { audio: base64Audio }
            });

            if (error) {
              console.error('Google Speech-to-Text error:', error);
              toast({
                title: "Speech Recognition Error",
                description: "Failed to process speech. Please try again.",
                variant: "destructive"
              });
              return;
            }

            if (data && data.text) {
              console.log('Google Speech Recognition result:', data.text);
              setTranscript(data.text);
              
              if ((window as any).googleSpeechOnResult) {
                (window as any).googleSpeechOnResult(data.text);
              }
            }
          } catch (error) {
            console.error('Error processing speech:', error);
            toast({
              title: "Processing Error",
              description: "Failed to process your speech. Please try again.",
              variant: "destructive"
            });
          }
        };
        reader.readAsDataURL(audioBlob);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      console.log('Recording started');
      
    } catch (error) {
      console.error('Error starting Google Speech Recognition:', error);
      setIsListening(false);
      toast({
        title: "Microphone Error",
        description: "Please allow microphone access and try again.",
        variant: "destructive"
      });
    }
  }, [isListening, toast]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('Stopping Google Speech Recognition...');
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const cleanup = useCallback(() => {
    console.log('Google Speech Recognition cleanup');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    isSpeechRecognitionSupported: true, // Google API is always supported
    setupRecognition,
    startListening,
    stopListening,
    cleanup
  };
};
