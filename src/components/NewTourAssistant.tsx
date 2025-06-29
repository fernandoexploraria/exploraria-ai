import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Fetch ElevenLabs configuration from Supabase on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setConnectionError(null);
        
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) {
          setConnectionError("Please sign in to use the tour guide.");
          setIsLoadingConfig(false);
          return;
        }

        console.log('Fetching ElevenLabs configuration...');
        const { data, error } = await supabase.functions.invoke('get-elevenlabs-config', {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        });

        if (error) {
          console.error('Error fetching ElevenLabs config:', error);
          setConnectionError("Failed to load tour guide configuration.");
        } else {
          console.log('ElevenLabs config loaded successfully:', { agentId: data?.agentId ? 'Present' : 'Missing' });
          setElevenLabsConfig(data);
        }
      } catch (error) {
        console.error('Error fetching config:', error);
        setConnectionError("Failed to connect to tour guide service.");
      } finally {
        setIsLoadingConfig(false);
      }
    };

    if (open) {
      fetchConfig();
    }
  }, [open]);

  // Prepare dynamic variables for the ElevenLabs agent
  const prepareDynamicVariables = () => {
    const variables = {
      geminiGenerated: systemPrompt || `You are a knowledgeable tour guide for ${destination}. Provide engaging information about the following landmarks: ${landmarks.map(l => l.name).join(', ')}.`,
      destination: destination,
      user_id: user?.id,
      landmark_count: landmarks.length,
      landmark_names: landmarks.map(l => l.name).join(', ')
    };
    
    console.log('Dynamic variables prepared:', variables);
    return variables;
  };

  // Initialize the conversation with enhanced error handling
  const conversation = useConversation({
    onConnect: () => {
      console.log('Successfully connected to ElevenLabs agent');
      setAssistantState('started');
      setConnectionError(null);
      toast({
        title: "Connected",
        description: "Tour guide is ready! Start speaking now.",
      });
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs agent');
      setAssistantState('not-started');
      toast({
        title: "Conversation Ended",
        description: "Your tour conversation has been saved.",
      });
    },
    onMessage: (message) => {
      console.log('Received message:', message.source, message.message);
      if (message.source === 'ai') {
        setAssistantState('playback');
      } else if (message.source === 'user') {
        setAssistantState('recording');
      }
    },
    onError: (error) => {
      console.error('ElevenLabs conversation error:', error);
      setConnectionError(`Connection error: ${error}`);
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
    console.log('Conversation status changed:', conversation.status, 'isSpeaking:', conversation.isSpeaking);
    
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
        setConnectionError(null);
        console.log('Starting ElevenLabs conversation with agent:', elevenLabsConfig.agentId);
        
        // Prepare dynamic variables for this conversation
        const dynamicVariables = prepareDynamicVariables();
        
        // Request microphone permission first
        console.log('Requesting microphone permission...');
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone permission granted');
        
        // Start the conversation using the agent ID approach with dynamic variables
        console.log('Starting session with dynamic variables...');
        const conversationId = await conversation.startSession({ 
          agentId: elevenLabsConfig.agentId,
          dynamicVariables: dynamicVariables
        });
        
        console.log('ElevenLabs session started successfully:', conversationId);
        
      } catch (error) {
        console.error('Error starting tour:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setConnectionError(errorMessage);
        
        // Provide specific error messages based on error type
        let userMessage = "Failed to start tour guide.";
        if (errorMessage.includes('Permission denied')) {
          userMessage = "Microphone permission is required to use the tour guide.";
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          userMessage = "Network connection issue. Please check your internet and try again.";
        } else if (errorMessage.includes('agent')) {
          userMessage = "Tour guide service is temporarily unavailable.";
        }
        
        toast({
          title: "Error",
          description: userMessage,
          variant: "destructive"
        });
      }
    } else {
      // Double-click to end tour when active
      try {
        console.log('Ending ElevenLabs session...');
        await conversation.endSession();
        setAssistantState('not-started');
        setConnectionError(null);
      } catch (error) {
        console.error('Error ending tour:', error);
      }
    }
  };

  const handleClose = () => {
    if (assistantState !== 'not-started') {
      handleMainAction(); // End session
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
        return 'border-gray-600 bg-gray-200';
      case 'started':
        return 'border-yellow-400 bg-yellow-50 animate-pulse';
      case 'listening':
        return 'border-blue-500 bg-blue-50 animate-pulse';
      case 'recording':
        return 'border-red-500 bg-red-50 animate-pulse';
      case 'playback':
        return 'border-green-500 bg-green-50 animate-pulse';
      default:
        return 'border-gray-600 bg-gray-200';
    }
  };

  // Don't render anything if not open
  if (!open) {
    return null;
  }

  // Show loading if configuration is being fetched
  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show error if configuration couldn't be loaded or there's a connection error
  if (!elevenLabsConfig || connectionError) {
    return (
      <div className="text-center space-y-4">
        <div className="text-red-500 text-sm">Connection Error</div>
        <Button
          onClick={() => {
            setIsLoadingConfig(true);
            setConnectionError(null);
            // Retry configuration fetch
            const fetchConfig = async () => {
              try {
                const { data: session } = await supabase.auth.getSession();
                if (!session.session) {
                  setConnectionError("Please sign in to use the tour guide.");
                  return;
                }

                const { data, error } = await supabase.functions.invoke('get-elevenlabs-config', {
                  headers: {
                    Authorization: `Bearer ${session.session.access_token}`,
                  },
                });

                if (error) {
                  setConnectionError("Failed to load tour guide configuration.");
                } else {
                  setElevenLabsConfig(data);
                  setConnectionError(null);
                }
              } catch (error) {
                setConnectionError("Failed to connect to tour guide service.");
              } finally {
                setIsLoadingConfig(false);
              }
            };
            fetchConfig();
          }}
          disabled={isLoadingConfig}
          size="sm"
        >
          {isLoadingConfig ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Retry
            </>
          ) : (
            "Retry"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <div className="relative flex items-center justify-center">
        <div className={`w-48 h-48 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${getCircleColor()}`}>
          <Button
            onClick={handleMainAction}
            disabled={conversation.status === 'connecting' || assistantState === 'listening' || assistantState === 'recording'}
            variant="outline"
            className="text-lg font-semibold px-6 py-3 h-auto whitespace-normal text-center bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground"
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
    </div>
  );
};

export default NewTourAssistant;
