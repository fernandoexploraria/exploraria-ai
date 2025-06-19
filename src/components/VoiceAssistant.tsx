
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { OpenAIRealtimeChat } from '@/utils/OpenAIRealtimeChat';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [realtimeChat, setRealtimeChat] = useState<OpenAIRealtimeChat | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Initialize connection when dialog opens
  useEffect(() => {
    if (open && !realtimeChat) {
      console.log('Dialog opened, initializing OpenAI Realtime connection...');
      
      const chat = new OpenAIRealtimeChat(
        setIsConnected,
        setIsListening,
        setIsSpeaking
      );
      
      setRealtimeChat(chat);
      
      chat.connect()
        .then(() => {
          console.log('Connected successfully, sending initial greeting...');
          // Send initial greeting after connection
          setTimeout(() => {
            chat.sendInitialGreeting();
          }, 1000);
        })
        .catch((error) => {
          console.error('Failed to connect:', error);
          toast({
            title: "Connection Error",
            description: "Could not connect to voice assistant. Please try again.",
            variant: "destructive"
          });
        });
    }
  }, [open, realtimeChat, toast]);

  // Cleanup when dialog closes
  useEffect(() => {
    if (!open && realtimeChat) {
      console.log('Dialog closed, cleaning up connection...');
      realtimeChat.disconnect();
      setRealtimeChat(null);
      setIsConnected(false);
      setIsListening(false);
      setIsSpeaking(false);
    }
  }, [open, realtimeChat]);

  const handleMicClick = async () => {
    if (!realtimeChat || !isConnected) {
      toast({
        title: "Not Connected",
        description: "Please wait for the connection to be established.",
        variant: "destructive"
      });
      return;
    }

    if (isListening) {
      console.log('Stopping listening...');
      realtimeChat.stopListening();
    } else {
      console.log('Starting listening...');
      try {
        await realtimeChat.startListening();
      } catch (error) {
        console.error('Error starting listening:', error);
        toast({
          title: "Microphone Error",
          description: "Could not access microphone. Please check permissions.",
          variant: "destructive"
        });
      }
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
            className={`w-24 h-24 rounded-full transition-all duration-200 hover:scale-105 ${
              isListening 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                : isSpeaking
                ? 'bg-green-500 hover:bg-green-600 animate-pulse'
                : isConnected
                ? 'bg-primary hover:bg-primary/90'
                : 'bg-gray-400'
            }`}
            onClick={handleMicClick}
            disabled={!isConnected || isSpeaking}
          >
            {isListening ? (
              <MicOff className="w-12 h-12" />
            ) : (
              <Mic className="w-12 h-12" />
            )}
          </Button>
          
          {!isConnected && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Connecting to assistant...
            </p>
          )}
          
          {isConnected && isListening && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Listening... Click to stop.
            </p>
          )}
          
          {isConnected && isSpeaking && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Assistant speaking...
            </p>
          )}

          {isConnected && !isListening && !isSpeaking && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Click microphone to start talking
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceAssistant;
