
import { useState, useRef, useCallback } from 'react';

export const useGoogleTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const speakText = useCallback(async (text: string) => {
    try {
      console.log('Speaking text with Google TTS:', text.substring(0, 50) + '...');
      setIsSpeaking(true);
      
      // Stop any current audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      
      // Get Google Cloud API key from environment
      const googleApiKey = import.meta.env.VITE_GOOGLE_CLOUD_API_KEY;
      
      if (!googleApiKey) {
        console.log('No Google API key found, falling back to browser speech synthesis...');
        return fallbackToSpeechSynthesis(text);
      }

      console.log('Using Google Text-to-Speech API...');
      
      // Call Google Text-to-Speech API
      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: 'en-US',
            name: 'en-US-Journey-F',
            ssmlGender: 'FEMALE'
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0.0,
            volumeGainDb: 0.0
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const audioContent = data.audioContent;
        
        // Convert base64 to audio blob
        const audioBlob = new Blob([
          new Uint8Array(
            atob(audioContent)
              .split('')
              .map(char => char.charCodeAt(0))
          )
        ], { type: 'audio/mp3' });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        
        // Set up audio event handlers
        audio.onplay = () => {
          console.log('Google TTS audio started playing');
          setIsSpeaking(true);
        };
        
        audio.onended = () => {
          console.log('Google TTS audio ended');
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
        };
        
        audio.onerror = (error) => {
          console.error('Google TTS audio playback error:', error);
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          // Fallback to browser TTS
          fallbackToSpeechSynthesis(text);
        };
        
        // Play the audio
        try {
          await audio.play();
          console.log('Google TTS audio playing successfully');
        } catch (playError) {
          console.error('Error playing Google TTS audio:', playError);
          fallbackToSpeechSynthesis(text);
        }
      } else {
        console.error('Google TTS API error:', response.status, await response.text());
        fallbackToSpeechSynthesis(text);
      }
    } catch (error) {
      console.error('Error with Google Text-to-Speech:', error);
      fallbackToSpeechSynthesis(text);
    }
  }, []);

  const fallbackToSpeechSynthesis = useCallback((text: string) => {
    console.log('Using browser speech synthesis fallback...');
    
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (error) => {
      console.error('Speech synthesis error:', error);
      setIsSpeaking(false);
    };
    
    speechSynthesis.speak(utterance);
  }, []);

  const cleanup = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    speechSynthesis.cancel();
  }, []);

  return {
    isSpeaking,
    speakText,
    cleanup
  };
};
