
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthProvider';
import { useAudioRecorder } from './voice-assistant/useAudioRecorder';
import { useTextToSpeech } from './voice-assistant/useTextToSpeech';

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
  const { toast } = useToast();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>('');
  
  const { isRecording, isProcessing: isAudioProcessing, startRecording, stopRecording, cleanup } = useAudioRecorder();
  const { isSpeaking, speakText, cleanup: cleanupTTS } = useTextToSpeech(elevenLabsApiKey, true);

  // Get ElevenLabs API key
  useEffect(() => {
    const fetchElevenLabsConfig = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-elevenlabs-config');
        if (error) {
          console.error('Error fetching ElevenLabs config:', error);
        } else {
          setElevenLabsApiKey(data.apiKey || '');
        }
      } catch (error) {
        console.error('Error fetching ElevenLabs config:', error);
      }
    };

    if (open) {
      fetchElevenLabsConfig();
    }
  }, [open]);

  // Store voice interaction in database
  const storeVoiceInteraction = async (userInput: string, assistantResponse: string) => {
    if (!user || !userInput.trim() || !assistantResponse.trim()) {
      console.log('Missing data for storing interaction:', { 
        hasUser: !!user, 
        hasUserInput: !!userInput.trim(), 
        hasAssistantResponse: !!assistantResponse.trim() 
      });
      return;
    }

    try {
      console.log('Storing voice interaction...', { 
        userInputLength: userInput.length,
        assistantResponseLength: assistantResponse.length,
        destination,
        userId: user.id
      });
      
      const { error } = await supabase.functions.invoke('store-voice-interaction', {
        body: {
          userInput: userInput.trim(),
          assistantResponse: assistantResponse.trim(),
          destination
        }
      });

      if (error) {
        console.error('Error storing voice interaction:', error);
        toast({
          title: "Storage Error",
          description: "Could not save voice interaction to database.",
          variant: "destructive"
        });
      } else {
        console.log('Voice interaction stored successfully');
        toast({
          title: "Interaction Saved",
          description: "Your conversation has been saved for future reference.",
        });
      }
    } catch (error) {
      console.error('Error storing voice interaction:', error);
      toast({
        title: "Storage Error",
        description: "Failed to save voice interaction.",
        variant: "destructive"
      });
    }
  };

  // Process audio and get response
  const processAudioAndRespond = async (audioBase64: string) => {
    setIsProcessing(true);
    
    try {
      console.log('Converting speech to text...');
      
      // Convert speech to text
      const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: audioBase64 }
      });

      if (transcriptError) {
        throw new Error(`Speech-to-text error: ${transcriptError.message}`);
      }

      const userInput = transcriptData.text;
      console.log('User said:', userInput);

      if (!userInput.trim()) {
        throw new Error('No speech detected');
      }

      // Get AI response
      console.log('Getting AI response...');
      const { data: aiData, error: aiError } = await supabase.functions.invoke('gemini-chat', {
        body: {
          message: userInput,
          destination: destination,
          context: `You are a helpful tour guide assistant for ${destination}. Provide informative and engaging responses about local attractions, history, culture, and travel tips.`
        }
      });

      if (aiError) {
        throw new Error(`AI response error: ${aiError.message}`);
      }

      const assistantResponse = aiData.response;
      console.log('AI responded:', assistantResponse);

      // Store the interaction
      await storeVoiceInteraction(userInput, assistantResponse);

      // Speak the response
      console.log('Speaking response...');
      await speakText(assistantResponse);

    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: "Processing Error",
        description: error instanceof Error ? error.message : "Failed to process audio",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMicClick = async () => {
    console.log('Mic button clicked, current states:', { isRecording, isProcessing, isSpeaking });
    
    if (isSpeaking) {
      toast({
        title: "Please Wait",
        description: "Assistant is currently speaking. Please wait for it to finish.",
        variant: "destructive"
      });
      return;
    }

    if (isRecording) {
      console.log('Stopping recording...');
      try {
        const audioBase64 = await stopRecording();
        console.log('Recording stopped, processing audio...');
        await processAudioAndRespond(audioBase64);
      } catch (error) {
        console.error('Error stopping recording:', error);
        toast({
          title: "Recording Error",
          description: "Failed to process recording.",
          variant: "destructive"
        });
      }
    } else {
      console.log('Starting recording...');
      try {
        await startRecording();
      } catch (error) {
        console.error('Error starting recording:', error);
        toast({
          title: "Microphone Error",
          description: "Could not access microphone. Please check permissions.",
          variant: "destructive"
        });
      }
    }
  };

  // Cleanup when dialog closes
  useEffect(() => {
    if (!open) {
      console.log('Dialog closed, cleaning up...');
      cleanup();
      cleanupTTS();
    }
  }, [open, cleanup, cleanupTTS]);

  // Send initial greeting when dialog opens
  useEffect(() => {
    if (open && elevenLabsApiKey) {
      console.log('Dialog opened, sending initial greeting...');
      const greeting = `Hello! I'm your AI tour guide for ${destination}. How can I help you explore this amazing destination today?`;
      setTimeout(() => {
        speakText(greeting);
      }, 1000);
    }
  }, [open, elevenLabsApiKey, destination, speakText]);

  const isButtonDisabled = isProcessing || isAudioProcessing || isSpeaking;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {destination} Tour Assistant
          </DialogTitle>
          <DialogDescription className="text-center">
            Click the microphone to start a voice conversation with your AI tour guide. Get personalized recommendations and answers about {destination}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-16">
          <Button
            size="lg"
            className={`w-24 h-24 rounded-full transition-all duration-200 hover:scale-105 ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                : isSpeaking
                ? 'bg-green-500 hover:bg-green-600 animate-pulse'
                : isProcessing || isAudioProcessing
                ? 'bg-yellow-500 hover:bg-yellow-600'
                : 'bg-primary hover:bg-primary/90'
            }`}
            onClick={handleMicClick}
            disabled={isButtonDisabled}
          >
            {isRecording ? (
              <MicOff className="w-12 h-12" />
            ) : (
              <Mic className="w-12 h-12" />
            )}
          </Button>
          
          {isRecording && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Recording... Click to stop and process.
            </p>
          )}
          
          {(isProcessing || isAudioProcessing) && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Processing your message...
            </p>
          )}
          
          {isSpeaking && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Assistant speaking...
            </p>
          )}

          {!isRecording && !isProcessing && !isAudioProcessing && !isSpeaking && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Click microphone to start talking
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceAssistant;
