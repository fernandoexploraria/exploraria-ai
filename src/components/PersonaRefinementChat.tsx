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

const REFINEMENT_SYSTEM_PROMPT = `You are an expert AI Persona Development Assistant. Your primary goal is to help refine ONLY the "Agent Persona & Role Definition" section (Section 1) of an AI tour guide's system prompt.

Your task is to engage the Creator in a structured conversation to refine the persona and role definition specifically. Focus on:

1. Core personality traits and characteristics
2. Professional demeanor and communication style  
3. Unique voice and approach to guiding tourists
4. Emotional tone and energy level
5. Cultural sensitivity and inclusiveness

Do NOT modify or discuss other sections like landmarks, functions, or technical instructions - focus ONLY on the persona and role definition.

Key Constraints:
- Keep responses concise and focused on personality refinement
- Ask one main question at a time
- Elicit specific examples of how personality traits manifest in conversations
- Help differentiate this AI guide from generic tour guides
- Ensure the refined persona is actionable for AI implementation

When you provide the final refined section, make it comprehensive but focused only on the Agent Persona & Role Definition.`;

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

  const extractSection1 = (promptText: string): string => {
    const lines = promptText.split('\n');
    // Section 1 is typically the first few lines before the Core Mission section
    const sectionEndIndex = lines.findIndex((line, index) => 
      index > 2 && line.includes('**Your Core Mission:**')
    );
    
    if (sectionEndIndex === -1) {
      // If no clear section marker found, take first 3 lines
      return lines.slice(0, 3).join('\n');
    }
    
    return lines.slice(0, sectionEndIndex).join('\n');
  };

  const integrateRefinedSection1 = (originalPrompt: string, refinedSection1: string): string => {
    const lines = originalPrompt.split('\n');
    const section2StartIndex = lines.findIndex((line, index) => 
      index > 2 && line.includes('**Your Core Mission:**')
    );
    
    if (section2StartIndex === -1) {
      // If no clear section marker, replace first 3 lines and keep the rest
      return [refinedSection1, '', ...lines.slice(3)].join('\n');
    }
    
    // Replace Section 1, add spacing, then keep Section 2 and beyond
    return [refinedSection1, '', ...lines.slice(section2StartIndex)].join('\n');
  };

  const initializeConversation = async () => {
    const section1Content = extractSection1(initialPrompt);
    
    const contextualPrompt = `I need help refining the Agent Persona & Role Definition (Section 1) for my AI tour guide. Here's my current setup:

Destination: ${destination}
Landmarks included: ${landmarks.map(l => l.name).join(', ')}

Current Section 1 - Agent Persona & Role Definition:
"${section1Content}"

Please analyze this persona definition and help me refine it to be more detailed, specific, and effective for an AI tour guide. Focus only on personality, communication style, and role characteristics.`;

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

    const finalPrompt = `Based on our conversation, please generate the final, refined Agent Persona & Role Definition section. This should be a comprehensive personality and role description that will replace Section 1 of the AI tour guide's system prompt.

Focus ONLY on the persona and role definition - do not include landmarks, functions, or technical instructions.

Here's our conversation:
${conversationContext}

Please provide ONLY the refined Agent Persona & Role Definition section text, no additional explanation or formatting.`;

    const response = await callGemini(finalPrompt, REFINEMENT_SYSTEM_PROMPT);
    
    if (response) {
      // Integrate the refined Section 1 back into the full original prompt
      const updatedFullPrompt = integrateRefinedSection1(initialPrompt, response);
      onPromptRefined(updatedFullPrompt);
      toast.success('Section 1 has been refined and integrated into the full system prompt!');
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