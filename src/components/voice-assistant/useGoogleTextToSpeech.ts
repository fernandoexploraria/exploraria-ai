
import { useState, useRef, useCallback } from 'react';

export const useGoogleTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const speakText = useCallback(async (text: string) => {
    try {
      console.log('Speaking text with Google Cloud TTS:', text.substring(0, 50) + '...');
      setIsSpeaking(true);
      
      // Stop any current audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      
      // Get Google Cloud API key from environment
      const googleApiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY;
      
      if (!googleApiKey) {
        console.error('No Google API key found');
        setIsSpeaking(false);
        return;
      }

      console.log('Using Google Cloud Text-to-Speech API...');
      
      // Call Google Cloud Text-to-Speech API
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Cloud TTS API error:', response.status, errorText);
        setIsSpeaking(false);
        return;
      }

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
        console.log('Google Cloud TTS audio started playing');
        setIsSpeaking(true);
      };
      
      audio.onended = () => {
        console.log('Google Cloud TTS audio ended');
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };
      
      audio.onerror = (error) => {
        console.error('Google Cloud TTS audio playback error:', error);
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      };
      
      // Play the audio
      try {
        await audio.play();
        console.log('Google Cloud TTS audio playing successfully');
      } catch (playError) {
        console.error('Error playing Google Cloud TTS audio:', playError);
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        currentAudioRef.current = null;
      }
    } catch (error) {
      console.error('Error with Google Cloud Text-to-Speech:', error);
      setIsSpeaking(false);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  return {
    isSpeaking,
    speakText,
    cleanup
  };
};
