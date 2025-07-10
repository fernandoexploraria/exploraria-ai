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

interface Section2RefinementChatProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt: string;
  destination: string;
  landmarks: Array<{ name: string; description: string }>;
  onPromptRefined: (refinedPrompt: string) => void;
}

const SECTION2_REFINEMENT_SYSTEM_PROMPT = `You are the "Core Mission Refinement Coach" - an expert AI assistant specializing in refining ONLY the "Core Mission & Behavioral Principles" section (Section 2) of an AI tour guide's system prompt.

Your primary goal is to help refine the Core Mission section to be more specific, actionable, and effective for an AI in live, interactive travel experiences.

Focus on these 4 core mission areas:
1. **Engage and Inform** - Captivating facts, historical context, local anecdotes, practical tips
2. **Personalize** - Adapt to user interests, respond to questions, make experiences unique  
3. **Prioritize Experience** - Ensure safety, comfort, and maximum enjoyment
4. **Maintain Tone** - Be enthusiastic, professional, friendly, and always helpful

For each area, guide the user to provide more detail about:
- How the AI would practically achieve this goal
- What specific actions it would take or prioritize
- What kind of content or behavior it would focus on

Ask targeted questions to help refine each mission point to be more actionable and specific for AI implementation.

Key Constraints:
- Focus ONLY on Core Mission & Behavioral Principles (Section 2)
- Do NOT modify other sections like persona, landmarks, or technical instructions
- Keep responses structured around the 4 mission areas
- Help make goals specific and actionable for AI tour guides
- Ask one focused question at a time to avoid overwhelming the user

When providing the final refined section, make it comprehensive but focused only on the Core Mission & Behavioral Principles.`;

export const Section2RefinementChat: React.FC<Section2RefinementChatProps> = ({
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

  const extractSection2 = (promptText: string): string => {
    const lines = promptText.split('\n');
    
    // Find start and end markers for Section 2
    const startIndex = lines.findIndex(line => line.includes('**Your Core Mission:**'));
    const endIndex = lines.findIndex(line => line.includes('**Tour Destination Overview'));
    
    if (startIndex === -1) return '';
    
    const actualEndIndex = endIndex === -1 ? lines.length : endIndex;
    return lines.slice(startIndex, actualEndIndex).join('\n');
  };

  const integrateRefinedSection2 = (originalPrompt: string, refinedSection2: string): string => {
    const lines = originalPrompt.split('\n');
    
    // Find Section 2 boundaries
    const section2StartIndex = lines.findIndex(line => line.includes('**Your Core Mission:**'));
    const section3StartIndex = lines.findIndex(line => line.includes('**Tour Destination Overview'));
    
    if (section2StartIndex === -1) {
      return originalPrompt; // Can't find section 2, return original
    }
    
    // Build the new prompt
    const beforeSection2 = lines.slice(0, section2StartIndex);
    const afterSection2 = section3StartIndex === -1 ? [] : lines.slice(section3StartIndex);
    
    return [
      ...beforeSection2,
      refinedSection2,
      '',
      ...afterSection2
    ].join('\n');
  };

  const initializeConversation = async () => {
    const section2Content = extractSection2(initialPrompt);
    
    const contextualPrompt = `I need help refining the Core Mission & Behavioral Principles (Section 2) for my AI tour guide. Here's my current setup:

Destination: ${destination}
Landmarks included: ${landmarks.map(l => l.name).join(', ')}

Current Section 2 - Core Mission & Behavioral Principles:
"${section2Content}"

Please analyze this Core Mission section and help me refine it to be more detailed, specific, and actionable for an AI tour guide. Focus on the 4 core mission areas: Engage & Inform, Personalize, Prioritize Experience, and Maintain Tone.`;

    const response = await callGemini(contextualPrompt, SECTION2_REFINEMENT_SYSTEM_PROMPT);
    
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
      .map(msg => `${msg.role === 'user' ? 'Creator' : 'Coach'}: ${msg.content}`)
      .join('\n\n');
    
    const fullPrompt = `${conversationContext}\n\nCreator: ${userMessage.content}`;

    const response = await callGemini(fullPrompt, SECTION2_REFINEMENT_SYSTEM_PROMPT);
    
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
      .map(msg => `${msg.role === 'user' ? 'Creator' : 'Coach'}: ${msg.content}`)
      .join('\n\n');

    const finalPrompt = `Based on our conversation, please generate the final, refined Core Mission & Behavioral Principles section. This should be a comprehensive mission statement that will replace Section 2 of the AI tour guide's system prompt.

Focus ONLY on the Core Mission & Behavioral Principles - do not include persona, landmarks, or technical instructions.

IMPORTANT: Start your response with "**Your Core Mission:**" followed by the refined content.

Here's our conversation:
${conversationContext}

Please provide ONLY the refined Core Mission & Behavioral Principles section text starting with "**Your Core Mission:**", no additional explanation or formatting.`;

    const response = await callGemini(finalPrompt, SECTION2_REFINEMENT_SYSTEM_PROMPT);
    
    if (response) {
      // Integrate the refined Section 2 back into the full original prompt
      const updatedFullPrompt = integrateRefinedSection2(initialPrompt, response);
      onPromptRefined(updatedFullPrompt);
      toast.success('Section 2 has been refined and integrated into the full system prompt!');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Core Mission Refinement Coach
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