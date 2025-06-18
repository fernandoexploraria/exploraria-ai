
import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  // Check if speech recognition is supported
  const isSpeechRecognitionSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  useEffect(() => {
    console.log('VoiceAssistant mounted with props:', {
      open,
      destination,
      landmarksCount: landmarks.length,
      hasPerplexityKey: !!perplexityApiKey,
      hasElevenLabsKey: !!elevenLabsApiKey,
      speechRecognitionSupported: isSpeechRecognitionSupported
    });

    if (open && isSpeechRecognitionSupported) {
      try {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          console.log('Speech recognition started');
          setDebugInfo('Speech recognition started');
        };

        recognitionRef.current.onresult = (event: any) => {
          console.log('Speech recognition result event:', event);
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            console.log('Final transcript:', finalTranscript);
            setTranscript(finalTranscript);
            setDebugInfo(`Recognized: ${finalTranscript}`);
            handleUserInput(finalTranscript);
          }
        };

        recognitionRef.current.onend = () => {
          console.log('Speech recognition ended');
          setIsListening(false);
          setDebugInfo('Speech recognition ended');
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          setDebugInfo(`Error: ${event.error}`);
          toast({
            title: "Speech Recognition Error",
            description: `Error: ${event.error}. Please check your microphone permissions.`,
            variant: "destructive"
          });
        };
      } catch (error) {
        console.error('Error setting up speech recognition:', error);
        setDebugInfo(`Setup error: ${error}`);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('Error stopping recognition:', error);
        }
      }
    };
  }, [open]);

  const ensureValidSession = async () => {
    try {
      console.log('Checking session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session error:', error);
        toast({
          title: "Authentication Error",
          description: "Please refresh the page and try again.",
          variant: "destructive"
        });
        return null;
      }

      if (!session) {
        console.log('No active session found');
        toast({
          title: "Authentication Required",
          description: "Please log in to use the voice assistant.",
          variant: "destructive"
        });
        return null;
      }

      console.log('Valid session found:', session.user.id);
      return session;
    } catch (error) {
      console.error('Unexpected session error:', error);
      return null;
    }
  };

  const storeInteraction = async (userInput: string, assistantResponse: string) => {
    try {
      console.log('Attempting to store interaction...');
      
      const session = await ensureValidSession();
      if (!session) {
        console.log('No valid session, skipping storage');
        return;
      }

      console.log('Calling edge function to store interaction...');
      
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
      }
    } catch (error) {
      console.error('Unexpected error storing interaction:', error);
    }
  };

  const startListening = () => {
    if (!isSpeechRecognitionSupported) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in this browser.",
        variant: "destructive"
      });
      return;
    }

    if (recognitionRef.current && !isSpeaking) {
      try {
        console.log('Starting speech recognition...');
        setIsListening(true);
        setHasUserInteracted(true);
        setDebugInfo('Starting to listen...');
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setIsListening(false);
        setDebugInfo(`Start error: ${error}`);
        toast({
          title: "Microphone Error",
          description: "Please allow microphone access and try again.",
          variant: "destructive"
        });
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      console.log('Stopping speech recognition...');
      setIsListening(false);
      setDebugInfo('Stopping...');
      recognitionRef.current.stop();
    }
  };

  const speakText = async (text: string) => {
    try {
      console.log('Speaking text:', text.substring(0, 50) + '...');
      console.log('User has interacted:', hasUserInteracted);
      setIsSpeaking(true);
      setDebugInfo('Speaking...');
      
      // Check ElevenLabs API key
      if (!elevenLabsApiKey || elevenLabsApiKey === 'YOUR_ELEVENLABS_API_KEY') {
        console.log('Using browser speech synthesis...');
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => {
          console.log('Speech synthesis started');
          setIsSpeaking(true);
        };
        utterance.onend = () => {
          console.log('Speech synthesis ended');
          setIsSpeaking(false);
          setDebugInfo('Finished speaking');
        };
        utterance.onerror = (error) => {
          console.error('Speech synthesis error:', error);
          setIsSpeaking(false);
          setDebugInfo(`Speech error: ${error}`);
        };
        speechSynthesis.speak(utterance);
        return;
      }

      console.log('Using ElevenLabs API...');
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          console.log('Audio playback ended');
          setIsSpeaking(false);
          setDebugInfo('Finished speaking');
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = (error) => {
          console.error('Audio playback error:', error);
          setIsSpeaking(false);
          setDebugInfo(`Audio error: ${error}`);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      } else {
        console.error('ElevenLabs API error:', response.status, await response.text());
        setIsSpeaking(false);
        setDebugInfo('ElevenLabs API error - falling back to browser TTS');
        
        // Fallback to browser TTS
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => {
          setIsSpeaking(false);
          setDebugInfo('Finished speaking (fallback)');
        };
        speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      setIsSpeaking(false);
      setDebugInfo(`TTS error: ${error} - trying fallback`);
      
      // Fallback to browser TTS
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => {
          setIsSpeaking(false);
          setDebugInfo('Finished speaking (fallback)');
        };
        speechSynthesis.speak(utterance);
      } catch (fallbackError) {
        console.error('Fallback TTS also failed:', fallbackError);
        setDebugInfo(`All TTS failed: ${fallbackError}`);
      }
    }
  };

  const handleUserInput = async (input: string) => {
    console.log('Processing user input:', input);
    setDebugInfo('Processing your question...');
    
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
      setDebugInfo('Getting AI response...');
      
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
        setDebugInfo('Response complete');
      } else {
        console.error('Perplexity API error:', response.status, await response.text());
        const errorResponse = "I'm sorry, I couldn't process your question right now. Please try again.";
        await speakText(errorResponse);
        await storeInteraction(input, errorResponse);
        setDebugInfo('API error occurred');
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorResponse = "I'm sorry, I encountered an error. Please try asking again.";
      await speakText(errorResponse);
      await storeInteraction(input, errorResponse);
      setDebugInfo(`Error: ${error}`);
    }
  };

  const handleWelcomeClick = async () => {
    console.log('Welcome button clicked');
    setHasUserInteracted(true);
    setDebugInfo('Welcome! Ready to help.');
    const welcomeMessage = `Welcome to your ${destination} tour! I'm your voice assistant. You can ask me about any of the landmarks we've planned for you. What would you like to know?`;
    await speakText(welcomeMessage);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Voice Tour Guide</DialogTitle>
          <DialogDescription>
            Ask me anything about your {destination} tour! Click the welcome button first, then use the microphone to speak.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-8">
          {/* Debug info */}
          {debugInfo && (
            <div className="text-xs text-gray-500 text-center max-w-sm">
              Debug: {debugInfo}
            </div>
          )}

          <div className="flex flex-col items-center space-y-4">
            {/* Visual indicator */}
            <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-colors ${
              isSpeaking ? 'border-green-500 bg-green-50' : 
              isListening ? 'border-blue-500 bg-blue-50' : 
              'border-gray-300 bg-gray-50'
            }`}>
              {isSpeaking ? (
                <Volume2 className="w-12 h-12 text-green-600" />
              ) : (
                <Mic className={`w-12 h-12 ${isListening ? 'text-blue-600' : 'text-gray-400'}`} />
              )}
            </div>

            {/* Status text */}
            <p className="text-center text-sm font-medium">
              {isSpeaking ? 'Speaking...' : 
               isListening ? 'Listening...' : 
               hasUserInteracted ? 'Tap to speak' : 'Click welcome first'}
            </p>

            {/* Welcome button (only show if user hasn't interacted) */}
            {!hasUserInteracted && (
              <Button
                onClick={handleWelcomeClick}
                className="mb-2"
                variant="outline"
              >
                Start Tour Guide
              </Button>
            )}

            {/* Microphone button */}
            <Button
              size="lg"
              variant={isListening ? "destructive" : "default"}
              onClick={isListening ? stopListening : startListening}
              disabled={isSpeaking || !hasUserInteracted || !isSpeechRecognitionSupported}
              className="rounded-full w-16 h-16"
            >
              {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>

            {/* Browser support warning */}
            {!isSpeechRecognitionSupported && (
              <div className="text-center text-sm text-red-600 max-w-sm">
                Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.
              </div>
            )}

            {/* Last transcript */}
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
                ? "Press and hold the microphone to ask questions about your tour"
                : "Click 'Start Tour Guide' to begin your interactive tour experience"
              }
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceAssistant;
