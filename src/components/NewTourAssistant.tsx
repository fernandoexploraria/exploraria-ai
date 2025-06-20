import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Landmark } from '@/data/landmarks';
import { useConversation } from '@11labs/react';
import { supabase } from '@/integrations/supabase/client';

interface NewTourAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: string;
  landmarks: Landmark[];
}

const NewTourAssistant: React.FC<NewTourAssistantProps> = ({ 
  open, 
  onOpenChange, 
  destination, 
  landmarks 
}) => {
  const { toast } = useToast();
  const [elevenLabsConfig, setElevenLabsConfig] = useState<{apiKey: string, agentId: string} | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [conversationMessages, setConversationMessages] = useState<Array<{type: 'user' | 'assistant', text: string}>>([]);

  // Fetch ElevenLabs configuration from Supabase on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          toast({
            title: "Authentication Required",
            description: "Please sign in to use the tour guide.",
            variant: "destructive"
          });
          setIsLoadingConfig(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('get-elevenlabs-config', {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        });

        if (error) {
          console.error('Error fetching ElevenLabs config:', error);
          toast({
            title: "Configuration Error",
            description: "Failed to load tour guide configuration.",
            variant: "destructive"
          });
        } else {
          console.log('ElevenLabs config loaded:', data);
          setElevenLabsConfig(data);
        }
      } catch (error) {
        console.error('Error fetching config:', error);
        toast({
          title: "Error",
          description: "Failed to load tour guide configuration.",
          variant: "destructive"
        });
      } finally {
        setIsLoadingConfig(false);
      }
    };

    if (open) {
      fetchConfig();
    }
  }, [open, toast]);

  // Create dynamic prompt based on tour data
  const createTourPrompt = () => {
    const landmarkList = landmarks.map(l => l.name).join(', ');
    const landmarkDetails = landmarks.map(l => `${l.name}: ${l.description}`).join('\n');
    
    return `You are an expert tour guide for ${destination}. The user has planned to visit these landmarks: ${landmarkList}.

Here are details about each landmark:
${landmarkDetails}

Be enthusiastic, knowledgeable, and helpful. Provide interesting facts, tips, and recommendations. Keep your responses conversational and engaging, suitable for audio narration. Answer questions about the landmarks, provide historical context, suggest best times to visit, and share insider tips.`;
  };

  const firstMessage = `Welcome to ${destination}! I'm your personal AI tour guide, and I'm absolutely thrilled to help you explore this amazing destination. I see you're planning to visit ${landmarks.length} incredible landmarks. What would you like to know first? I can tell you about the best times to visit, share fascinating historical stories, or give you insider tips to make your trip unforgettable!`;

  // Initialize the conversation with dynamic configuration
  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs agent');
      toast({
        title: "Connected",
        description: "Connected to your tour guide!",
      });
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs agent');
      setHasStarted(false);
    },
    onMessage: (message) => {
      console.log('Received message:', message);
      if (message.source === 'ai') {
        setConversationMessages(prev => [...prev, { type: 'assistant', text: message.message }]);
      } else if (message.source === 'user') {
        setConversationMessages(prev => [...prev, { type: 'user', text: message.message }]);
      }
    },
    onError: (error) => {
      console.error('Conversation error:', error);
      toast({
        title: "Connection Error",
        description: "There was an issue with the tour guide connection.",
        variant: "destructive"
      });
    },
    overrides: {
      agent: {
        prompt: {
          prompt: createTourPrompt()
        },
        firstMessage: firstMessage,
        language: "en"
      }
    }
  });

  const handleStartTour = async () => {
    if (!elevenLabsConfig) {
      toast({
        title: "Configuration Error",
        description: "ElevenLabs configuration not available.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('Starting tour with config:', { agentId: elevenLabsConfig.agentId });
      
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Get a signed URL from ElevenLabs API for secure connection
      const signedUrlResponse = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${elevenLabsConfig.agentId}`, {
        method: 'GET',
        headers: {
          'xi-api-key': elevenLabsConfig.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!signedUrlResponse.ok) {
        throw new Error(`Failed to get signed URL: ${signedUrlResponse.statusText}`);
      }

      const signedUrlData = await signedUrlResponse.json();
      console.log('Got signed URL from ElevenLabs:', signedUrlData);
      
      // Start the conversation using the agent ID approach
      await conversation.startSession({ 
        agentId: elevenLabsConfig.agentId
      });
      
      setHasStarted(true);
      setConversationMessages([]);
      
    } catch (error) {
      console.error('Error starting tour:', error);
      toast({
        title: "Error",
        description: `Failed to start tour guide: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  const handleEndTour = async () => {
    try {
      await conversation.endSession();
      setHasStarted(false);
      setConversationMessages([]);
    } catch (error) {
      console.error('Error ending tour:', error);
    }
  };

  const handleClose = () => {
    if (hasStarted) {
      handleEndTour();
    }
    onOpenChange(false);
  };

  // Show loading if configuration is being fetched
  if (isLoadingConfig) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Loading Tour Guide...</DialogTitle>
            <DialogDescription>
              Setting up your personal tour guide...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show error if configuration couldn't be loaded
  if (!elevenLabsConfig) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configuration Error</DialogTitle>
            <DialogDescription>
              Unable to load tour guide configuration. Please try again later.
            </DialogDescription>
          </DialogHeader>
          
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              There was an issue loading the ElevenLabs configuration.
            </p>
            <Button
              onClick={handleClose}
              variant="outline"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {destination} Tour Guide
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Your AI-powered personal tour guide for {destination}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          {!hasStarted ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <div className="text-center mb-8">
                <h3 className="text-lg font-semibold mb-2">Ready to explore {destination}?</h3>
                <p className="text-muted-foreground mb-4">
                  I'm your personal tour guide ready to help you discover amazing places and share fascinating stories.
                </p>
                <p className="text-sm text-muted-foreground">
                  You have {landmarks.length} landmarks planned for your visit.
                </p>
              </div>
              
              <Button
                onClick={handleStartTour}
                disabled={conversation.status === 'connecting'}
                size="lg"
                className="bg-blue-500 hover:bg-blue-600"
              >
                {conversation.status === 'connecting' ? 'Connecting...' : 'Start Tour Guide'}
              </Button>
            </div>
          ) : (
            <>
              {/* Conversation History */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-3 min-h-0">
                {conversationMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${
                      message.type === 'user' 
                        ? 'bg-blue-100 ml-8 text-right' 
                        : 'bg-gray-100 mr-8'
                    }`}
                  >
                    <div className="text-sm font-medium mb-1">
                      {message.type === 'user' ? 'You' : 'Tour Guide'}
                    </div>
                    <div className="text-sm">{message.text}</div>
                  </div>
                ))}
              </div>

              {/* Voice Controls */}
              <div className="flex flex-col items-center space-y-4 py-4 border-t">
                <div className="flex items-center space-x-4">
                  <Button
                    size="lg"
                    className={`w-20 h-20 rounded-full transition-all duration-200 ${
                      conversation.isSpeaking 
                        ? 'bg-green-500 hover:bg-green-600 animate-pulse'
                        : conversation.status === 'connected'
                        ? 'bg-blue-500 hover:bg-blue-600'
                        : 'bg-gray-400'
                    }`}
                    disabled={conversation.status !== 'connected'}
                  >
                    {conversation.isSpeaking ? (
                      <Volume2 className="w-8 h-8" />
                    ) : (
                      <Mic className="w-8 h-8" />
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleEndTour}
                    variant="outline"
                    size="lg"
                  >
                    End Tour
                  </Button>
                </div>
                
                <div className="text-center text-sm text-muted-foreground">
                  {conversation.status === 'connecting' && "Connecting to tour guide..."}
                  {conversation.status === 'connected' && !conversation.isSpeaking && "Listening... Speak naturally with your tour guide"}
                  {conversation.status === 'connected' && conversation.isSpeaking && "Tour guide speaking..."}
                  {conversation.status === 'disconnected' && "Disconnected from tour guide"}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewTourAssistant;
