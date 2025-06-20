
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
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

type AssistantState = 'not-started' | 'started' | 'listening' | 'recording' | 'playback';

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
  const [assistantState, setAssistantState] = useState<AssistantState>('not-started');

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
    // Add the API key to the configuration
    ...(elevenLabsConfig ? { apiKey: elevenLabsConfig.apiKey } : {}),
    onConnect: () => {
      console.log('Connected to ElevenLabs agent');
      setAssistantState('started');
      toast({
        title: "Connected",
        description: "Ready to listen! Start speaking now.",
      });
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs agent');
      setAssistantState('not-started');
    },
    onMessage: (message) => {
      console.log('Received message:', message);
      if (message.source === 'ai') {
        setAssistantState('playback');
      } else if (message.source === 'user') {
        setAssistantState('recording');
      }
    },
    onError: (error) => {
      console.error('Conversation error:', error);
      toast({
        title: "Connection Error",
        description: "There was an issue with the tour guide connection.",
        variant: "destructive"
      });
      setAssistantState('not-started');
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

  // Update state based on conversation status
  useEffect(() => {
    if (conversation.status === 'connected') {
      if (conversation.isSpeaking) {
        setAssistantState('playback');
      } else {
        setAssistantState('listening');
      }
    } else if (conversation.status === 'connecting') {
      setAssistantState('started');
    } else if (conversation.status === 'disconnected' && assistantState !== 'not-started') {
      setAssistantState('not-started');
    }
  }, [conversation.status, conversation.isSpeaking, assistantState]);

  const handleMainAction = async () => {
    if (assistantState === 'not-started') {
      // Start the conversation
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
        
        // Start the conversation using the agent ID approach
        await conversation.startSession({ 
          agentId: elevenLabsConfig.agentId
        });
        
      } catch (error) {
        console.error('Error starting tour:', error);
        toast({
          title: "Error",
          description: `Failed to start tour guide: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: "destructive"
        });
      }
    } else if (assistantState === 'playback') {
      // Interrupt playback - this would require additional conversation controls
      // For now, we'll just indicate the intent
      console.log('User wants to interrupt playback');
    }
  };

  const handleEndTour = async () => {
    try {
      await conversation.endSession();
      setAssistantState('not-started');
    } catch (error) {
      console.error('Error ending tour:', error);
    }
  };

  const handleClose = () => {
    if (assistantState !== 'not-started') {
      handleEndTour();
    }
    onOpenChange(false);
  };

  // Get button label based on state
  const getButtonLabel = () => {
    switch (assistantState) {
      case 'not-started':
        return 'Call Tour Guide';
      case 'started':
        return 'Talk to interrupt';
      case 'listening':
        return 'Listening';
      case 'recording':
        return 'Listening';
      case 'playback':
        return 'Talk to interrupt';
      default:
        return 'Call Tour Guide';
    }
  };

  // Get circle color based on state
  const getCircleColor = () => {
    switch (assistantState) {
      case 'not-started':
        return 'border-gray-300 bg-gray-50';
      case 'started':
        return 'border-yellow-400 bg-yellow-50 animate-pulse';
      case 'listening':
        return 'border-blue-500 bg-blue-50 animate-pulse';
      case 'recording':
        return 'border-red-500 bg-red-50 animate-pulse';
      case 'playback':
        return 'border-green-500 bg-green-50 animate-pulse';
      default:
        return 'border-gray-300 bg-gray-50';
    }
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {destination} Tour Guide
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Your AI-powered personal tour guide for {destination}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-8 space-y-6">
          {/* Main Circle with Button */}
          <div className="relative flex items-center justify-center">
            <div className={`w-48 h-48 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${getCircleColor()}`}>
              <Button
                onClick={handleMainAction}
                disabled={conversation.status === 'connecting' || assistantState === 'listening' || assistantState === 'recording'}
                variant="ghost"
                className="text-lg font-medium px-6 py-3 h-auto whitespace-normal text-center"
              >
                {conversation.status === 'connecting' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  getButtonLabel()
                )}
              </Button>
            </div>
            
            {/* Animated rings for active states */}
            {(assistantState === 'listening' || assistantState === 'recording' || assistantState === 'playback') && (
              <>
                <div className={`absolute inset-0 rounded-full border-2 animate-ping ${
                  assistantState === 'playback' ? 'border-green-400' : 
                  assistantState === 'recording' ? 'border-red-400' : 'border-blue-400'
                }`} style={{ animationDuration: '2s' }} />
                <div className={`absolute inset-4 rounded-full border-2 animate-ping ${
                  assistantState === 'playback' ? 'border-green-300' : 
                  assistantState === 'recording' ? 'border-red-300' : 'border-blue-300'
                }`} style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
              </>
            )}
          </div>
          
          {/* Status Text */}
          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              {assistantState === 'not-started' && `Ready to explore ${landmarks.length} landmarks`}
              {assistantState === 'started' && 'Connecting to your tour guide...'}
              {assistantState === 'listening' && 'Your tour guide is ready to listen'}
              {assistantState === 'recording' && 'Recording your question...'}
              {assistantState === 'playback' && 'Your tour guide is speaking...'}
            </div>
          </div>
          
          {/* End Tour Button - Only show when active */}
          {assistantState !== 'not-started' && (
            <Button
              onClick={handleEndTour}
              variant="outline"
              size="sm"
            >
              End Tour
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewTourAssistant;
