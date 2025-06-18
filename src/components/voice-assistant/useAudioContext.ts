
import { useRef, useState } from 'react';

export const useAudioContext = () => {
  const [audioContextInitialized, setAudioContextInitialized] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const initializeAudioContext = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('Audio context created');
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('Audio context resumed');
      }
      
      setAudioContextInitialized(true);
      return true;
    } catch (error) {
      console.error('Error initializing audio context:', error);
      return false;
    }
  };

  return {
    audioContextInitialized,
    initializeAudioContext
  };
};
