
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
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript(finalTranscript);
          handleUserInput(finalTranscript);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Speech Recognition Error",
          description: "Please check your microphone permissions and try again.",
          variant: "destructive"
        });
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [open, destination]);

  const ensureValidSession = async () => {
    try {
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

      // Check if token is close to expiring (within 5 minutes)
      const expiresAt = session.expires_at || 0;
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry < 300) { // Less than 5 minutes
        console.log('Token expiring soon, refreshing...');
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('Token refresh error:', refreshError);
          toast({
            title: "Session Expired",
            description: "Please refresh the page and log in again.",
            variant: "destructive"
          });
          return null;
        }
        
        return refreshedSession;
      }

      return session;
    } catch (error) {
      console.error('Unexpected session error:', error);
      return null;
    }
  };

  const storeInteraction = async (userInput: string, assistantResponse: string) => {
    try {
      console.log('Attempting to store interaction:', { userInput, assistantResponse, destination });
      
      const session = await ensureValidSession();
      if (!session) {
        return;
      }

      console.log('Valid session found, calling edge function...');
      
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
      toast({
        title: "Storage Error",
        description: "Couldn't save conversation. Please try again.",
        variant: "destructive"
      });
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isSpeaking) {
      try {
        setIsListening(true);
        setHasUserInteracted(true);
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setIsListening(false);
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
      setIsListening(false);
      recognitionRef.current.stop();
    }
  };

  const speakText = async (text: string) => {
    try {
      setIsSpeaking(true);
      
      // Only attempt audio playback if user has interacted with the page
      if (!hasUserInteracted) {
        console.log('User has not interacted yet, skipping audio playback');
        setIsSpeaking(false);
        return;
      }

      if (!elevenLabsApiKey || elevenLabsApiKey === 'YOUR_ELEVENLABS_API_KEY') {
        // Fallback to browser speech synthesis
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (error) => {
          console.error('Speech synthesis error:', error);
          setIsSpeaking(false);
        };
        speechSynthesis.speak(utterance);
        return;
      }

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
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.onerror = (error) => {
          console.error('Audio playback error:', error);
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        // Only play if user has interacted
        if (hasUserInteracted) {
          await audio.play();
        } else {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        }
      } else {
        console.error('ElevenLabs API error:', response.status, await response.text());
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      setIsSpeaking(false);
    }
  };

  const handleUserInput = async (input: string) => {
    console.log('Processing user input:', input);
    
    if (!perplexityApiKey) {
      const response = "I'm sorry, but I need a Perplexity API key to answer your questions.";
      speakText(response);
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
        
        speakText(aiResponse);
        await storeInteraction(input, aiResponse);
      } else {
        console.error('Perplexity API error:', response.status, await response.text());
        const errorResponse = "I'm sorry, I couldn't process your question right now. Please try again.";
        speakText(errorResponse);
        await storeInteraction(input, errorResponse);
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorResponse = "I'm sorry, I encountered an error. Please try asking again.";
      speakText(errorResponse);
      await storeInteraction(input, errorResponse);
    }
  };

  const handleWelcomeClick = () => {
    setHasUserInteracted(true);
    const welcomeMessage = `Welcome to your ${destination} tour! I'm your voice assistant. You can ask me about any of the landmarks we've planned for you. What would you like to know?`;
    speakText(welcomeMessage);
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
              disabled={isSpeaking || !hasUserInteracted}
              className="rounded-full w-16 h-16"
            >
              {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>

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
