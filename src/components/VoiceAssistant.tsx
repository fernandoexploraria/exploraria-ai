
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Landmark } from '@/data/landmarks';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthProvider';
import AuthDialog from './AuthDialog';
import VoiceStatus from './voice-assistant/VoiceStatus';
import VoiceControls from './voice-assistant/VoiceControls';
import { useAudioContext } from './voice-assistant/useAudioContext';
import { useSpeechRecognition } from './voice-assistant/useSpeechRecognition';
import { useSimpleTextToSpeech } from './voice-assistant/useSimpleTextToSpeech';

interface VoiceAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: string;
  landmarks: Landmark[];
  perplexityApiKey: string;
  elevenLabsApiKey: string;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  open,
  onOpenChange,
  destination,
  landmarks,
  perplexityApiKey,
  elevenLabsApiKey
}) => {
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const { toast } = useToast();
  const { user, session } = useAuth();

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
  const { isSpeaking, speakText, cleanup: cleanupTTS } = useSimpleTextToSpeech();

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
    
    if (!perplexityApiKey || perplexityApiKey.includes('YOUR_')) {
      const response = "I'm sorry, but I need a Perplexity API key to answer your questions.";
      await speakText(response);
      await storeInteraction(input, response);
      return;
    }

    try {
      const landmarkNames = landmarks.map(l => l.name).join(', ');
      const prompt = `You are a knowledgeable tour guide for ${destination}. The user is asking: "${input}". 

Available landmarks in their tour: ${landmarkNames}

Please provide a helpful, conversational response about the destination or landmarks. Keep your response under 200 words and speak as if you're a friendly local guide. If they ask about a specific landmark, provide interesting facts and tips.`;

      console.log('Calling Perplexity API...');
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            { role: 'system', content: 'You are a friendly, knowledgeable tour guide. Speak conversationally and keep responses concise.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 200
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        console.log('Got AI response:', aiResponse);
        
        await speakText(aiResponse);
        await storeInteraction(input, aiResponse);
      } else {
        console.error('Perplexity API error:', response.status, await response.text());
        const errorResponse = "I'm sorry, I couldn't process your question right now. Please try again.";
        await speakText(errorResponse);
        await storeInteraction(input, errorResponse);
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorResponse = "I'm sorry, I encountered an error. Please try asking again.";
      await speakText(errorResponse);
      await storeInteraction(input, errorResponse);
    }
  };

  const handleWelcomeClick = async () => {
    console.log('Welcome button clicked');
    setHasUserInteracted(true);
    
    await initializeAudioContext();
    
    const welcomeMessage = `Welcome to your ${destination} tour! I'm your voice assistant. You can ask me about any of the landmarks we've planned for you. What would you like to know?`;
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
              Ask me anything about your {destination} tour! Click the welcome button first, then use the microphone to speak.
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
                 hasUserInteracted ? 'Click to speak' : 'Click welcome first'}
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

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                {hasUserInteracted 
                  ? "Click the microphone to ask questions about your tour"
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
