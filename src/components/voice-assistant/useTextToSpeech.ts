
import { useState, useRef, useCallback } from 'react';

export const useTextToSpeech = (elevenLabsApiKey: string, audioContextInitialized: boolean) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const speakText = useCallback(async (text: string) => {
    try {
      console.log('Speaking text:', text.substring(0, 50) + '...');
      setIsSpeaking(true);
      
      // Stop any current audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      
      // Check ElevenLabs API key
      if (!elevenLabsApiKey || elevenLabsApiKey === 'YOUR_ELEVENLABS_API_KEY') {
        console.log('Using browser speech synthesis...');
        
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (error) => {
          console.error('Speech synthesis error:', error);
          setIsSpeaking(false);
        };
        speechSynthesis.speak(utterance);
        return;
      }

      console.log('Using ElevenLabs API...');
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        
        // iOS-specific audio setup - must be done before play()
        audio.preload = 'auto';
        audio.muted = false;
        audio.volume = 1.0;
        
        // Critical for iOS: Set these properties immediately
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');
        
        // For iOS Safari, we need to ensure audio context is active
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
          console.log('iOS detected, managing audio context...');
          
          try {
            // Create or get existing audio context
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
              const audioContext = new AudioContext();
              
              // Resume if suspended
              if (audioContext.state === 'suspended') {
                await audioContext.resume();
                console.log('Audio context resumed for iOS');
              }
              
              // Connect audio element to context (iOS requirement)
              const source = audioContext.createMediaElementSource(audio);
              source.connect(audioContext.destination);
            }
          } catch (contextError) {
            console.log('Audio context setup failed, trying direct play:', contextError);
          }
        }
        
        // Set up event handlers before attempting to play
        audio.oncanplaythrough = () => {
          console.log('Audio can play through');
        };
        
        audio.onplay = () => {
          console.log('Audio started playing');
          setIsSpeaking(true);
        };
        
        audio.onended = () => {
          console.log('Audio ended');
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
        };
        
        audio.onerror = (error) => {
          console.error('Audio playback error:', error);
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          
          // Fallback to browser TTS
          console.log('Falling back to browser TTS');
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => setIsSpeaking(false);
          speechSynthesis.speak(utterance);
        };
        
        // Load the audio first
        audio.load();
        
        // For iOS, we need to play immediately after user interaction
        try {
          console.log('Attempting to play audio...');
          const playPromise = audio.play();
          
          if (playPromise !== undefined) {
            await playPromise;
            console.log('Audio play promise resolved');
          }
        } catch (playError) {
          console.error('Error playing audio:', playError);
          
          // For iOS, try one more time with a slight delay
          if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
            console.log('iOS play failed, trying with delay...');
            setTimeout(async () => {
              try {
                await audio.play();
                console.log('iOS delayed play successful');
              } catch (delayedError) {
                console.error('iOS delayed play also failed:', delayedError);
                // Final fallback to browser TTS
                setIsSpeaking(false);
                URL.revokeObjectURL(audioUrl);
                currentAudioRef.current = null;
                
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.onend = () => setIsSpeaking(false);
                speechSynthesis.speak(utterance);
              }
            }, 100);
          } else {
            // Non-iOS fallback
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            currentAudioRef.current = null;
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onend = () => setIsSpeaking(false);
            speechSynthesis.speak(utterance);
          }
        }
      } else {
        console.error('ElevenLabs API error:', response.status, await response.text());
        setIsSpeaking(false);
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setIsSpeaking(false);
        speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      setIsSpeaking(false);
      
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setIsSpeaking(false);
        speechSynthesis.speak(utterance);
      } catch (fallbackError) {
        console.error('Fallback TTS also failed:', fallbackError);
      }
    }
  }, [elevenLabsApiKey, audioContextInitialized]);

  const cleanup = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  }, []);

  return {
    isSpeaking,
    speakText,
    cleanup
  };
};
