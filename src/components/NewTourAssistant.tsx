
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Landmark } from '@/data/landmarks';
import { useConversation } from '@11labs/react';

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
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>('');
  const [agentId, setAgentId] = useState<string>('');
  const [hasStarted, setHasStarted] = useState(false);
  const [conversationMessages, setConversationMessages] = useState<Array<{type: 'user' | 'assistant', text: string}>>([]);

  // Check for stored API key and agent ID on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('elevenlabs_api_key');
    const storedAgentId = localStorage.getItem('elevenlabs_agent_id');
    if (storedKey) {
      setElevenLabsApiKey(storedKey);
    }
    if (storedAgentId) {
      setAgentId(storedAgentId);
    }
  }, []);

  // Create dynamic prompt based on tour data
  const createTourPrompt = () => {
    const landmarkList = landmarks.map(l => l.name).join(', ');
    const landmarkDetails = landmarks.map(l => `${l.name}: ${l.description}`).join('\n');
    
    return `You are an expert tour guide for ${destination}. The user has planned to visit these landmarks: ${landmarkList}.

Here are details about each landmark:
${landmarkDetails}

Be enthusiastic, knowledgeable, and helpful. Provide interesting facts, tips, and recommendations. Keep your responses conversational and engaging, suitable for audio narration. Answer questions about the landmarks, provide historical context, suggest best times to visit, and share insider tips.`;
  };

  const firstMessage = `Welcome to ${destination}! I'm your personal AI tour guide, and I'm absolutely thrilled to help you explore this amazing destination. I see you're planning to visit ${landmarks.length} incredible landmarks. What would you like to know first? I can tell you about the best times to visit, share fascinating historical stories, or give you insider tips to make your trip unforgettable!`;

  // Initialize the conversation with dynamic configuration
  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs agent');
      toast({
        title: "Connected",
        description: "Connected to your tour guide!",
      });
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs agent');
      setHasStarted(false);
    },
    onMessage: (message) => {
      console.log('Received message:', message);
      // Add messages to our conversation history for display
      if (message.source === 'ai') {
        setConversationMessages(prev => [...prev, { type: 'assistant', text: message.message }]);
      } else if (message.source === 'user') {
        setConversationMessages(prev => [...prev, { type: 'user', text: message.message }]);
      }
    },
    onError: (error) => {
      console.error('Conversation error:', error);
      toast({
        title: "Connection Error",
        description: "There was an issue with the tour guide connection.",
        variant: "destructive"
      });
    },
    overrides: {
      agent: {
        prompt: {
          prompt: createTourPrompt()
        },
        firstMessage: firstMessage,
        language: "en"
      }
    }
  });

  const handleApiKeySubmit = (key: string, agent: string) => {
    setElevenLabsApiKey(key);
    setAgentId(agent);
    localStorage.setItem('elevenlabs_api_key', key);
    localStorage.setItem('elevenlabs_agent_id', agent);
    toast({
      title: "Configuration Saved",
      description: "ElevenLabs configuration has been saved successfully.",
    });
  };

  const handleStartTour = async () => {
    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Generate signed URL for the conversation
      const response = await fetch('/api/elevenlabs-signed-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: agentId,
          apiKey: elevenLabsApiKey
        })
      });

      if (!response.ok) {
        // Fallback to direct agent connection if signed URL generation fails
        await conversation.startSession({ agentId: agentId });
      } else {
        const { signedUrl } = await response.json();
        await conversation.startSession({ url: signedUrl });
      }
      
      setHasStarted(true);
      setConversationMessages([]);
      
    } catch (error) {
      console.error('Error starting tour:', error);
      toast({
        title: "Error",
        description: "Failed to start tour guide. Please check your configuration and try again.",
        variant: "destructive"
      });
    }
  };

  const handleEndTour = async () => {
    try {
      await conversation.endSession();
      setHasStarted(false);
      setConversationMessages([]);
    } catch (error) {
      console.error('Error ending tour:', error);
    }
  };

  const handleClose = () => {
    if (hasStarted) {
      handleEndTour();
    }
    onOpenChange(false);
  };

  // Show configuration input if not provided
  if (!elevenLabsApiKey || !agentId) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ElevenLabs Configuration Required</DialogTitle>
            <DialogDescription>
              To use the voice tour guide, please enter your ElevenLabs API key and Agent ID.
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
                defaultValue={elevenLabsApiKey}
              />
            </div>

            <div>
              <label htmlFor="agentid" className="block text-sm font-medium mb-2">
                Agent ID
              </label>
              <input
                id="agentid"
                type="text"
                placeholder="Enter your ElevenLabs Agent ID..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue={agentId}
              />
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p>1. Get your API key from <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">ElevenLabs.io</a></p>
              <p>2. Create a Conversational AI agent in your ElevenLabs dashboard</p>
              <p>3. Copy the Agent ID from your agent settings</p>
              <p className="mt-1">Your configuration will be stored locally in your browser.</p>
            </div>
            
            <Button
              onClick={() => {
                const apiKeyInput = document.getElementById('apikey') as HTMLInputElement;
                const agentIdInput = document.getElementById('agentid') as HTMLInputElement;
                if (apiKeyInput?.value.trim() && agentIdInput?.value.trim()) {
                  handleApiKeySubmit(apiKeyInput.value.trim(), agentIdInput.value.trim());
                }
              }}
              className="w-full"
            >
              Save Configuration
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
                disabled={conversation.status === 'connecting'}
                size="lg"
                className="bg-blue-500 hover:bg-blue-600"
              >
                {conversation.status === 'connecting' ? 'Connecting...' : 'Start Tour Guide'}
              </Button>
            </div>
          ) : (
            <>
              {/* Conversation History */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-3 min-h-0">
                {conversationMessages.map((message, index) => (
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
              </div>

              {/* Voice Controls */}
              <div className="flex flex-col items-center space-y-4 py-4 border-t">
                <div className="flex items-center space-x-4">
                  <Button
                    size="lg"
                    className={`w-20 h-20 rounded-full transition-all duration-200 ${
                      conversation.isSpeaking 
                        ? 'bg-green-500 hover:bg-green-600 animate-pulse'
                        : conversation.status === 'connected'
                        ? 'bg-blue-500 hover:bg-blue-600'
                        : 'bg-gray-400'
                    }`}
                    disabled={conversation.status !== 'connected'}
                  >
                    {conversation.isSpeaking ? (
                      <Volume2 className="w-8 h-8" />
                    ) : (
                      <Mic className="w-8 h-8" />
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleEndTour}
                    variant="outline"
                    size="lg"
                  >
                    End Tour
                  </Button>
                </div>
                
                <div className="text-center text-sm text-muted-foreground">
                  {conversation.status === 'connecting' && "Connecting to tour guide..."}
                  {conversation.status === 'connected' && !conversation.isSpeaking && "Listening... Speak naturally with your tour guide"}
                  {conversation.status === 'connected' && conversation.isSpeaking && "Tour guide speaking..."}
                  {conversation.status === 'disconnected' && "Disconnected from tour guide"}
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
