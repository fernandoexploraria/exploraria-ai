
import React, { useState } from 'react';
import { X, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Landmark } from '@/data/landmarks';
import LandmarkTools from './LandmarkTools';

interface InfoPanelProps {
  landmark: Landmark | null;
  onClose: () => void;
  elevenLabsApiKey: string;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ landmark, onClose, elevenLabsApiKey }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleTextToSpeech = async () => {
    if (!landmark || !elevenLabsApiKey || elevenLabsApiKey === 'YOUR_ELEVENLABS_API_KEY') {
      console.log('Missing landmark or API key');
      return;
    }

    try {
      setIsPlaying(true);
      console.log('Starting text-to-speech for:', landmark.name);
      
      // Use the ElevenLabs API directly
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey
        },
        body: JSON.stringify({
          text: `${landmark.name}. ${landmark.description}`,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });

      if (response.ok) {
        console.log('Audio response received');
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Set audio properties for better compatibility
        audio.preload = 'auto';
        audio.volume = 1.0;
        
        // iOS compatibility
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
          audio.setAttribute('playsinline', 'true');
          audio.setAttribute('webkit-playsinline', 'true');
        }
        
        // Event handlers
        audio.onloadeddata = () => {
          console.log('Audio loaded successfully');
        };
        
        audio.onplay = () => {
          console.log('Audio started playing');
          setIsPlaying(true);
        };
        
        audio.onended = () => {
          console.log('Audio playback ended');
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = (error) => {
          console.error('Audio playback error:', error);
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
          
          // Fallback to browser TTS
          console.log('Falling back to browser speech synthesis');
          const utterance = new SpeechSynthesisUtterance(`${landmark.name}. ${landmark.description}`);
          utterance.onend = () => setIsPlaying(false);
          speechSynthesis.speak(utterance);
        };
        
        // Load and play
        audio.load();
        
        try {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            await playPromise;
            console.log('Audio play promise resolved');
          }
        } catch (playError) {
          console.error('Play error, trying fallback:', playError);
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
          
          // Fallback to browser TTS
          const utterance = new SpeechSynthesisUtterance(`${landmark.name}. ${landmark.description}`);
          utterance.onend = () => setIsPlaying(false);
          speechSynthesis.speak(utterance);
        }
      } else {
        const errorText = await response.text();
        console.error('ElevenLabs API error:', response.status, errorText);
        setIsPlaying(false);
        
        // Fallback to browser TTS
        console.log('Using browser speech synthesis as fallback');
        const utterance = new SpeechSynthesisUtterance(`${landmark.name}. ${landmark.description}`);
        utterance.onend = () => setIsPlaying(false);
        speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      setIsPlaying(false);
      
      // Fallback to browser TTS
      try {
        console.log('Using browser speech synthesis as error fallback');
        const utterance = new SpeechSynthesisUtterance(`${landmark.name}. ${landmark.description}`);
        utterance.onend = () => setIsPlaying(false);
        speechSynthesis.speak(utterance);
      } catch (fallbackError) {
        console.error('Fallback TTS also failed:', fallbackError);
      }
    }
  };

  if (!landmark) return null;

  return (
    <div className="absolute top-4 right-4 w-80 max-h-[calc(100vh-2rem)] bg-white rounded-lg shadow-xl z-10 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <h2 className="text-lg font-semibold truncate text-gray-900">{landmark.name}</h2>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClose}
          className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-600 hover:text-gray-900 flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="overflow-y-auto max-h-[calc(100vh-8rem)]">
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">{landmark.description}</p>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTextToSpeech}
              disabled={isPlaying}
              className="flex items-center gap-2"
            >
              {isPlaying ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {isPlaying ? 'Playing...' : 'Listen'}
            </Button>
          </div>
          
          <LandmarkTools landmark={landmark} />
        </div>
      </div>
    </div>
  );
};

export default InfoPanel;
