
import { useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  const isSpeechRecognitionSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  const setupRecognition = useCallback((onResult: (transcript: string) => void) => {
    if (!isSpeechRecognitionSupported) {
      console.warn('Speech recognition not supported');
      return;
    }

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
        
        let errorMessage = 'An error occurred with speech recognition.';
        
        switch (event.error) {
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow microphone permissions.';
            break;
          case 'no-speech':
            errorMessage = 'No speech detected. Please try speaking again.';
            break;
          case 'audio-capture':
            errorMessage = 'Audio capture failed. Please check your microphone.';
            break;
          case 'network':
            errorMessage = 'Network error occurred. Please check your connection.';
            break;
          case 'service-not-allowed':
            errorMessage = 'Speech recognition service not allowed.';
            break;
          case 'bad-grammar':
            errorMessage = 'Speech recognition grammar error.';
            break;
        }
        
        toast({
          title: "Speech Recognition Error",
          description: errorMessage,
          variant: "destructive"
        });
      };
    } catch (error) {
      console.error('Error setting up speech recognition:', error);
      toast({
        title: "Setup Error",
        description: "Failed to initialize speech recognition. Please refresh and try again.",
        variant: "destructive"
      });
    }
  }, [isSpeechRecognitionSupported, toast]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        console.log('Starting speech recognition...');
        setTranscript(''); // Clear previous transcript
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setIsListening(false);
        toast({
          title: "Microphone Error",
          description: "Failed to start listening. Please check microphone permissions.",
          variant: "destructive"
        });
      }
    }
  }, [toast, isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      console.log('Stopping speech recognition...');
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
  }, [isListening]);

  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition during cleanup:', error);
      }
    }
    setIsListening(false);
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    isSpeechRecognitionSupported,
    setupRecognition,
    startListening,
    stopListening,
    cleanup
  };
};
