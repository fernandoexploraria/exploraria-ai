
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { useGeminiAPI } from '@/hooks/useGeminiAPI';

interface VoiceAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: string;
  landmarks: Landmark[];
  onAddLandmarks?: (newLandmarks: Landmark[]) => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  open,
  onOpenChange,
  destination
}) => {
  const { callGemini, isLoading } = useGeminiAPI();

  const handleMicClick = async () => {
    console.log('Mic button clicked, sending Hi message');
    
    const systemInstruction = `You are a friendly tour guide assistant for ${destination}. Provide helpful information about landmarks, attractions, and travel tips. Keep responses conversational and engaging.`;
    
    const greeting = await callGemini("Hi", systemInstruction);
    
    if (greeting) {
      console.log('Assistant greeting:', greeting);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {destination} Tour Assistant
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-16">
          <Button
            size="lg"
            className="w-24 h-24 rounded-full bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105"
            onClick={handleMicClick}
            disabled={isLoading}
          >
            <Mic className="w-12 h-12" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceAssistant;
