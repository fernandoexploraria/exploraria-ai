
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useGoogleSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const resultHandlerRef = useRef<((transcript: string) => void) | null>(null);
  const { toast } = useToast();

  const setupRecognition = useCallback((onResult: (transcript: string) => void) => {
    console.log('Setting up Google Speech Recognition...');
    resultHandlerRef.current = onResult;
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

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('Audio chunk received:', event.data.size, 'bytes');
        }
      };
      
      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, processing audio...');
        
        if (audioChunksRef.current.length === 0) {
          console.log('No audio data recorded');
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('Audio blob size:', audioBlob.size);
        
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64Audio = (reader.result as string).split(',')[1];
              console.log('Sending audio to Google Speech API...');
              
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
                
                if (resultHandlerRef.current) {
                  resultHandlerRef.current(data.text);
                }
              } else {
                console.log('No text received from Google Speech API');
                toast({
                  title: "No Speech Detected",
                  description: "Please speak clearly and try again.",
                  variant: "default"
                });
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
        } catch (error) {
          console.error('Error reading audio blob:', error);
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        toast({
          title: "Recording Error",
          description: "Failed to record audio. Please try again.",
          variant: "destructive"
        });
      };
      
      mediaRecorder.start();
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
    console.log('Stopping Google Speech Recognition...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsListening(false);
  }, []);

  const cleanup = useCallback(() => {
    console.log('Google Speech Recognition cleanup');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsListening(false);
    setTranscript('');
    resultHandlerRef.current = null;
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
