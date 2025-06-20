
import React, { useState, useRef, useEffect } from 'react';
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
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const handleConnectionChange = (connected: boolean) => {
    setIsConnected(connected);
    if (connected) {
      toast({
        title: "Connected",
        description: "Rome expert is ready to help",
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

  const { connected, connect, sendMessage, disconnect } = useOpenAIRealtime({
    onConnectionChange: handleConnectionChange,
    onSpeakingChange: handleSpeakingChange,
    onError: handleError
  });

  useEffect(() => {
    if (open && !connected) {
      console.log('🚀 Dialog opened, connecting...');
      connect();
    }
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [open, connected, connect]);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 24000, channelCount: 1 }
      });
      
      streamRef.current = stream;
      setIsListening(true);
      
      toast({
        title: "Listening",
        description: "Voice recording started - speak now",
      });
      
    } catch (error) {
      console.error('Error starting microphone:', error);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopListening = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsListening(false);
  };

  const handleMicClick = () => {
    if (!connected) {
      toast({
        title: "Not Connected",
        description: "Please wait for connection to be established",
        variant: "destructive"
      });
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleClose = () => {
    stopListening();
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
              Listening... Click to stop.
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
