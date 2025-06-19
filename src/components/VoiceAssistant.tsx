import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Landmark } from '@/data/landmarks';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthProvider';
import AuthDialog from './AuthDialog';
import VoiceStatus from './voice-assistant/VoiceStatus';
import VoiceControls from './voice-assistant/VoiceControls';
import { useAudioContext } from './voice-assistant/useAudioContext';
import { useGoogleSpeechRecognition } from './voice-assistant/useGoogleSpeechRecognition';
import { useGoogleTextToSpeech } from './voice-assistant/useGoogleTextToSpeech';
import { useConversationHandler } from './voice-assistant/useConversationHandler';

interface VoiceAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: string;
  landmarks: Landmark[];
  perplexityApiKey: string;
  elevenLabsApiKey: string;
  onAddLandmarks?: (newLandmarks: Landmark[]) => void;
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
  } = useGoogleSpeechRecognition();
  const { isSpeaking, speakText, cleanup: cleanupTTS } = useGoogleTextToSpeech();

  const {
    suggestedLandmarks,
    showSuggestions,
    handleUserInput,
    handleAddSuggestedLandmarks,
    handleDeclineSuggestions
  } = useConversationHandler({
    destination,
    landmarks,
    speakText,
    onAddLandmarks
  });

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
      cleanupTTS();
    };
  }, [open, isSpeechRecognitionSupported, setupRecognition, cleanupRecognition, cleanupTTS, handleUserInput]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setHasUserInteracted(false);
      cleanupTTS();
      cleanupRecognition();
    }
  }, [open, cleanupTTS, cleanupRecognition]);

  const handleStartListening = async () => {
    try {
      if (!audioContextInitialized) {
        await initializeAudioContext();
      }

      if (!isSpeaking) {
        console.log('Starting speech recognition from voice assistant');
        await startListening();
      }
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      toast({
        title: "Microphone Error",
        description: "Please allow microphone access and try again.",
        variant: "destructive"
      });
    }
  };

  const handleWelcomeClick = async () => {
    console.log('Welcome button clicked');
    setHasUserInteracted(true);
    
    try {
      await initializeAudioContext();
      
      const welcomeMessage = `Welcome to your ${destination} tour! I'm your voice assistant powered by Google AI. You can ask me about any of the landmarks we've planned for you. What would you like to know?`;
      console.log('Playing welcome message:', welcomeMessage);
      
      await speakText(welcomeMessage);
      console.log('Welcome message completed');
    } catch (error) {
      console.error('Error playing welcome message:', error);
      toast({
        title: "Audio Error",
        description: "There was an issue with audio playback. Please try again.",
        variant: "destructive"
      });
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
              Ask me anything about your {destination} tour! I'm powered by Google AI and I'll share stories, tips, and suggest additional places you might love.
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
