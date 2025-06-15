
import React, { useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConversation } from '@11labs/react';
import { Volume2, X } from 'lucide-react';
import { toast } from "sonner";

interface InfoPanelProps {
  landmark: Landmark | null;
  onClose: () => void;
  elevenLabsApiKey: string;
  setElevenLabsApiKey: (key: string) => void;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ landmark, onClose, elevenLabsApiKey, setElevenLabsApiKey }) => {
  const { play } = useConversation({
    voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel
    model: "eleven_multilingual_v2",
  });
  
  const handlePlayAudio = async () => {
    if (!elevenLabsApiKey) {
      toast.error("Please enter your ElevenLabs API key.");
      return;
    }
    if (landmark) {
      try {
        await play({ text: landmark.description, apiKey: elevenLabsApiKey });
      } catch (error) {
        console.error("Error playing audio:", error);
        toast.error("Failed to play audio. Check your API key and console for details.");
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
        <div>
          <Label htmlFor="elevenlabs-key">ElevenLabs API Key</Label>
          <Input 
            id="elevenlabs-key" 
            type="password" 
            placeholder="Enter your API key to enable audio" 
            value={elevenLabsApiKey}
            onChange={(e) => setElevenLabsApiKey(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button onClick={handlePlayAudio} className="w-full" disabled={!elevenLabsApiKey}>
          <Volume2 className="mr-2 h-4 w-4" />
          Listen to Guide
        </Button>
      </div>
    </div>
  );
};

export default InfoPanel;
