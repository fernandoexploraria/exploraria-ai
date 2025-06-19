
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mic, MicOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SimpleVoiceAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SimpleVoiceAssistant: React.FC<SimpleVoiceAssistantProps> = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (open && !isConnected) {
      connectToOpenAI();
    }
    
    return () => {
      cleanup();
    };
  }, [open]);

  const connectToOpenAI = async () => {
    try {
      console.log('Connecting to OpenAI Realtime API via Supabase...');
      
      // Get the session to include auth headers
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to use the voice assistant",
          variant: "destructive"
        });
        return;
      }

      // Create WebSocket connection with auth
      const wsUrl = `wss://ejqgdmbuabrcjxbhpxup.supabase.co/functions/v1/openai-realtime`;
      console.log('Connecting to:', wsUrl);
      
      const ws = new WebSocket(wsUrl, [], {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      ws.onopen = () => {
        console.log('Connected to OpenAI Realtime API');
        setIsConnected(true);
        
        toast({
          title: "Connected",
          description: "Rome expert is ready to help",
        });
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received:', data.type);
        
        if (data.type === 'response.audio.delta') {
          playAudioChunk(data.delta);
          setIsSpeaking(true);
        } else if (data.type === 'response.audio.done') {
          setIsSpeaking(false);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to voice assistant",
          variant: "destructive"
        });
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setIsListening(false);
        setIsSpeaking(false);
      };

      wsRef.current = ws;
      
    } catch (error) {
      console.error('Error connecting:', error);
      toast({
        title: "Error",
        description: "Failed to initialize voice assistant",
        variant: "destructive"
      });
    }
  };

  const playAudioChunk = async (base64Audio: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM16 to AudioBuffer
      const audioBuffer = audioContextRef.current.createBuffer(1, bytes.length / 2, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < channelData.length; i++) {
        const sample = (bytes[i * 2] | (bytes[i * 2 + 1] << 8));
        channelData[i] = sample / 32768.0;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
      
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 24000, channelCount: 1 }
      });
      
      streamRef.current = stream;
      setIsListening(true);
      
      // Send audio to OpenAI (simplified for now)
      toast({
        title: "Listening",
        description: "Voice recording started",
      });
      
    } catch (error) {
      console.error('Error starting microphone:', error);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone",
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

  const cleanup = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
  };

  const handleMicClick = () => {
    if (!isConnected) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Rome Expert Assistant
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
              Connecting to Rome expert...
            </p>
          )}
          
          {isConnected && isListening && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Listening... Click to stop.
            </p>
          )}
          
          {isConnected && isSpeaking && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Rome expert speaking...
            </p>
          )}

          {isConnected && !isListening && !isSpeaking && (
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
