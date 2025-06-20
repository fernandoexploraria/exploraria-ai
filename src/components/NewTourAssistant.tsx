
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Landmark } from '@/data/landmarks';
import { useGeminiAPI } from '@/hooks/useGeminiAPI';
import { useTextToSpeech } from '@/components/voice-assistant/useTextToSpeech';
import { useAudioContext } from '@/components/voice-assistant/useAudioContext';
import { useGoogleSpeechRecognition } from '@/components/voice-assistant/useGoogleSpeechRecognition';

interface NewTourAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: string;
  landmarks: Landmark[];
}

const NewTourAssistant: React.FC<NewTourAssistantProps> = ({ 
  open, 
  onOpenChange, 
  destination, 
  landmarks 
}) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversation, setConversation] = useState<Array<{type: 'user' | 'assistant', text: string}>>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>('');
  
  const { callGemini } = useGeminiAPI();
  const { audioContextInitialized, initializeAudioContext } = useAudioContext();
  const { isSpeaking, speakText, cleanup: cleanupTTS } = useTextToSpeech(elevenLabsApiKey, audioContextInitialized);
  const { 
    isListening, 
    startListening, 
    stopListening, 
    cleanup: cleanupSpeech 
  } = useGoogleSpeechRecognition();

  // Check for stored API key on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('elevenlabs_api_key');
    if (storedKey) {
      setElevenLabsApiKey(storedKey);
    }
  }, []);

  // Cleanup on unmount or dialog close
  useEffect(() => {
    if (!open) {
      cleanupTTS();
      cleanupSpeech();
      setHasStarted(false);
      setConversation([]);
    }
  }, [open, cleanupTTS, cleanupSpeech]);

  const handleApiKeySubmit = (key: string) => {
    setElevenLabsApiKey(key);
    localStorage.setItem('elevenlabs_api_key', key);
    toast({
      title: "API Key Saved",
      description: "ElevenLabs API key has been saved successfully.",
    });
  };

  const handleStartTour = async () => {
    // Initialize audio context first
    await initializeAudioContext();
    
    setHasStarted(true);
    setIsProcessing(true);
    
    const landmarkList = landmarks.map(l => l.name).join(', ');
    const welcomePrompt = `You are an expert tour guide for ${destination}. The user has planned to visit these landmarks: ${landmarkList}. 
    
    Give a warm, enthusiastic welcome message introducing yourself as their personal tour guide. Mention that you'll help them explore ${destination} and its amazing landmarks. Keep it conversational and under 30 seconds when spoken. Ask what they'd like to know first.`;

    try {
      const response = await callGemini(welcomePrompt);
      if (response) {
        setConversation([{ type: 'assistant', text: response }]);
        await speakText(response);
      }
    } catch (error) {
      console.error('Error with welcome message:', error);
      toast({
        title: "Error",
        description: "Failed to start tour guide. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSpeechResult = async (transcript: string) => {
    if (!transcript.trim()) return;
    
    console.log('Speech result:', transcript);
    setConversation(prev => [...prev, { type: 'user', text: transcript }]);
    setIsProcessing(true);

    const landmarkList = landmarks.map(l => `${l.name}: ${l.description}`).join('\n');
    const contextPrompt = `You are a knowledgeable tour guide for ${destination}. 
    
    Context about the user's planned landmarks:
    ${landmarkList}
    
    User question: "${transcript}"
    
    Provide a helpful, enthusiastic response as their personal tour guide. Include interesting facts, tips, or recommendations. Keep responses conversational and engaging, suitable for audio narration (under 45 seconds when spoken).`;

    try {
      const response = await callGemini(contextPrompt);
      if (response) {
        setConversation(prev => [...prev, { type: 'assistant', text: response }]);
        await speakText(response);
      }
    } catch (error) {
      console.error('Error processing question:', error);
      toast({
        title: "Error",
        description: "Failed to process your question. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMicClick = async () => {
    if (isListening) {
      await stopListening(handleSpeechResult);
    } else {
      if (isSpeaking) {
        cleanupTTS();
      }
      await startListening();
    }
  };

  const handleClose = () => {
    cleanupTTS();
    cleanupSpeech();
    onOpenChange(false);
  };

  // Show API key input if not provided
  if (!elevenLabsApiKey) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ElevenLabs API Key Required</DialogTitle>
            <DialogDescription>
              To use the voice tour guide, please enter your ElevenLabs API key.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="apikey" className="block text-sm font-medium mb-2">
                ElevenLabs API Key
              </label>
              <input
                id="apikey"
                type="password"
                placeholder="Enter your ElevenLabs API key..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    if (input.value.trim()) {
                      handleApiKeySubmit(input.value.trim());
                    }
                  }
                }}
              />
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p>Get your API key from <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">ElevenLabs.io</a></p>
              <p className="mt-1">Your key will be stored locally in your browser.</p>
            </div>
            
            <Button
              onClick={() => {
                const input = document.getElementById('apikey') as HTMLInputElement;
                if (input?.value.trim()) {
                  handleApiKeySubmit(input.value.trim());
                }
              }}
              className="w-full"
            >
              Save API Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {destination} Tour Guide
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Your AI-powered personal tour guide for {destination}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          {!hasStarted ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <div className="text-center mb-8">
                <h3 className="text-lg font-semibold mb-2">Ready to explore {destination}?</h3>
                <p className="text-muted-foreground mb-4">
                  I'm your personal tour guide ready to help you discover amazing places and share fascinating stories.
                </p>
                <p className="text-sm text-muted-foreground">
                  You have {landmarks.length} landmarks planned for your visit.
                </p>
              </div>
              
              <Button
                onClick={handleStartTour}
                disabled={isProcessing}
                size="lg"
                className="bg-blue-500 hover:bg-blue-600"
              >
                {isProcessing ? 'Starting...' : 'Start Tour Guide'}
              </Button>
            </div>
          ) : (
            <>
              {/* Conversation History */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-3 min-h-0">
                {conversation.map((message, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${
                      message.type === 'user' 
                        ? 'bg-blue-100 ml-8 text-right' 
                        : 'bg-gray-100 mr-8'
                    }`}
                  >
                    <div className="text-sm font-medium mb-1">
                      {message.type === 'user' ? 'You' : 'Tour Guide'}
                    </div>
                    <div className="text-sm">{message.text}</div>
                  </div>
                ))}
                
                {isProcessing && (
                  <div className="bg-gray-100 mr-8 p-3 rounded-lg">
                    <div className="text-sm font-medium mb-1">Tour Guide</div>
                    <div className="text-sm text-muted-foreground">Thinking...</div>
                  </div>
                )}
              </div>

              {/* Voice Controls */}
              <div className="flex flex-col items-center space-y-4 py-4 border-t">
                <Button
                  size="lg"
                  className={`w-20 h-20 rounded-full transition-all duration-200 ${
                    isListening 
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                      : isSpeaking
                      ? 'bg-green-500 hover:bg-green-600 animate-pulse'
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                  onClick={handleMicClick}
                  disabled={isProcessing}
                >
                  {isListening ? (
                    <MicOff className="w-8 h-8" />
                  ) : isSpeaking ? (
                    <Volume2 className="w-8 h-8" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </Button>
                
                <div className="text-center text-sm text-muted-foreground">
                  {isListening ? (
                    "Listening... Click to send your message"
                  ) : isSpeaking ? (
                    "Tour guide speaking..."
                  ) : isProcessing ? (
                    "Processing your request..."
                  ) : (
                    "Click microphone to ask a question"
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewTourAssistant;
