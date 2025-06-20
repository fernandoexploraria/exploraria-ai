
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Mic, MicOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOpenAIRealtime } from '@/hooks/useOpenAIRealtime';

interface SimpleVoiceAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SimpleVoiceAssistant: React.FC<SimpleVoiceAssistantProps> = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleConnectionChange = (connected: boolean) => {
    setIsConnected(connected);
    if (connected) {
      toast({
        title: "Connected",
        description: "Rome expert is ready to help",
      });
    } else {
      toast({
        title: "Disconnected",
        description: "Connection to Rome expert lost",
        variant: "destructive"
      });
    }
  };

  const handleSpeakingChange = (speaking: boolean) => {
    setIsSpeaking(speaking);
  };

  const handleError = (error: string) => {
    toast({
      title: "Error",
      description: error,
      variant: "destructive"
    });
  };

  const { connected, isListening, connect, startListening, stopListening, disconnect } = useOpenAIRealtime({
    onConnectionChange: handleConnectionChange,
    onSpeakingChange: handleSpeakingChange,
    onError: handleError
  });

  useEffect(() => {
    if (open && !connected) {
      console.log('🚀 Dialog opened, connecting...');
      connect();
    }
  }, [open, connected, connect]);

  const handleMicClick = async () => {
    if (!connected) {
      toast({
        title: "Not Connected",
        description: "Please wait for connection to be established",
        variant: "destructive"
      });
      return;
    }

    if (isListening) {
      console.log('Stopping listening...');
      stopListening();
      toast({
        title: "Stopped Listening",
        description: "Processing your message...",
      });
    } else {
      console.log('Starting listening...');
      await startListening();
      toast({
        title: "Listening",
        description: "Voice recording started - speak now",
      });
    }
  };

  const handleClose = () => {
    if (isListening) {
      stopListening();
    }
    disconnect();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Rome Expert Assistant
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Your AI-powered Rome travel guide. Click the microphone to ask questions about Rome's attractions, history, and travel tips.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-16">
          <Button
            size="lg"
            className={`w-24 h-24 rounded-full transition-all duration-200 hover:scale-105 ${
              isListening 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                : isSpeaking
                ? 'bg-green-500 hover:bg-green-600 animate-pulse'
                : connected
                ? 'bg-primary hover:bg-primary/90'
                : 'bg-gray-400'
            }`}
            onClick={handleMicClick}
            disabled={!connected || isSpeaking}
          >
            {isListening ? (
              <MicOff className="w-12 h-12" />
            ) : (
              <Mic className="w-12 h-12" />
            )}
          </Button>
          
          {!connected && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Connecting to Rome expert...
            </p>
          )}
          
          {connected && isListening && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Listening... Click to stop and process.
            </p>
          )}
          
          {connected && isSpeaking && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Rome expert speaking...
            </p>
          )}

          {connected && !isListening && !isSpeaking && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Click microphone to ask about Rome
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleVoiceAssistant;
