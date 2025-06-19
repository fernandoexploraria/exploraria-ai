
import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      console.log('Starting audio recording...');
      
      // Stop any existing recording first
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        console.log('Stopping existing recording before starting new one');
        mediaRecorderRef.current.stop();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        } 
      });

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('Audio data available, size:', event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('MediaRecorder started');
        setIsRecording(true);
      };

      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped');
        setIsRecording(false);
        
        // Clean up stream immediately
        if (streamRef.current) {
          console.log('Stopping all audio tracks');
          streamRef.current.getTracks().forEach(track => {
            track.stop();
            console.log('Track stopped:', track.kind);
          });
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      cleanup(); // Ensure cleanup on error
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      console.log('stopRecording called');
      
      if (!mediaRecorderRef.current) {
        console.log('No active recording to stop');
        reject(new Error('No active recording'));
        return;
      }

      if (mediaRecorderRef.current.state !== 'recording') {
        console.log('MediaRecorder not in recording state:', mediaRecorderRef.current.state);
        reject(new Error('Not currently recording'));
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        console.log('Processing recorded audio...');
        setIsProcessing(true);
        
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
          console.log('Audio blob created, size:', audioBlob.size);
          
          if (audioBlob.size === 0) {
            throw new Error('No audio data recorded');
          }
          
          // Convert blob to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = (reader.result as string).split(',')[1];
            console.log('Audio converted to base64, length:', base64Audio.length);
            setIsProcessing(false);
            resolve(base64Audio);
          };
          reader.onerror = () => {
            console.error('Error converting audio to base64');
            setIsProcessing(false);
            reject(new Error('Failed to convert audio to base64'));
          };
          reader.readAsDataURL(audioBlob);
          
        } catch (error) {
          console.error('Error processing audio:', error);
          setIsProcessing(false);
          reject(error);
        }
      };

      console.log('Stopping MediaRecorder...');
      mediaRecorderRef.current.stop();
    });
  }, []);

  const cleanup = useCallback(() => {
    console.log('Cleaning up audio recorder');
    
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        console.log('Stopping recording during cleanup');
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }
    
    if (streamRef.current) {
      console.log('Stopping all tracks during cleanup');
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Track stopped during cleanup:', track.kind);
      });
      streamRef.current = null;
    }
    
    setIsRecording(false);
    setIsProcessing(false);
  }, []);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    cleanup
  };
};
