
import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { Landmark } from '@/data/landmarks';

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
  const recognitionRef = useRef<any>(null);

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

      // Start with a welcome message
      setTimeout(() => {
        speakText(`Welcome to your ${destination} tour! I'm your voice assistant. You can ask me about any of the landmarks we've planned for you. What would you like to know?`);
      }, 500);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [open, destination]);

  const startListening = () => {
    if (recognitionRef.current && !isSpeaking) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      setIsListening(false);
      recognitionRef.current.stop();
    }
  };

  const speakText = async (text: string) => {
    if (!elevenLabsApiKey || elevenLabsApiKey === 'YOUR_ELEVENLABS_API_KEY') {
      // Fallback to browser speech synthesis
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      speechSynthesis.speak(utterance);
      return;
    }

    try {
      setIsSpeaking(true);
      
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
        
        await audio.play();
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      setIsSpeaking(false);
    }
  };

  const handleUserInput = async (input: string) => {
    if (!perplexityApiKey) {
      speakText("I'm sorry, but I need a Perplexity API key to answer your questions.");
      return;
    }

    try {
      const landmarkNames = landmarks.map(l => l.name).join(', ');
      const prompt = `You are a knowledgeable tour guide for ${destination}. The user is asking: "${input}". 

Available landmarks in their tour: ${landmarkNames}

Please provide a helpful, conversational response about the destination or landmarks. Keep your response under 200 words and speak as if you're a friendly local guide. If they ask about a specific landmark, provide interesting facts and tips.`;

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
        speakText(aiResponse);
      } else {
        speakText("I'm sorry, I couldn't process your question right now. Please try again.");
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      speakText("I'm sorry, I encountered an error. Please try asking again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center space-y-6 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Voice Tour Guide</h2>
            <p className="text-sm text-muted-foreground">
              Ask me anything about your {destination} tour!
            </p>
          </div>

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
               'Tap to speak'}
            </p>

            {/* Microphone button */}
            <Button
              size="lg"
              variant={isListening ? "destructive" : "default"}
              onClick={isListening ? stopListening : startListening}
              disabled={isSpeaking}
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
              Press and hold the microphone to ask questions about your tour
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceAssistant;
