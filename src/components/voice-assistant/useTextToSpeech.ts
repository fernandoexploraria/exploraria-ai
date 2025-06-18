
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
        
        audio.preload = 'auto';
        
        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => {
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
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => setIsSpeaking(false);
          speechSynthesis.speak(utterance);
        };
        
        try {
          await audio.play();
        } catch (playError) {
          console.error('Error playing audio, falling back to browser TTS:', playError);
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => setIsSpeaking(false);
          speechSynthesis.speak(utterance);
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
  }, [elevenLabsApiKey]);

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
