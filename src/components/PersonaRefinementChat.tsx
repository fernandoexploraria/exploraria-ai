import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader, X, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGeminiAPI } from '@/hooks/useGeminiAPI';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PersonaRefinementChatProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt: string;
  destination: string;
  landmarks: Array<{ name: string; description: string }>;
  onPromptRefined: (refinedPrompt: string) => void;
}

const REFINEMENT_SYSTEM_PROMPT = `You are an expert AI Persona Development Assistant. Your primary goal is to collaboratively help a human tour guide (who is your user, hereafter referred to as the 'Creator') define and refine the detailed personality and role of their AI tour guide. The ultimate output will be a highly specific and actionable persona description suitable for integration into an AI system's primary system prompt.

The Creator will provide an initial, broad persona definition. Your task is to engage them in a structured conversation by asking a series of probing, insightful questions. Your questions must be designed to draw out nuanced details, practical implications for the AI's behavior in a travel context, and unique selling propositions.

Key Constraints & Focus Areas for Refinement:

Travel Experience Focus: Every question should directly relate to the AI's role in guiding users through a physical location, informing about landmarks, ensuring visitor experience (safety, comfort, enjoyment), and maintaining engagement during a live tour.

AI Actionability: Questions should elicit details that can be translated into concrete AI conversational style, information delivery patterns, and responses to unexpected situations.

Uniqueness & Differentiation: Help the Creator articulate what makes their AI guide stand out from a generic tour guide.

Problem Solving: Explore how the AI should handle common tour guide challenges (e.g., off-topic questions, user frustration, safety advice, managing pace).

Your Conversational Process:

Start Broad, Then Drill Down: Begin with high-level questions, then ask follow-up questions to delve into specifics based on the Creator's answers.

Elicit Examples: Encourage the Creator to provide concrete examples or analogies (e.g., "Can you give an example of how your guide would express enthusiasm for a historical fact?").

Focus on Behavior: Translate personality traits into observable behaviors for an AI (e.g., "How does a 'humorous' guide express humor in a way that's appropriate for a historical site?").

Propose Summaries: After a few rounds of questions, offer a synthesized summary of the refined persona, and ask for the Creator's feedback for further iteration.

Be conversational, engaging, and focus on one main question at a time. Keep responses concise but insightful.`;

export const PersonaRefinementChat: React.FC<PersonaRefinementChatProps> = ({
  isOpen,
  onClose,
  initialPrompt,
  destination,
  landmarks,
  onPromptRefined,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { callGemini, isLoading } = useGeminiAPI();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Initialize conversation when dialog opens
  useEffect(() => {
    if (isOpen && !isInitialized) {
      initializeConversation();
      setIsInitialized(true);
    }
    if (!isOpen) {
      setIsInitialized(false);
      setMessages([]);
    }
  }, [isOpen]);

  const initializeConversation = async () => {
    const contextualPrompt = `I need help refining the AI persona for a tour guide experience. Here's my current setup:

Destination: ${destination}
Landmarks included: ${landmarks.map(l => l.name).join(', ')}

Current AI persona definition:
"${initialPrompt}"

Please analyze this initial persona and help me refine it into something more detailed and effective.`;

    const response = await callGemini(contextualPrompt, REFINEMENT_SYSTEM_PROMPT);
    
    if (response) {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages([assistantMessage]);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Build conversation context for Gemini
    const conversationContext = messages
      .map(msg => `${msg.role === 'user' ? 'Creator' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');
    
    const fullPrompt = `${conversationContext}\n\nCreator: ${userMessage.content}`;

    const response = await callGemini(fullPrompt, REFINEMENT_SYSTEM_PROMPT);
    
    if (response) {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const generateFinalPrompt = async () => {
    const conversationContext = messages
      .map(msg => `${msg.role === 'user' ? 'Creator' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    const finalPrompt = `Based on our conversation, please generate the final, refined AI persona system prompt. Make it comprehensive, actionable, and ready to use as a system prompt for the AI tour guide. Include all the specific details we've discussed about personality, interaction style, knowledge delivery, and unique characteristics.

Here's our conversation:
${conversationContext}

Please provide ONLY the final system prompt, no additional explanation.`;

    const response = await callGemini(finalPrompt, REFINEMENT_SYSTEM_PROMPT);
    
    if (response) {
      onPromptRefined(response);
      toast.success('System prompt has been refined and updated!');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI Persona Refinement Assistant
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
            <div className="space-y-4 pb-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground ml-auto'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                    <div className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                    <Loader className="h-4 w-4 animate-spin" />
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t pt-4 space-y-3">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your response..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button onClick={sendMessage} disabled={isLoading || !inputValue.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Press Enter to send, Shift+Enter for new line
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  onClick={generateFinalPrompt}
                  disabled={messages.length < 3}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Apply Refined Prompt
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};