import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { CleanDialog, CleanDialogContent, CleanDialogHeader, CleanDialogTitle } from '@/components/ui/clean-dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Landmark } from '@/data/landmarks';
import { useConversation } from '@11labs/react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthProvider';
import { useContextualPOIPolling } from '@/hooks/useContextualPOIPolling';

interface NewTourAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voiceTourData?: { destination: string; systemPrompt: string; landmarks: any[] } | null;
  landmarks: Landmark[];
  onSessionStateChange?: (isActive: boolean, state: AssistantState) => void;
}

type AssistantState = 'not-started' | 'started' | 'listening' | 'recording' | 'playback';

const NewTourAssistant: React.FC<NewTourAssistantProps> = ({ 
  open, 
  onOpenChange, 
  voiceTourData,
  landmarks,
  onSessionStateChange
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [elevenLabsConfig, setElevenLabsConfig] = useState<{apiKey: string, agentId: string} | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [assistantState, setAssistantState] = useState<AssistantState>('not-started');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');

  // 🚀 IN-MEMORY STATE: Store destination and system prompt from voiceTourData
  const [destination, setDestination] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');

  // 🔄 INITIALIZE: Set destination and system prompt from voiceTourData on mount/change
  useEffect(() => {
    if (voiceTourData) {
      console.log('🎯 FRESH INSTANCE: Setting destination and system prompt from voiceTourData');
      setDestination(voiceTourData.destination);
      setSystemPrompt(voiceTourData.systemPrompt);
    }
  }, [voiceTourData]);

  // Initialize the conversation with enhanced error handling
  const conversation = useConversation({
    onConnect: () => {
      console.log('Successfully connected to ElevenLabs agent');
      setAssistantState('started');
      setIsSessionActive(true);
      setConnectionError(null);
      // toast({
      //   title: "Connected",
      //   description: "Tour guide is ready! Start speaking now.",
      // });
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs agent');
      setAssistantState('not-started');
      setIsSessionActive(false);
      setConversationId(''); // Clear conversation ID on disconnect
      onOpenChange(false); // Close dialog when conversation ends
      // toast({
      //   title: "Conversation Ended",
      //   description: "Your tour conversation has been saved.",
      // });
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
      setIsSessionActive(false);
    }
  });

  // Store conversation in ref to prevent callback recreation
  const conversationRef = useRef(conversation);
  
  // Update conversation ref when it changes
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // 🎯 NEW: Contextual POI polling system with direct ElevenLabs WebSocket access
  const handleContextualUpdate = useCallback((update: any) => {
    const currentConversation = conversationRef.current;
    if (!currentConversation || currentConversation.status !== 'connected') {
      console.log('⚠️ Skipping contextual update - conversation not connected');
      return;
    }

    // Get the most relevant POI (first one, as backend prioritizes by distance/relevance)
    const nearestPOI = update.pois[0];
    if (!nearestPOI) {
      console.log('⚠️ No POIs in contextual update, skipping');
      return;
    }

    // Enhanced POI fact generation for better context
    const primaryType = nearestPOI.types?.[0] || 'place';
    let poiFact = '';
    
    if (nearestPOI.rating && nearestPOI.userRatingsTotal) {
      poiFact = `Highly rated at ${nearestPOI.rating}/5 stars by ${nearestPOI.userRatingsTotal} visitors`;
    } else if (nearestPOI.rating) {
      poiFact = `Rated ${nearestPOI.rating}/5 stars by visitors`;
    } else if (nearestPOI.editorialSummary) {
      poiFact = nearestPOI.editorialSummary.length > 100 
        ? nearestPOI.editorialSummary.substring(0, 100) + '...'
        : nearestPOI.editorialSummary;
    } else {
      poiFact = `A notable ${primaryType} in the area worth exploring`;
    }
    
    // Format as structured JSON SYSTEM_ALERT per Gemini's improved specification
    const systemAlertMessage = `SYSTEM_ALERT: {"poi_name": "${nearestPOI.name}", "poi_type": "${primaryType}", "poi_fact": "${poiFact}", "poi_id": "${nearestPOI.place_id || nearestPOI.placeId || 'unknown'}"}`;

    console.log('📡 Sending SYSTEM_ALERT to ElevenLabs agent:', {
      poiName: nearestPOI.name,
      primaryType,
      distance: nearestPOI.distance,
      reason: update.updateReason,
      isInitialLocation: update.updateReason === 'initial_location'
    });

    // Send contextual update using direct WebSocket access as suggested
    try {
      // Type cast to access websocket property (may not be exposed in types)
      const conversationWithWS = currentConversation as any;
      
      // Check if WebSocket is available and open
      if (conversationWithWS.websocket && conversationWithWS.websocket.readyState === WebSocket.OPEN) {
        const contextualUpdateMessage = {
          type: 'contextual_update',
          text: systemAlertMessage
        };

        console.log('📡 Sending contextual_update via WebSocket:', contextualUpdateMessage);
        conversationWithWS.websocket.send(JSON.stringify(contextualUpdateMessage));
      } else {
        console.warn('⚠️ ElevenLabs conversation WebSocket not active. Cannot send contextual_update.');
        // Fallback: try SDK method if available
        if ((currentConversation as any).sendContextualUpdate) {
          (currentConversation as any).sendContextualUpdate(systemAlertMessage);
        }
      }
    } catch (error) {
      console.error('❌ Failed to send contextual update:', error);
    }
  }, []);

  // 🎯 RE-ENABLED: Contextual POI polling for location-aware conversations
  const { isPolling, lastUpdate, error: poiError } = useContextualPOIPolling({
    enabled: isSessionActive && conversation?.status === 'connected' && !!conversationId,
    pollInterval: 15000, // 15 seconds
    radius: 150, // 150 meters  
    maxResults: 3,
    onUpdate: handleContextualUpdate,
    conversationId
  });

  // Debug contextual POI polling
  useEffect(() => {
    console.log('🔍 Contextual POI polling state:', {
      isSessionActive,
      conversationStatus: conversation?.status,
      isPolling,
      lastUpdateTimestamp: lastUpdate?.timestamp,
      poiCount: lastUpdate?.pois?.length || 0,
      error: poiError
    });
  }, [isSessionActive, conversation?.status, isPolling, lastUpdate, poiError]);

  // Notify parent of session state changes
  useEffect(() => {
    if (onSessionStateChange) {
      onSessionStateChange(isSessionActive, assistantState);
    }
  }, [isSessionActive, assistantState, onSessionStateChange]);

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

    if (open || isSessionActive) {
      fetchConfig();
    }
  }, [open, isSessionActive]);

  // 🚀 PREPARE DYNAMIC VARIABLES: Use in-memory state for ElevenLabs agent
  const prepareDynamicVariables = () => {
    const variables = {
      geminiGenerated: systemPrompt,
      destination: destination,
      user_id: user?.id,
      landmark_count: landmarks.length,
      landmark_names: landmarks.map(l => l.name).join(', ')
    };
    
    console.log('🎯 IN-MEMORY: Dynamic variables prepared from component state:', {
      destination,
      hasSystemPrompt: !!systemPrompt,
      landmarkCount: landmarks.length
    });
    return variables;
  };

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
      setIsSessionActive(false);
    }
  }, [conversation.status, conversation.isSpeaking, assistantState]);

  const handleStartSession = async () => {
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
      
      const dynamicVariables = prepareDynamicVariables();
      
      console.log('Requesting microphone permission...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone permission granted');
      
      console.log('Starting session with dynamic variables...');
      const sessionConversationId = await conversation.startSession({ 
        agentId: elevenLabsConfig.agentId,
        dynamicVariables: dynamicVariables
      });
      
      console.log('ElevenLabs session started successfully:', sessionConversationId);
      setConversationId(sessionConversationId);
      
    } catch (error) {
      console.error('Error starting tour:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setConnectionError(errorMessage);
      
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
  };

  // Simplified dialog close handler - just closes the dialog, session continues
  const handleDialogClose = () => {
    console.log('Dialog closing - session remains active:', isSessionActive);
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

  // Show loading if configuration is being fetched
  if (isLoadingConfig) {
    return (
      <CleanDialog open={open} onOpenChange={handleDialogClose}>
        <CleanDialogContent className="sm:max-w-xs p-8 bg-transparent border-none shadow-none">
          <div className="bg-background rounded-lg p-6 border shadow-lg">
            <CleanDialogHeader>
              <CleanDialogTitle>Loading Tour Guide</CleanDialogTitle>
            </CleanDialogHeader>
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          </div>
        </CleanDialogContent>
      </CleanDialog>
    );
  }

  // Show error if configuration couldn't be loaded or there's a connection error  
  if (!elevenLabsConfig || connectionError) {
    return (
      <CleanDialog open={open} onOpenChange={handleDialogClose}>
        <CleanDialogContent className="sm:max-w-xs p-8 bg-transparent border-none shadow-none">
          <div className="bg-background rounded-lg p-6 border shadow-lg">
            <CleanDialogHeader>
              <CleanDialogTitle>Connection Error</CleanDialogTitle>
            </CleanDialogHeader>
            <div className="text-center space-y-4">
              <div className="text-red-500 text-sm">
                {connectionError || 'Connection Error'}
              </div>
              <Button
                onClick={() => {
                  setIsLoadingConfig(true);
                  setConnectionError(null);
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
          </div>
        </CleanDialogContent>
      </CleanDialog>
    );
  }

  return (
    <CleanDialog open={open} onOpenChange={handleDialogClose}>
      <CleanDialogContent className="sm:max-w-xs p-8 bg-transparent border-none shadow-none">
        <CleanDialogTitle className="sr-only">Tour Guide Assistant</CleanDialogTitle>
        <div className="flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div className={`w-48 h-48 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${getCircleColor()}`}>
              <Button
                onClick={assistantState === 'not-started' ? handleStartSession : () => {}}
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
      </CleanDialogContent>
    </CleanDialog>
  );
};

export default NewTourAssistant;
