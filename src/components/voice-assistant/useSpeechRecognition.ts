
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

    if (recognitionRef.current) {
      console.log('Recognition already exists');
      return;
    }

    try {
      console.log('Setting up speech recognition...');
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

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
        
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          toast({
            title: "Speech Recognition Error",
            description: "Please check your microphone and try again.",
            variant: "destructive"
          });
        }
      };
      
      console.log('Speech recognition setup complete');
    } catch (error) {
      console.error('Error setting up speech recognition:', error);
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
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      console.log('Stopping speech recognition...');
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const cleanup = useCallback(() => {
    console.log('Speech recognition cleanup');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      } catch (error) {
        console.error('Error during cleanup:', error);
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
