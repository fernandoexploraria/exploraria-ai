
import React, { useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { Button } from '@/components/ui/button';
import { Loader, Volume2, X } from 'lucide-react';
import { toast } from "sonner";

interface InfoPanelProps {
  landmark: Landmark | null;
  onClose: () => void;
  elevenLabsApiKey: string;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ landmark, onClose, elevenLabsApiKey }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayAudio = async () => {
    if (!elevenLabsApiKey || elevenLabsApiKey === 'YOUR_ELEVENLABS_API_KEY_HERE') {
      toast.error("Please provide the ElevenLabs API key to enable audio guides.");
      return;
    }
    if (landmark) {
      setIsPlaying(true);
      try {
        const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': elevenLabsApiKey,
          },
          body: JSON.stringify({
            text: landmark.description,
            model_id: 'eleven_multilingual_v2',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("ElevenLabs API error:", errorData);
          throw new Error(errorData.detail?.message || "Failed to fetch audio from ElevenLabs.");
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
          toast.error("Error playing audio.");
        }
        
        await audio.play();

      } catch (error) {
        console.error("Error playing audio:", error);
        toast.error(error instanceof Error ? error.message : "Failed to play audio. Check your API key and console for details.");
        setIsPlaying(false);
      }
    }
  };

  if (!landmark) return null;

  return (
    <div className={`absolute bottom-0 left-0 right-0 md:left-auto md:top-0 md:bottom-auto md:right-0 bg-background/80 backdrop-blur-sm p-6 m-4 rounded-lg shadow-2xl w-auto md:w-96 transform transition-transform duration-500 ease-in-out ${landmark ? 'translate-y-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}>
      <button onClick={onClose} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
        <X size={20} />
      </button>
      <h2 className="text-2xl font-bold mb-4 text-primary">{landmark.name}</h2>
      <p className="text-foreground/90 mb-6">{landmark.description}</p>
      
      <div className="space-y-4">
        <Button onClick={handlePlayAudio} className="w-full" disabled={!elevenLabsApiKey || elevenLabsApiKey === 'YOUR_ELEVENLABS_API_KEY_HERE' || isPlaying}>
          {isPlaying ? (
            <Loader className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Volume2 className="mr-2 h-4 w-4" />
          )}
          {isPlaying ? 'Loading...' : 'Listen to Guide'}
        </Button>
      </div>
    </div>
  );
};

export default InfoPanel;
