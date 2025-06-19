
import { useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  const isSpeechRecognitionSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  const setupRecognition = useCallback((onResult: (transcript: string) => void) => {
    if (!isSpeechRecognitionSupported) return;

    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
      };

      recognitionRef.current.onresult = (event: any) => {
        console.log('Speech recognition result event:', event);
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          console.log('Final transcript:', finalTranscript);
          setTranscript(finalTranscript);
          setIsListening(false);
          onResult(finalTranscript);
        }
      };

      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Speech Recognition Error",
          description: `Error: ${event.error}. Please check your microphone permissions.`,
          variant: "destructive"
        });
      };
    } catch (error) {
      console.error('Error setting up speech recognition:', error);
    }
  }, [isSpeechRecognitionSupported, toast]);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        console.log('Starting speech recognition...');
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setIsListening(false);
        toast({
          title: "Microphone Error",
          description: "Please allow microphone access and try again.",
          variant: "destructive"
        });
      }
    }
  }, [toast]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      console.log('Stopping speech recognition...');
      recognitionRef.current.stop();
    }
  }, [isListening]);

  // Force stop recognition (for TTS interference prevention)
  const forceStopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        console.log('Force stopping speech recognition for TTS...');
        recognitionRef.current.abort();
        setIsListening(false);
      } catch (error) {
        console.error('Error force stopping recognition:', error);
      }
    }
  }, []);

  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
  }, []);

  return {
    isListening,
    transcript,
    isSpeechRecognitionSupported,
    setupRecognition,
    startListening,
    stopListening,
    forceStopListening,
    cleanup
  };
};
