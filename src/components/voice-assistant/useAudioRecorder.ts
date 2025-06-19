
import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const detectSilence = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
    const threshold = 10; // Silence threshold
    
    if (average < threshold) {
      // Start silence timer if not already started
      if (!silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          console.log('Silence detected, stopping recording');
          stopRecording();
        }, 2000); // Stop after 2 seconds of silence
      }
    } else {
      // Clear silence timer if user is speaking
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    }

    // Continue monitoring if still recording
    if (isRecording) {
      requestAnimationFrame(detectSilence);
    }
  }, [isRecording]);

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

      // Set up audio context for silence detection
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

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
        // Start silence detection
        detectSilence();
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped');
        setIsRecording(false);
        // Clean up
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
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
  }, [toast, detectSilence]);

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current || !isRecording) {
        reject(new Error('No active recording'));
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        console.log('Processing recorded audio...');
        setIsProcessing(true);
        
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
          console.log('Audio blob created, size:', audioBlob.size);
          
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

      mediaRecorderRef.current.stop();
    });
  }, [isRecording]);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, [isRecording]);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    cleanup
  };
};
