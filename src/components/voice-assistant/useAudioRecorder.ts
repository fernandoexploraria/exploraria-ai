
import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      console.log('Starting audio recording...');
      
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
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('Recording started');
        setIsRecording(true);
        
        // Auto-stop after 10 seconds max
        silenceTimeoutRef.current = setTimeout(() => {
          console.log('Auto-stopping recording after 10 seconds');
          if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
          }
        }, 10000);
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped');
        setIsRecording(false);
        
        // Clean up
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
      };

      mediaRecorder.start();
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current) {
        reject(new Error('No active recording'));
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

      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      } else {
        // Already stopped, process immediately
        mediaRecorderRef.current.onstop(new Event('stop'));
      }
    });
  }, []);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
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
