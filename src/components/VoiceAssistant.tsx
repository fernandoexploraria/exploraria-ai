
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthProvider';
import AuthDialog from './AuthDialog';
import VoiceStatus from './voice-assistant/VoiceStatus';
import VoiceControls from './voice-assistant/VoiceControls';
import { useAudioContext } from './voice-assistant/useAudioContext';
import { useGoogleSpeechRecognition } from './voice-assistant/useGoogleSpeechRecognition';
import { useGeminiAPI } from '@/hooks/useGeminiAPI';

interface VoiceAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: string;
  landmarks: Landmark[];
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
  const [textInput, setTextInput] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
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
    forceStopListening,
    cleanup: cleanupRecognition 
  } = useGoogleSpeechRecognition();

  // Stop speech recognition when TTS starts
  useEffect(() => {
    if (isSpeaking && isListening) {
      console.log('TTS started, stopping speech recognition to prevent interference');
      forceStopListening();
    }
  }, [isSpeaking, isListening, forceStopListening]);

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
      cleanup();
    };
  }, [open, isSpeechRecognitionSupported, setupRecognition, cleanupRecognition]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setHasUserInteracted(false);
      setTextInput('');
      cleanup();
      cleanupRecognition();
    }
  }, [open, cleanupRecognition]);

  const cleanup = () => {
    console.log('Cleaning up TTS');
    setIsSpeaking(false);
  };

  const speakText = async (text: string) => {
    try {
      console.log('Starting Gemini TTS for text:', text.substring(0, 100) + '...');
      setIsSpeaking(true);
      
      // Call Supabase edge function for Gemini-enhanced TTS
      console.log('Calling gemini-tts edge function...');
      const { data, error } = await supabase.functions.invoke('gemini-tts', {
        body: { text }
      });

      if (error) {
        console.error('Gemini TTS error:', error);
        setIsSpeaking(false);
        return;
      }

      console.log('TTS response received:', { 
        hasAudioContent: !!data?.audioContent, 
        fallbackToBrowser: data?.fallbackToBrowser,
        dataKeys: Object.keys(data || {}),
        audioContentLength: data?.audioContent?.length || 0
      });

      if (data?.audioContent && !data.fallbackToBrowser) {
        console.log('Playing audio from Gemini TTS, audio length:', data.audioContent.length);
        await playAudioFromBase64(data.audioContent);
      } else {
        console.log('No audio content received or fallback requested, data:', data);
        setIsSpeaking(false);
      }
      
    } catch (error) {
      console.error('Error with Gemini TTS:', error);
      setIsSpeaking(false);
    }
  };

  const playAudioFromBase64 = async (base64Audio: string) => {
    return new Promise<void>((resolve, reject) => {
      try {
        console.log('Converting base64 to audio blob, length:', base64Audio.length);
        
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          console.log('Audio playback ended');
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        
        audio.onerror = (error) => {
          console.error('Audio playback error:', error);
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          reject(error);
        };
        
        audio.play().then(() => {
          console.log('Audio.play() promise resolved successfully');
        }).catch(error => {
          console.error('Failed to play audio:', error);
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          reject(error);
        });
        
      } catch (error) {
        console.error('Error creating audio from base64:', error);
        setIsSpeaking(false);
        reject(error);
      }
    });
  };

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

  const cleanResponseForSpeech = (aiResponse: string): string => {
    console.log('Original AI response length:', aiResponse.length);
    console.log('Original AI response preview:', aiResponse.substring(0, 200) + '...');
    
    // Remove any JSON blocks (everything from [ to ])
    let cleanResponse = aiResponse.replace(/\[[\s\S]*?\]/g, '').trim();
    
    // Remove any remaining JSON artifacts or markdown code blocks
    cleanResponse = cleanResponse.replace(/```json[\s\S]*?```/g, '').trim();
    cleanResponse = cleanResponse.replace(/```[\s\S]*?```/g, '').trim();
    
    // Remove any trailing punctuation that might be left from JSON removal
    cleanResponse = cleanResponse.replace(/,\s*$/, '').trim();
    
    console.log('Cleaned response length:', cleanResponse.length);
    console.log('Cleaned response preview:', cleanResponse.substring(0, 200) + '...');
    
    // If cleaning resulted in empty or very short content, return a fallback
    if (!cleanResponse || cleanResponse.length < 10) {
      console.log('Cleaned response too short, using fallback');
      return `I have some information about ${destination} for you. Let me know what specific aspects you'd like to explore!`;
    }
    
    return cleanResponse;
  };

  const storeInteraction = async (userInput: string, assistantResponse: string) => {
    try {
      console.log('Attempting to store interaction...', { userInput, assistantResponse: assistantResponse.substring(0, 100) + '...', destination });
      
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
    if (!audioContextInitialized) {
      await initializeAudioContext();
    }

    if (!isSpeaking) {
      await startListening();
    }
  };

  const handleStopListening = async () => {
    await stopListening(handleUserInput);
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
        console.log('Speaking error response:', errorResponse);
        await speakText(errorResponse);
        await storeInteraction(input, errorResponse);
        return;
      }

      console.log('Got AI response:', aiResponse.substring(0, 200) + '...');
      
      // Extract landmark suggestions first
      const suggestions = extractLandmarkSuggestions(aiResponse);
      if (suggestions.length > 0) {
        setSuggestedLandmarks(suggestions);
        setShowSuggestions(true);
      }
      
      // Clean response for speech (remove JSON and other artifacts)
      const cleanResponse = cleanResponseForSpeech(aiResponse);
      
      console.log('Speaking cleaned response:', cleanResponse.substring(0, 100) + '...');
      await speakText(cleanResponse);
      await storeInteraction(input, aiResponse);
      
      // Ask if they want to add suggestions after speaking
      if (suggestions.length > 0) {
        setTimeout(async () => {
          const addQuestion = `I found ${suggestions.length} additional interesting spots. Would you like me to add them to your map?`;
          console.log('Speaking suggestion question:', addQuestion);
          await speakText(addQuestion);
        }, 1000);
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorResponse = "I'm sorry, I encountered an error. Please try asking again.";
      console.log('Speaking error response:', errorResponse);
      await speakText(errorResponse);
      await storeInteraction(input, errorResponse);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      console.log('Processing text input:', textInput);
      await handleUserInput(textInput.trim());
      setTextInput('');
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
    
    const welcomeMessage = `Welcome to your ${destination} tour! I'm your AI-powered voice assistant using advanced text-to-speech technology. You can hold the microphone button to ask me about any of the landmarks we've planned for you, or type your questions in the chat box below. I'll share fascinating stories, local insights, and hidden gems. What would you like to know?`;
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
              Hold the microphone button or type your questions to ask me anything about your {destination} tour! I'll share stories, tips, and suggest additional places you might love.
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
                 isListening ? 'Listening... (release to send)' : 
                 hasUserInteracted ? 'Hold to speak or type below' : 'Ready to start'}
              </p>

              <VoiceControls
                isListening={isListening}
                isSpeaking={isSpeaking}
                hasUserInteracted={hasUserInteracted}
                isSpeechRecognitionSupported={isSpeechRecognitionSupported}
                onStartListening={handleStartListening}
                onStopListening={handleStopListening}
                onWelcomeClick={handleWelcomeClick}
              />

              {transcript && (
                <div className="text-center max-w-sm">
                  <p className="text-xs text-muted-foreground mb-1">You said:</p>
                  <p className="text-sm italic">"{transcript}"</p>
                </div>
              )}
            </div>

            {/* Text Chat Input */}
            {hasUserInteracted && (
              <div className="w-full max-w-sm space-y-2">
                <p className="text-xs text-muted-foreground text-center">Or type your question:</p>
                <form onSubmit={handleTextSubmit} className="flex gap-2">
                  <Input
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Ask me about landmarks..."
                    disabled={isSpeaking}
                    className="flex-1"
                  />
                  <Button 
                    type="submit" 
                    size="sm" 
                    disabled={!textInput.trim() || isSpeaking}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            )}

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
                  ? "Hold the microphone button, type your questions, or ask me about landmarks, local tips, and hidden gems!"
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
