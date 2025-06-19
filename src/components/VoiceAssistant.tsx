import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Landmark } from '@/data/landmarks';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthProvider';
import AuthDialog from './AuthDialog';
import VoiceStatus from './voice-assistant/VoiceStatus';
import VoiceControls from './voice-assistant/VoiceControls';
import { useAudioContext } from './voice-assistant/useAudioContext';
import { useSpeechRecognition } from './voice-assistant/useSpeechRecognition';
import { useGoogleTextToSpeech } from './voice-assistant/useGoogleTextToSpeech';
import { useGeminiAPI } from '@/hooks/useGeminiAPI';

interface VoiceAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: string;
  landmarks: Landmark[];
  perplexityApiKey: string;
  elevenLabsApiKey: string;
  onAddLandmarks?: (newLandmarks: Landmark[]) => void;
}

interface LandmarkSuggestion {
  name: string;
  coordinates: [number, number];
  description: string;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  open,
  onOpenChange,
  destination,
  landmarks,
  onAddLandmarks
}) => {
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [suggestedLandmarks, setSuggestedLandmarks] = useState<LandmarkSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { toast } = useToast();
  const { user, session } = useAuth();
  const { callGemini } = useGeminiAPI();

  const { audioContextInitialized, initializeAudioContext } = useAudioContext();
  const { 
    isListening, 
    transcript, 
    isSpeechRecognitionSupported, 
    setupRecognition, 
    startListening, 
    stopListening, 
    cleanup: cleanupRecognition 
  } = useSpeechRecognition();
  const { isSpeaking, speakText, cleanup: cleanupTTS } = useGoogleTextToSpeech();

  // Check authentication when dialog opens
  useEffect(() => {
    if (open && !user) {
      console.log('Voice assistant opened but user not authenticated, showing auth dialog');
      setShowAuthDialog(true);
      onOpenChange(false);
    }
  }, [open, user, onOpenChange]);

  // Setup speech recognition when dialog opens
  useEffect(() => {
    console.log('VoiceAssistant mounted with props:', {
      open,
      destination,
      landmarksCount: landmarks.length,
      hasPerplexityKey: !!perplexityApiKey,
      hasElevenLabsKey: !!elevenLabsApiKey,
      speechRecognitionSupported: isSpeechRecognitionSupported,
      userAuthenticated: !!user,
      sessionExists: !!session
    });

    if (open && isSpeechRecognitionSupported) {
      setupRecognition(handleUserInput);
    }

    return () => {
      console.log('VoiceAssistant cleanup');
      cleanupRecognition();
      cleanupTTS();
    };
  }, [open, isSpeechRecognitionSupported, setupRecognition, cleanupRecognition, cleanupTTS]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setHasUserInteracted(false);
      cleanupTTS();
      cleanupRecognition();
    }
  }, [open, cleanupTTS, cleanupRecognition]);

  const extractLandmarkSuggestions = (aiResponse: string): LandmarkSuggestion[] => {
    // Look for JSON-formatted landmark suggestions in the response
    const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      try {
        const suggestions = JSON.parse(jsonMatch[0]);
        return suggestions.filter((s: any) => 
          s.name && s.coordinates && Array.isArray(s.coordinates) && s.description
        );
      } catch (error) {
        console.log('Could not parse landmark suggestions from AI response');
      }
    }
    return [];
  };

  const storeInteraction = async (userInput: string, assistantResponse: string) => {
    try {
      console.log('Attempting to store interaction...', { userInput, assistantResponse, destination });
      
      if (!user || !session) {
        console.log('No authenticated user found');
        toast({
          title: "Authentication Required",
          description: "Please log in to save your conversations.",
          variant: "destructive"
        });
        return;
      }

      console.log('User authenticated, calling edge function...');

      const { data, error } = await supabase.functions.invoke('store-voice-interaction', {
        body: {
          userInput,
          assistantResponse,
          destination
        }
      });

      if (error) {
        console.error('Error storing voice interaction:', error);
        toast({
          title: "Storage Error",
          description: "Couldn't save conversation. Please try again.",
          variant: "destructive"
        });
      } else {
        console.log('Voice interaction stored successfully:', data);
        toast({
          title: "Conversation Saved",
          description: "Your interaction has been saved.",
        });
      }
    } catch (error) {
      console.error('Unexpected error storing interaction:', error);
      toast({
        title: "Storage Error",
        description: "An unexpected error occurred while saving.",
        variant: "destructive"
      });
    }
  };

  const handleStartListening = async () => {
    if (!isSpeechRecognitionSupported) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in this browser.",
        variant: "destructive"
      });
      return;
    }

    if (!audioContextInitialized) {
      await initializeAudioContext();
    }

    if (!isSpeaking) {
      startListening();
    }
  };

  const handleUserInput = async (input: string) => {
    console.log('Processing user input:', input);

    try {
      const landmarkNames = landmarks.map(l => l.name).join(', ');
      
      const systemInstruction = `You are an enthusiastic, knowledgeable tour guide for ${destination}. Always provide engaging, conversational responses with follow-up questions.`;
      
      const prompt = `The user is asking: "${input}". 

Available landmarks in their current tour: ${landmarkNames}

As an engaging tour guide, you should:
1. Answer their question with interesting stories and context
2. Suggest 2-3 additional related landmarks or hidden gems they might enjoy
3. Provide practical tips (best times to visit, photography spots, local insights)
4. Ask a follow-up question to keep the conversation flowing
5. If suggesting new landmarks, format them as JSON at the end like this:
[{"name": "Landmark Name", "coordinates": [longitude, latitude], "description": "Brief description"}]

Keep your main response conversational and under 200 words, then add the JSON suggestions if any. Speak as if you're a passionate local who loves sharing hidden gems and stories about ${destination}.`;

      console.log('Calling Gemini API...');
      
      const aiResponse = await callGemini(prompt, systemInstruction);
      
      if (!aiResponse) {
        const errorResponse = "I'm sorry, I couldn't process your question right now. Please try again.";
        await speakText(errorResponse);
        await storeInteraction(input, errorResponse);
        return;
      }

      console.log('Got AI response:', aiResponse);
      
      // Extract landmark suggestions
      const suggestions = extractLandmarkSuggestions(aiResponse);
      if (suggestions.length > 0) {
        setSuggestedLandmarks(suggestions);
        setShowSuggestions(true);
      }
      
      // Clean response for speech (remove JSON part)
      const cleanResponse = aiResponse.replace(/\[[\s\S]*?\]/, '').trim();
      
      await speakText(cleanResponse);
      await storeInteraction(input, aiResponse);
      
      // Ask if they want to add suggestions after speaking
      if (suggestions.length > 0) {
        setTimeout(async () => {
          const addQuestion = `I found ${suggestions.length} additional interesting spots. Would you like me to add them to your map?`;
          await speakText(addQuestion);
        }, 1000);
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorResponse = "I'm sorry, I encountered an error. Please try asking again.";
      await speakText(errorResponse);
      await storeInteraction(input, errorResponse);
    }
  };

  const handleAddSuggestedLandmarks = async () => {
    if (!onAddLandmarks || suggestedLandmarks.length === 0) return;
    
    const newLandmarks: Landmark[] = suggestedLandmarks.map(suggestion => ({
      id: `suggested-${crypto.randomUUID()}`,
      name: suggestion.name,
      coordinates: suggestion.coordinates,
      description: suggestion.description
    }));
    
    onAddLandmarks(newLandmarks);
    setShowSuggestions(false);
    setSuggestedLandmarks([]);
    
    toast({
      title: "Landmarks Added!",
      description: `Added ${newLandmarks.length} new landmarks to your map.`,
    });
    
    await speakText(`Great! I've added ${newLandmarks.length} new landmarks to your map. You can now explore them!`);
  };

  const handleDeclineSuggestions = async () => {
    setShowSuggestions(false);
    setSuggestedLandmarks([]);
    await speakText("No problem! Feel free to ask me anything else about your tour.");
  };

  const handleWelcomeClick = async () => {
    console.log('Welcome button clicked');
    setHasUserInteracted(true);
    
    await initializeAudioContext();
    
    const welcomeMessage = `Welcome to your ${destination} tour! I'm your voice assistant powered by Google's advanced text-to-speech. You can ask me about any of the landmarks we've planned for you. What would you like to know?`;
    console.log('Playing welcome message:', welcomeMessage);
    
    try {
      await speakText(welcomeMessage);
      console.log('Welcome message completed');
    } catch (error) {
      console.error('Error playing welcome message:', error);
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthDialog(false);
    setTimeout(() => {
      onOpenChange(true);
    }, 100);
  };

  return (
    <>
      <AuthDialog
        open={showAuthDialog}
        onOpenChange={(open) => {
          setShowAuthDialog(open);
          if (!open && user) {
            handleAuthSuccess();
          }
        }}
      />
      
      <Dialog open={open && !!user} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Voice Tour Guide</DialogTitle>
            <DialogDescription>
              Ask me anything about your {destination} tour! I'll share stories, tips, and suggest additional places you might love.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-6 py-8">
            <div className="flex flex-col items-center space-y-4">
              <VoiceStatus
                isListening={isListening}
                isSpeaking={isSpeaking}
                hasUserInteracted={hasUserInteracted}
              />

              <p className="text-center text-sm font-medium">
                {isSpeaking ? 'Speaking...' : 
                 isListening ? 'Listening...' : 
                 hasUserInteracted ? 'Click to speak' : 'Ready to start'}
              </p>

              <VoiceControls
                isListening={isListening}
                isSpeaking={isSpeaking}
                hasUserInteracted={hasUserInteracted}
                isSpeechRecognitionSupported={isSpeechRecognitionSupported}
                onStartListening={handleStartListening}
                onStopListening={stopListening}
                onWelcomeClick={handleWelcomeClick}
              />

              {transcript && (
                <div className="text-center max-w-sm">
                  <p className="text-xs text-muted-foreground mb-1">You said:</p>
                  <p className="text-sm italic">"{transcript}"</p>
                </div>
              )}
            </div>

            {showSuggestions && suggestedLandmarks.length > 0 && (
              <div className="w-full space-y-3 border-t pt-4">
                <h4 className="font-medium text-center">Suggested Landmarks</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {suggestedLandmarks.map((landmark, index) => (
                    <div key={index} className="text-xs p-2 bg-muted rounded">
                      <strong>{landmark.name}</strong>
                      <p className="text-muted-foreground">{landmark.description}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleAddSuggestedLandmarks}
                    className="flex-1"
                    size="sm"
                  >
                    Add to Map
                  </Button>
                  <Button 
                    onClick={handleDeclineSuggestions}
                    variant="outline"
                    className="flex-1"
                    size="sm"
                  >
                    No Thanks
                  </Button>
                </div>
              </div>
            )}

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                {hasUserInteracted 
                  ? "Ask me about landmarks, local tips, or hidden gems!"
                  : "Click 'Start Tour Guide' to begin your interactive tour experience"
                }
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VoiceAssistant;
