import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { CleanDialog, CleanDialogContent, CleanDialogHeader, CleanDialogTitle } from '@/components/ui/clean-dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Landmark } from '@/data/landmarks';
import { useConversation } from '@11labs/react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthProvider';
import { useTourDetails } from '@/hooks/useTourDetails';
import { useContextualPOIPolling } from '@/hooks/useContextualPOIPolling';

interface NewTourAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: string;
  landmarks: Landmark[];
  systemPrompt?: string;
  onSessionStateChange?: (isActive: boolean, state: AssistantState) => void;
}

type AssistantState = 'not-started' | 'started' | 'listening' | 'recording' | 'playback';

const NewTourAssistant: React.FC<NewTourAssistantProps> = ({ 
  open, 
  onOpenChange, 
  destination: fallbackDestination, 
  landmarks,
  systemPrompt: fallbackSystemPrompt,
  onSessionStateChange
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [elevenLabsConfig, setElevenLabsConfig] = useState<{apiKey: string, agentId: string} | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [assistantState, setAssistantState] = useState<AssistantState>('not-started');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);

  // 🔥 RE-ENABLED: Tour details hook for database fetching
  const { tourDetails, isLoading: isFetchingTourDetails, error: tourDetailsError } = useTourDetails(landmarks);

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

  // 🎯 NEW: Contextual POI polling system with direct ElevenLabs WebSocket access
  const handleContextualUpdate = useCallback((update: any) => {
    if (!conversation || conversation.status !== 'connected') {
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
      reason: update.updateReason
    });

    // Send contextual update using direct WebSocket access as suggested
    try {
      // Type cast to access websocket property (may not be exposed in types)
      const conversationWithWS = conversation as any;
      
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
        if ((conversation as any).sendContextualUpdate) {
          (conversation as any).sendContextualUpdate(systemAlertMessage);
        }
      }
    } catch (error) {
      console.error('❌ Failed to send contextual update:', error);
    }
  }, [conversation]);

  // 🎯 RE-ENABLED: Contextual POI polling for location-aware conversations
  const { isPolling, lastUpdate, error: poiError } = useContextualPOIPolling({
    enabled: isSessionActive && conversation?.status === 'connected',
    pollInterval: 15000, // 15 seconds
    radius: 150, // 150 meters  
    maxResults: 3,
    onUpdate: handleContextualUpdate
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

  // 🔥 ENHANCED: Get effective destination and system prompt with proper priority
  const getEffectiveDestination = () => {
    // Priority: 1. Database tour details, 2. Prop destination, 3. Generated fallback
    if (tourDetails?.destination) {
      console.log('🎯 Using destination from database:', tourDetails.destination);
      return tourDetails.destination;
    }
    
    if (fallbackDestination && fallbackDestination.trim()) {
      console.log('🎯 Using fallback destination from props:', fallbackDestination);
      return fallbackDestination;
    }
    
    if (landmarks.length > 0) {
      const generatedDestination = `Tour of ${landmarks.length} amazing places`;
      console.log('🎯 Using generated destination:', generatedDestination);
      return generatedDestination;
    }
    
    console.log('🎯 Using default destination: Smart Tour');
    return 'Smart Tour';
  };

  const getEffectiveSystemPrompt = () => {
    // Priority: 1. Database tour details, 2. Prop system prompt, 3. Generated fallback
    if (tourDetails?.systemPrompt) {
      console.log('🎯 Using system prompt from database (length:', tourDetails.systemPrompt.length, 'chars)');
      return tourDetails.systemPrompt;
    }
    
    if (fallbackSystemPrompt) {
      console.log('🎯 Using fallback system prompt from props');
      return fallbackSystemPrompt;
    }
    
    const effectiveDestination = getEffectiveDestination();
    const basePrompt = `You are a knowledgeable tour guide for ${effectiveDestination}. Provide engaging information about the following landmarks: ${landmarks.map(l => l.name).join(', ')}.`;
    
    // 🎯 NEW: Add contextual update snippet
    const contextualUpdateSnippet = `

CONTEXTUAL UPDATES: You will receive real-time updates about nearby points of interest as the user moves around. When you receive these updates, acknowledge them naturally and offer relevant information about nearby places when appropriate. The updates will include:
- nearby_pois: Array of places near the user's current location
- user_location: Current GPS coordinates
- update_reason: Why the update was triggered (location_change, scheduled_poll, manual_refresh)

Use this contextual information to enhance your tour guidance by mentioning relevant nearby places, suggesting detours, or providing location-specific insights.`;

    const generatedPrompt = basePrompt + contextualUpdateSnippet;
    console.log('🎯 Using generated system prompt with contextual updates');
    return generatedPrompt;
  };

  // Prepare dynamic variables for the ElevenLabs agent
  const prepareDynamicVariables = () => {
    const effectiveDestination = getEffectiveDestination();
    const effectiveSystemPrompt = getEffectiveSystemPrompt();
    
    const variables = {
      geminiGenerated: effectiveSystemPrompt,
      destination: effectiveDestination,
      user_id: user?.id,
      landmark_count: landmarks.length,
      landmark_names: landmarks.map(l => l.name).join(', ')
    };
    
    console.log('Dynamic variables prepared with database-sourced data:', {
      destination: effectiveDestination,
      hasSystemPrompt: !!effectiveSystemPrompt,
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
      const conversationId = await conversation.startSession({ 
        agentId: elevenLabsConfig.agentId,
        dynamicVariables: dynamicVariables
      });
      
      console.log('ElevenLabs session started successfully:', conversationId);
      
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

  // Show loading if configuration is being fetched or tour details are loading
  if (isLoadingConfig || isFetchingTourDetails) {
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
            {isFetchingTourDetails && (
              <div className="text-center text-sm text-muted-foreground">
                Fetching tour details from database...
              </div>
            )}
          </div>
        </CleanDialogContent>
      </CleanDialog>
    );
  }

  // Show error if configuration couldn't be loaded or there's a connection error
  if (!elevenLabsConfig || connectionError || tourDetailsError) {
    return (
      <CleanDialog open={open} onOpenChange={handleDialogClose}>
        <CleanDialogContent className="sm:max-w-xs p-8 bg-transparent border-none shadow-none">
          <div className="bg-background rounded-lg p-6 border shadow-lg">
            <CleanDialogHeader>
              <CleanDialogTitle>Connection Error</CleanDialogTitle>
            </CleanDialogHeader>
            <div className="text-center space-y-4">
              <div className="text-red-500 text-sm">
                {tourDetailsError ? `Tour Details Error: ${tourDetailsError}` : 'Connection Error'}
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
