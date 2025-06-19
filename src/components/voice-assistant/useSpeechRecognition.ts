
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
      console.log('Setting up speech recognition...');
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      // Configure recognition
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
      };

      recognitionRef.current.onresult = (event: any) => {
        console.log('Speech recognition result:', event);
        
        if (event.results && event.results.length > 0) {
          const result = event.results[0];
          if (result.isFinal && result[0]) {
            const finalTranscript = result[0].transcript.trim();
            console.log('Final transcript:', finalTranscript);
            
            if (finalTranscript) {
              setTranscript(finalTranscript);
              setIsListening(false);
              onResult(finalTranscript);
            }
          }
        }
      };

      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        let errorMessage = 'Speech recognition failed.';
        
        switch (event.error) {
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow microphone permissions and try again.';
            break;
          case 'no-speech':
            errorMessage = 'No speech detected. Please try speaking again.';
            break;
          case 'audio-capture':
            errorMessage = 'Microphone not available. Please check your microphone.';
            break;
          case 'network':
            errorMessage = 'Network error. Please check your connection.';
            break;
          case 'aborted':
            // Don't show error for aborted recognition
            return;
        }
        
        toast({
          title: "Speech Recognition Error",
          description: errorMessage,
          variant: "destructive"
        });
      };
      
      console.log('Speech recognition setup complete');
    } catch (error) {
      console.error('Error setting up speech recognition:', error);
      toast({
        title: "Setup Error",
        description: "Failed to initialize speech recognition.",
        variant: "destructive"
      });
    }
  }, [isSpeechRecognitionSupported, toast]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      console.error('Recognition not initialized');
      return;
    }
    
    if (isListening) {
      console.log('Already listening');
      return;
    }

    try {
      console.log('Starting speech recognition...');
      setTranscript('');
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
  }, [isListening, toast]);

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
    console.log('Speech recognition cleanup');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      } catch (error) {
        console.error('Error during recognition cleanup:', error);
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
