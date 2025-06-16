
import React, { useState } from 'react';
import { X, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Landmark } from '@/data/landmarks';
import { SpeechSynthesis } from '@11labs/react';
import LandmarkTools from './LandmarkTools';

interface InfoPanelProps {
  landmark: Landmark | null;
  onClose: () => void;
  elevenLabsApiKey: string;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ landmark, onClose, elevenLabsApiKey }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!landmark) return null;

  return (
    <div className="absolute top-4 right-4 w-80 max-h-[calc(100vh-2rem)] bg-white rounded-lg shadow-xl z-10 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold truncate">{landmark.name}</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="overflow-y-auto max-h-[calc(100vh-8rem)]">
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">{landmark.description}</p>
          
          {elevenLabsApiKey && elevenLabsApiKey !== 'YOUR_ELEVENLABS_API_KEY' && (
            <div className="flex items-center gap-2">
              <SpeechSynthesis
                apiKey={elevenLabsApiKey}
                text={`${landmark.name}. ${landmark.description}`}
                voiceId="21m00Tcm4TlvDq8ikWAM"
              >
                {({ play, stop, isPlaying: playing }) => (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (playing) {
                        stop();
                        setIsPlaying(false);
                      } else {
                        play();
                        setIsPlaying(true);
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    {playing ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    {playing ? 'Stop' : 'Listen'}
                  </Button>
                )}
              </SpeechSynthesis>
            </div>
          )}
          
          <LandmarkTools landmark={landmark} />
        </div>
      </div>
    </div>
  );
};

export default InfoPanel;
