
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { OpenAIRealtimeChat } from '@/utils/OpenAIRealtimeChat';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthProvider';

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
  const { user } = useAuth();
  const [realtimeChat, setRealtimeChat] = useState<OpenAIRealtimeChat | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentUserInput, setCurrentUserInput] = useState<string>('');
  const [currentAssistantResponse, setCurrentAssistantResponse] = useState<string>('');

  // Store voice interaction in database
  const storeVoiceInteraction = async (userInput: string, assistantResponse: string) => {
    if (!user || !userInput.trim() || !assistantResponse.trim()) {
      console.log('Missing data for storing interaction:', { user: !!user, userInput: !!userInput, assistantResponse: !!assistantResponse });
      return;
    }

    try {
      console.log('Storing voice interaction...', { userInput: userInput.substring(0, 50), assistantResponse: assistantResponse.substring(0, 50) });
      
      const { error } = await supabase.functions.invoke('store-voice-interaction', {
        body: {
          userInput: userInput.trim(),
          assistantResponse: assistantResponse.trim(),
          destination
        }
      });

      if (error) {
        console.error('Error storing voice interaction:', error);
        // Don't show toast error to user as this is background functionality
      } else {
        console.log('Voice interaction stored successfully');
      }
    } catch (error) {
      console.error('Error storing voice interaction:', error);
    }
  };

  // Initialize connection when dialog opens
  useEffect(() => {
    if (open && !realtimeChat) {
      console.log('Dialog opened, initializing OpenAI Realtime connection...');
      setConnectionError(null);
      
      const chat = new OpenAIRealtimeChat(
        (connected) => {
          console.log('Connection status changed:', connected);
          setIsConnected(connected);
          if (!connected) {
            setConnectionError('Connection lost');
          }
        },
        (listening) => {
          console.log('Listening status changed:', listening);
          setIsListening(listening);
          if (listening) {
            // Reset current input when starting to listen
            setCurrentUserInput('');
          }
        },
        (speaking) => {
          console.log('Speaking status changed:', speaking);
          setIsSpeaking(speaking);
          if (!speaking && currentUserInput && currentAssistantResponse) {
            // Store interaction when assistant finishes speaking
            storeVoiceInteraction(currentUserInput, currentAssistantResponse);
            setCurrentUserInput('');
            setCurrentAssistantResponse('');
          }
        },
        // Add callbacks for capturing user input and assistant responses
        (userText) => {
          console.log('User input captured:', userText);
          setCurrentUserInput(userText);
        },
        (assistantText) => {
          console.log('Assistant response captured:', assistantText);
          setCurrentAssistantResponse(assistantText);
        }
      );
      
      setRealtimeChat(chat);
      
      chat.connect()
        .then(() => {
          console.log('Connected successfully, sending initial greeting...');
          setConnectionError(null);
          // Send initial greeting after connection
          setTimeout(() => {
            chat.sendInitialGreeting();
          }, 1000);
        })
        .catch((error) => {
          console.error('Failed to connect:', error);
          setConnectionError(error.message);
          toast({
            title: "Connection Error",
            description: `Could not connect to voice assistant: ${error.message}`,
            variant: "destructive"
          });
        });
    }
  }, [open, realtimeChat, toast, destination, user]);

  // Cleanup when dialog closes
  useEffect(() => {
    if (!open && realtimeChat) {
      console.log('Dialog closed, cleaning up connection...');
      // Store any pending interaction before cleanup
      if (currentUserInput && currentAssistantResponse) {
        storeVoiceInteraction(currentUserInput, currentAssistantResponse);
      }
      realtimeChat.disconnect();
      setRealtimeChat(null);
      setIsConnected(false);
      setIsListening(false);
      setIsSpeaking(false);
      setCurrentUserInput('');
      setCurrentAssistantResponse('');
    }
  }, [open, realtimeChat, currentUserInput, currentAssistantResponse]);

  const handleMicClick = async () => {
    console.log('Mic button clicked, current states:', { isConnected, isListening, isSpeaking });
    
    if (!realtimeChat || !isConnected) {
      console.log('Not ready to handle mic click');
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
          <DialogDescription className="text-center">
            Click the microphone to start a voice conversation with your AI tour guide. Get personalized recommendations and answers about {destination}.
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
          
          {!isConnected && !connectionError && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Connecting to assistant...
            </p>
          )}

          {connectionError && (
            <div className="mt-4 text-center">
              <p className="text-sm text-red-500 mb-2">
                Connection failed: {connectionError}
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setRealtimeChat(null);
                  setConnectionError(null);
                }}
              >
                Try Again
              </Button>
            </div>
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
