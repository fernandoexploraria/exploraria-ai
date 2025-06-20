
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
  const [conversationState, setConversationState] = useState<{
    userInput: string;
    assistantResponse: string;
    step: 'idle' | 'recording' | 'transcribing' | 'generating' | 'speaking' | 'storing';
  }>({
    userInput: '',
    assistantResponse: '',
    step: 'idle'
  });
  
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

  // Store conversation interaction
  const storeConversation = async (userInput: string, assistantResponse: string) => {
    if (!user || !userInput.trim() || !assistantResponse.trim()) {
      console.log('Cannot store conversation - missing data:', { 
        hasUser: !!user, 
        hasUserInput: !!userInput.trim(), 
        hasAssistantResponse: !!assistantResponse.trim() 
      });
      return false;
    }

    try {
      console.log('Storing conversation:', { 
        userInput: userInput.substring(0, 50) + '...', 
        assistantResponse: assistantResponse.substring(0, 50) + '...',
        destination 
      });

      setConversationState(prev => ({ ...prev, step: 'storing' }));
      
      const { error } = await supabase.functions.invoke('store-voice-interaction', {
        body: {
          userInput: userInput.trim(),
          assistantResponse: assistantResponse.trim(),
          destination
        }
      });

      if (error) {
        console.error('Error storing conversation:', error);
        toast({
          title: "Storage Error",
          description: "Could not save conversation to database.",
          variant: "destructive"
        });
        return false;
      } else {
        console.log('Conversation stored successfully');
        toast({
          title: "Conversation Saved",
          description: "Your interaction has been saved.",
        });
        return true;
      }
    } catch (error) {
      console.error('Error in storeConversation:', error);
      toast({
        title: "Storage Error",
        description: "Failed to save conversation.",
        variant: "destructive"
      });
      return false;
    } finally {
      setConversationState(prev => ({ ...prev, step: 'idle' }));
    }
  };

  // Complete conversation flow
  const processCompleteConversation = async (audioBase64: string) => {
    setIsProcessing(true);
    
    try {
      // Step 1: Convert speech to text
      console.log('Step 1: Converting speech to text...');
      setConversationState(prev => ({ ...prev, step: 'transcribing' }));
      
      const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: audioBase64 }
      });

      if (transcriptError || !transcriptData?.text?.trim()) {
        throw new Error('No speech detected or transcription failed');
      }

      const userInput = transcriptData.text.trim();
      console.log('User said:', userInput);

      // Step 2: Get AI response
      console.log('Step 2: Getting AI response...');
      setConversationState(prev => ({ 
        ...prev, 
        userInput, 
        step: 'generating' 
      }));
      
      const { data: aiData, error: aiError } = await supabase.functions.invoke('gemini-chat', {
        body: {
          message: userInput,
          destination: destination,
          context: `You are a helpful tour guide assistant for ${destination}. Provide informative and engaging responses about local attractions, history, culture, and travel tips.`
        }
      });

      if (aiError || !aiData?.response?.trim()) {
        throw new Error('Failed to get AI response');
      }

      const assistantResponse = aiData.response.trim();
      console.log('AI responded:', assistantResponse);

      // Step 3: Speak the response
      console.log('Step 3: Speaking response...');
      setConversationState(prev => ({ 
        ...prev, 
        assistantResponse, 
        step: 'speaking' 
      }));
      
      await speakText(assistantResponse);

      // Step 4: Store the complete conversation
      console.log('Step 4: Storing conversation...');
      await storeConversation(userInput, assistantResponse);

      // Reset state
      setConversationState({
        userInput: '',
        assistantResponse: '',
        step: 'idle'
      });

    } catch (error) {
      console.error('Error in conversation flow:', error);
      toast({
        title: "Processing Error",
        description: error instanceof Error ? error.message : "Failed to process conversation",
        variant: "destructive"
      });
      
      // Reset state on error
      setConversationState({
        userInput: '',
        assistantResponse: '',
        step: 'idle'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMicClick = async () => {
    console.log('Mic button clicked, current state:', { isRecording, isProcessing, isSpeaking, step: conversationState.step });
    
    if (isSpeaking || conversationState.step === 'speaking') {
      toast({
        title: "Please Wait",
        description: "Assistant is currently speaking. Please wait for it to finish.",
        variant: "destructive"
      });
      return;
    }

    if (isRecording) {
      console.log('Stopping recording...');
      setConversationState(prev => ({ ...prev, step: 'recording' }));
      try {
        const audioBase64 = await stopRecording();
        console.log('Recording stopped, starting conversation flow...');
        await processCompleteConversation(audioBase64);
      } catch (error) {
        console.error('Error processing recording:', error);
        toast({
          title: "Recording Error",
          description: "Failed to process recording.",
          variant: "destructive"
        });
        setConversationState(prev => ({ ...prev, step: 'idle' }));
      }
    } else {
      console.log('Starting recording...');
      try {
        await startRecording();
        setConversationState(prev => ({ ...prev, step: 'recording' }));
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
      setConversationState({
        userInput: '',
        assistantResponse: '',
        step: 'idle'
      });
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

  const isButtonDisabled = isProcessing || isAudioProcessing || isSpeaking || conversationState.step !== 'idle';

  const getStatusMessage = () => {
    switch (conversationState.step) {
      case 'recording':
        return isRecording ? "Recording... Click to stop and process." : "Processing recording...";
      case 'transcribing':
        return "Converting speech to text...";
      case 'generating':
        return "Getting AI response...";
      case 'speaking':
        return "Assistant speaking...";
      case 'storing':
        return "Saving conversation...";
      default:
        if (isSpeaking) return "Assistant speaking...";
        if (isProcessing || isAudioProcessing) return "Processing your message...";
        return "Click microphone to start talking";
    }
  };

  const getButtonColor = () => {
    if (isRecording || conversationState.step === 'recording') {
      return 'bg-red-500 hover:bg-red-600 animate-pulse';
    }
    if (isSpeaking || conversationState.step === 'speaking') {
      return 'bg-green-500 hover:bg-green-600 animate-pulse';
    }
    if (isProcessing || isAudioProcessing || conversationState.step !== 'idle') {
      return 'bg-yellow-500 hover:bg-yellow-600';
    }
    return 'bg-primary hover:bg-primary/90';
  };

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
            className={`w-24 h-24 rounded-full transition-all duration-200 hover:scale-105 ${getButtonColor()}`}
            onClick={handleMicClick}
            disabled={isButtonDisabled}
          >
            {isRecording ? (
              <MicOff className="w-12 h-12" />
            ) : (
              <Mic className="w-12 h-12" />
            )}
          </Button>
          
          <p className="mt-4 text-sm text-muted-foreground text-center">
            {getStatusMessage()}
          </p>

          {conversationState.userInput && (
            <div className="mt-4 text-xs text-center max-w-sm">
              <p className="text-blue-600 font-medium">You said:</p>
              <p className="text-gray-600 italic">"{conversationState.userInput}"</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceAssistant;
