import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Landmark } from '@/data/landmarks';
import { useConversation } from '@11labs/react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthProvider';

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
  const { user } = useAuth();
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

  // Prepare dynamic variables for the ElevenLabs agent
  const prepareDynamicVariables = () => {
    return {
      geminiGenerated: systemPrompt || `You are a knowledgeable tour guide for ${destination}. Provide engaging information about the following landmarks: ${landmarks.map(l => l.name).join(', ')}.`,
      destination: destination,
      user_id: user?.id // Pass user ID for webhook processing
    };
  };

  // Initialize the conversation with webhook support
  const conversation = useConversation({
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
      
      // Show success message when conversation ends
      toast({
        title: "Conversation Saved",
        description: "Your tour conversation has been processed and saved.",
      });
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

      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to use the tour guide.",
          variant: "destructive"
        });
        return;
      }

      try {
        console.log('Starting tour with config:', { agentId: elevenLabsConfig.agentId });
        
        // Prepare dynamic variables for this conversation
        const dynamicVariables = prepareDynamicVariables();
        console.log('Using dynamic variables:', dynamicVariables);
        
        // Request microphone permission first
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Start the conversation using the agent ID approach with dynamic variables
        await conversation.startSession({ 
          agentId: elevenLabsConfig.agentId,
          dynamicVariables: dynamicVariables
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

  // Get 3D bosu-like styling based on state
  const getBosuStyling = () => {
    const baseClasses = "relative w-48 h-48 rounded-full transition-all duration-500 transform-gpu";
    const shadowBase = "shadow-2xl";
    
    switch (assistantState) {
      case 'not-started':
        return `${baseClasses} ${shadowBase} 
                bg-gradient-to-br from-gray-300 via-gray-200 to-gray-400
                shadow-gray-400/50
                before:absolute before:inset-4 before:rounded-full 
                before:bg-gradient-to-tr before:from-white/60 before:via-transparent before:to-transparent
                after:absolute after:inset-8 after:rounded-full 
                after:bg-gradient-to-br after:from-transparent after:via-white/20 after:to-transparent
                hover:scale-105 hover:shadow-gray-500/60`;
      
      case 'started':
        return `${baseClasses} ${shadowBase} animate-pulse
                bg-gradient-to-br from-yellow-300 via-yellow-200 to-yellow-500
                shadow-yellow-400/60
                before:absolute before:inset-4 before:rounded-full 
                before:bg-gradient-to-tr before:from-white/70 before:via-transparent before:to-transparent
                after:absolute after:inset-8 after:rounded-full 
                after:bg-gradient-to-br after:from-transparent after:via-white/30 after:to-transparent
                scale-110 shadow-yellow-500/70`;
      
      case 'listening':
        return `${baseClasses} ${shadowBase} animate-pulse
                bg-gradient-to-br from-blue-400 via-blue-300 to-blue-600
                shadow-blue-500/70
                before:absolute before:inset-4 before:rounded-full 
                before:bg-gradient-to-tr before:from-white/80 before:via-transparent before:to-transparent
                after:absolute after:inset-8 after:rounded-full 
                after:bg-gradient-to-br after:from-transparent after:via-white/40 after:to-transparent
                scale-110 shadow-blue-600/80`;
      
      case 'recording':
        return `${baseClasses} ${shadowBase} animate-pulse
                bg-gradient-to-br from-red-400 via-red-300 to-red-600
                shadow-red-500/70
                before:absolute before:inset-4 before:rounded-full 
                before:bg-gradient-to-tr before:from-white/80 before:via-transparent before:to-transparent
                after:absolute after:inset-8 after:rounded-full 
                after:bg-gradient-to-br after:from-transparent after:via-white/40 after:to-transparent
                scale-110 shadow-red-600/80`;
      
      case 'playback':
        return `${baseClasses} ${shadowBase} animate-pulse
                bg-gradient-to-br from-green-400 via-green-300 to-green-600
                shadow-green-500/70
                before:absolute before:inset-4 before:rounded-full 
                before:bg-gradient-to-tr before:from-white/80 before:via-transparent before:to-transparent
                after:absolute after:inset-8 after:rounded-full 
                after:bg-gradient-to-br after:from-transparent after:via-white/40 after:to-transparent
                scale-110 shadow-green-600/80`;
      
      default:
        return `${baseClasses} ${shadowBase} 
                bg-gradient-to-br from-gray-300 via-gray-200 to-gray-400
                shadow-gray-400/50`;
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
            {systemPrompt && (
              <div className="mt-2 text-xs text-green-600 font-medium">
                ✨ Enhanced with AI-generated tour expertise
              </div>
            )}
            <div className="mt-2 text-xs text-blue-600 font-medium">
              🎙️ Conversations are automatically saved after each session
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-8 space-y-6">
          {/* 3D Bosu-like Circle with Button */}
          <div className="relative flex items-center justify-center">
            {/* Main 3D Bosu Ball */}
            <div className={getBosuStyling()}>
              {/* Center button area */}
              <div className="absolute inset-12 rounded-full flex items-center justify-center bg-gradient-to-br from-white/20 to-transparent backdrop-blur-sm">
                <Button
                  onClick={handleMainAction}
                  disabled={conversation.status === 'connecting' || assistantState === 'listening' || assistantState === 'recording'}
                  variant="ghost"
                  className="text-sm font-semibold px-4 py-2 h-auto whitespace-normal text-center bg-white/80 text-gray-800 border-0 hover:bg-white/90 rounded-full shadow-lg backdrop-blur-sm"
                >
                  {conversation.status === 'connecting' ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    getButtonLabel()
                  )}
                </Button>
              </div>
            </div>
            
            {/* Animated outer rings for active states */}
            {(assistantState === 'listening' || assistantState === 'recording' || assistantState === 'playback') && (
              <>
                <div className={`absolute inset-0 rounded-full border-2 animate-ping opacity-60 ${
                  assistantState === 'playback' ? 'border-green-400' : 
                  assistantState === 'recording' ? 'border-red-400' : 'border-blue-400'
                }`} style={{ animationDuration: '2s' }} />
                <div className={`absolute inset-4 rounded-full border-2 animate-ping opacity-40 ${
                  assistantState === 'playback' ? 'border-green-300' : 
                  assistantState === 'recording' ? 'border-red-300' : 'border-blue-300'
                }`} style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                <div className={`absolute inset-8 rounded-full border-1 animate-ping opacity-20 ${
                  assistantState === 'playback' ? 'border-green-200' : 
                  assistantState === 'recording' ? 'border-red-200' : 'border-blue-200'
                }`} style={{ animationDuration: '2s', animationDelay: '1s' }} />
              </>
            )}
          </div>
          
          {/* Status Text */}
          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              {assistantState === 'not-started' && ''}
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
