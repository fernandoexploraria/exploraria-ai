
import { useRef, useState } from 'react';

export const useAudioContext = () => {
  const [audioContextInitialized, setAudioContextInitialized] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const initializeAudioContext = async () => {
    try {
      console.log('Initializing audio context...');
      
      // Check if we're on iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      console.log('iOS detected:', isIOS);
      
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass();
          console.log('Audio context created, state:', audioContextRef.current.state);
        }
      }
      
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('Audio context resumed, new state:', audioContextRef.current.state);
      }
      
      // For iOS, create and play a silent buffer to unlock audio
      if (isIOS && audioContextRef.current) {
        try {
          console.log('Creating iOS audio unlock buffer...');
          
          // Create a very short silent buffer
          const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
          const source = audioContextRef.current.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContextRef.current.destination);
          
          // Start the silent sound
          source.start();
          
          console.log('iOS audio unlock buffer played successfully');
          
          // Also create a test audio element and play it briefly
          const testAudio = new Audio();
          testAudio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMbBziRwPLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMbBziRwPLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMbBziRwPLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMbBziRwPLNeSsFJHfH8N2QQAoUXrTp';
          testAudio.volume = 0.01; // Very quiet
          testAudio.preload = 'auto';
          
          try {
            await testAudio.play();
            testAudio.pause();
            console.log('iOS test audio played and paused successfully');
          } catch (testError) {
            console.log('iOS test audio failed, but continuing:', testError);
          }
          
        } catch (unlockError) {
          console.log('iOS audio unlock failed, but continuing:', unlockError);
        }
      }
      
      setAudioContextInitialized(true);
      console.log('Audio context initialization completed');
      return true;
    } catch (error) {
      console.error('Error initializing audio context:', error);
      setAudioContextInitialized(false);
      return false;
    }
  };

  return {
    audioContextInitialized,
    initializeAudioContext
  };
};
