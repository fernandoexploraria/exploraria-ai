
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
      return;
    }

    try {
      setIsPlaying(true);
      
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
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      } else {
        console.error('Error generating speech:', response.statusText);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      setIsPlaying(false);
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
          
          {elevenLabsApiKey && elevenLabsApiKey !== 'YOUR_ELEVENLABS_API_KEY' && (
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
          )}
          
          <LandmarkTools landmark={landmark} />
        </div>
      </div>
    </div>
  );
};

export default InfoPanel;
