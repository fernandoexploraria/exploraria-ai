
import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { useGeminiAPI } from '@/hooks/useGeminiAPI';
import { useGoogleSpeechRecognition } from './voice-assistant/useGoogleSpeechRecognition';
import { useGeminiTextToSpeech } from './voice-assistant/useGeminiTextToSpeech';

interface VoiceAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: string;
  landmarks: Landmark[];
  onAddLandmarks?: (newLandmarks: Landmark[]) => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  open,
  onOpenChange,
  destination
}) => {
  const { callGemini, isLoading } = useGeminiAPI();
  const { isListening, startListening, stopListening } = useGoogleSpeechRecognition();
  const { isSpeaking, speakText } = useGeminiTextToSpeech();

  // Send greeting automatically when dialog opens
  useEffect(() => {
    const sendInitialGreeting = async () => {
      if (open && !isLoading && !isSpeaking) {
        console.log('Dialog opened, sending initial greeting...');
        
        const systemInstruction = `You are a friendly tour guide assistant for ${destination}. Provide helpful information about landmarks, attractions, and travel tips. Keep responses conversational and engaging.`;
        
        const greeting = await callGemini("Hi", systemInstruction);
        
        if (greeting) {
          console.log('Assistant greeting:', greeting);
          
          // Play the greeting using Google Cloud TTS
          console.log('Playing greeting with TTS...');
          await speakText(greeting);
        }
      }
    };

    sendInitialGreeting();
  }, [open, destination, callGemini, speakText, isLoading, isSpeaking]);

  const handleMicClick = async () => {
    if (isListening) {
      // Stop continuous listening
      console.log('Stopping continuous listening...');
      await stopListening(() => {}); // Empty callback since we're just stopping
    } else {
      // Start continuous listening with automatic speech processing
      console.log('Starting continuous listening...');
      await startListening();
    }
  };

  const handleSpeechResult = async (transcript: string) => {
    console.log('Speech recognized:', transcript);
    
    if (transcript.trim()) {
      const systemInstruction = `You are a friendly tour guide assistant for ${destination}. Provide helpful information about landmarks, attractions, and travel tips. Keep responses conversational and engaging.`;
      
      console.log('Sending user speech to assistant:', transcript);
      const response = await callGemini(transcript, systemInstruction);
      
      if (response) {
        console.log('Assistant response:', response);
        
        // Play the response using Google Cloud TTS
        console.log('Playing response with TTS...');
        await speakText(response);
      }
    }
  };

  // Set up speech recognition with automatic processing
  useEffect(() => {
    if (isListening) {
      // The speech recognition will automatically call handleSpeechResult when it detects a pause
      console.log('Continuous listening active - will process speech automatically on pauses');
    }
  }, [isListening]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {destination} Tour Assistant
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-16">
          <Button
            size="lg"
            className={`w-24 h-24 rounded-full transition-all duration-200 hover:scale-105 ${
              isListening 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                : isSpeaking
                ? 'bg-green-500 hover:bg-green-600 animate-pulse'
                : 'bg-primary hover:bg-primary/90'
            }`}
            onClick={handleMicClick}
            disabled={isLoading || isSpeaking}
          >
            {isListening ? (
              <MicOff className="w-12 h-12" />
            ) : (
              <Mic className="w-12 h-12" />
            )}
          </Button>
          
          {isListening && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Listening continuously... Speak and pause. Click to stop.
            </p>
          )}
          
          {isSpeaking && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Speaking...
            </p>
          )}

          {!isListening && !isSpeaking && !isLoading && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Click microphone to start conversation
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceAssistant;
