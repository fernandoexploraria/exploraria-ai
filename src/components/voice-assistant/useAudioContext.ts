
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
      
      // For iOS, we also need to create a brief audio buffer to unlock audio
      try {
        const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.start();
        console.log('iOS audio unlock buffer played');
      } catch (unlockError) {
        console.log('Audio unlock buffer failed, but continuing:', unlockError);
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
