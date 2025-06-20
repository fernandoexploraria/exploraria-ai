import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Landmark } from '@/data/landmarks';
import { useConversation } from '@11labs/react';
import { supabase } from '@/integrations/supabase/client';

interface NewTourAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: string;
  landmarks: Landmark[];
  systemPrompt?: string;
}

const NewTourAssistant: React.FC<NewTourAssistantProps> = ({ 
  open, 
  onOpenChange, 
  destination, 
  landmarks,
  systemPrompt 
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

  // Create dynamic prompt based on tour data (fallback if no systemPrompt provided)
  const createFallbackTourPrompt = () => {
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
        description: "Ready to listen! Start speaking now.",
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
          prompt: systemPrompt || createFallbackTourPrompt()
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

  // Helper function to get conversation status text and color
  const getConversationStatus = () => {
    if (conversation.status === 'connecting') {
      return { text: "Connecting to your tour guide...", color: "text-yellow-600", showPulse: true };
    }
    if (conversation.status === 'connected' && conversation.isSpeaking) {
      return { text: "🗣️ Tour guide is speaking...", color: "text-green-600", showPulse: true };
    }
    if (conversation.status === 'connected' && !conversation.isSpeaking) {
      return { text: "🎤 Listening - Start speaking now!", color: "text-blue-600", showPulse: true };
    }
    if (conversation.status === 'disconnected') {
      return { text: "Disconnected from tour guide", color: "text-gray-500", showPulse: false };
    }
    return { text: "Ready", color: "text-gray-600", showPulse: false };
  };

  const statusInfo = getConversationStatus();

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
                {conversation.status === 'connecting' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Start Tour Guide'
                )}
              </Button>
            </div>
          ) : (
            <>
              {/* Conversation History */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-3 min-h-0">
                {conversationMessages.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <p>Conversation will appear here as you chat with your tour guide.</p>
                  </div>
                )}
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

              {/* Voice Status and Controls */}
              <div className="flex flex-col items-center space-y-4 py-4 border-t">
                {/* Visual Microphone Indicator */}
                <div className="relative flex items-center justify-center">
                  <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${
                    conversation.status === 'connecting' ? 
                      'border-yellow-400 bg-yellow-50 animate-pulse' :
                    conversation.isSpeaking ? 
                      'border-green-500 bg-green-50 animate-pulse' : 
                    conversation.status === 'connected' ? 
                      'border-blue-500 bg-blue-50 animate-pulse' : 
                      'border-gray-300 bg-gray-50'
                  }`}>
                    {conversation.status === 'connecting' ? (
                      <Loader2 className="w-8 h-8 text-yellow-600 animate-spin" />
                    ) : conversation.isSpeaking ? (
                      <Volume2 className="w-8 h-8 text-green-600" />
                    ) : conversation.status === 'connected' ? (
                      <Mic className="w-8 h-8 text-blue-600" />
                    ) : (
                      <MicOff className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  
                  {/* Animated rings for active states */}
                  {(conversation.isSpeaking || (conversation.status === 'connected' && !conversation.isSpeaking)) && (
                    <>
                      <div className={`absolute inset-0 rounded-full border-2 animate-ping ${
                        conversation.isSpeaking ? 'border-green-400' : 'border-blue-400'
                      }`} style={{ animationDuration: '2s' }} />
                      <div className={`absolute inset-2 rounded-full border-2 animate-ping ${
                        conversation.isSpeaking ? 'border-green-300' : 'border-blue-300'
                      }`} style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                    </>
                  )}
                </div>
                
                {/* Status Text */}
                <div className="text-center">
                  <div className={`text-lg font-medium ${statusInfo.color} ${statusInfo.showPulse ? 'animate-pulse' : ''}`}>
                    {statusInfo.text}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {conversation.status === 'connected' && !conversation.isSpeaking && 
                      "Speak naturally - no need to hold any buttons!"
                    }
                    {conversation.status === 'connected' && conversation.isSpeaking && 
                      "Listening to your tour guide..."
                    }
                    {conversation.status === 'connecting' && 
                      "Setting up your personal tour guide..."
                    }
                  </div>
                </div>
                
                {/* End Tour Button */}
                <Button
                  onClick={handleEndTour}
                  variant="outline"
                  size="lg"
                  disabled={conversation.status === 'connecting'}
                >
                  End Tour
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewTourAssistant;
