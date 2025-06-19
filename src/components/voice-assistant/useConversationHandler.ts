
import { useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { useGeminiAPI } from '@/hooks/useGeminiAPI';

interface LandmarkSuggestion {
  name: string;
  coordinates: [number, number];
  description: string;
}

interface UseConversationHandlerProps {
  destination: string;
  landmarks: Landmark[];
  speakText: (text: string) => Promise<void>;
  onAddLandmarks?: (newLandmarks: Landmark[]) => void;
}

export const useConversationHandler = ({
  destination,
  landmarks,
  speakText,
  onAddLandmarks
}: UseConversationHandlerProps) => {
  const [suggestedLandmarks, setSuggestedLandmarks] = useState<LandmarkSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { toast } = useToast();
  const { user, session } = useAuth();
  const { callGemini } = useGeminiAPI();

  const extractLandmarkSuggestions = (aiResponse: string): LandmarkSuggestion[] => {
    const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      try {
        const suggestions = JSON.parse(jsonMatch[0]);
        return suggestions.filter((s: any) => 
          s.name && s.coordinates && Array.isArray(s.coordinates) && s.description
        );
      } catch (error) {
        console.log('Could not parse landmark suggestions from AI response');
      }
    }
    return [];
  };

  const storeInteraction = async (userInput: string, assistantResponse: string) => {
    try {
      console.log('Attempting to store interaction...', { userInput, assistantResponse, destination });
      
      if (!user || !session) {
        console.log('No authenticated user found');
        toast({
          title: "Authentication Required",
          description: "Please log in to save your conversations.",
          variant: "destructive"
        });
        return;
      }

      console.log('User authenticated, calling edge function...');

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
        toast({
          title: "Conversation Saved",
          description: "Your interaction has been saved.",
        });
      }
    } catch (error) {
      console.error('Unexpected error storing interaction:', error);
      toast({
        title: "Storage Error",
        description: "An unexpected error occurred while saving.",
        variant: "destructive"
      });
    }
  };

  const handleUserInput = async (input: string) => {
    console.log('Processing user input:', input);

    try {
      const landmarkNames = landmarks.map(l => l.name).join(', ');
      
      const systemInstruction = `You are an enthusiastic, knowledgeable tour guide for ${destination}. Always provide engaging, conversational responses with follow-up questions.`;
      
      const prompt = `The user is asking: "${input}". 

Available landmarks in their current tour: ${landmarkNames}

As an engaging tour guide, you should:
1. Answer their question with interesting stories and context
2. Suggest 2-3 additional related landmarks or hidden gems they might enjoy
3. Provide practical tips (best times to visit, photography spots, local insights)
4. Ask a follow-up question to keep the conversation flowing
5. If suggesting new landmarks, format them as JSON at the end like this:
[{"name": "Landmark Name", "coordinates": [longitude, latitude], "description": "Brief description"}]

Keep your main response conversational and under 200 words, then add the JSON suggestions if any. Speak as if you're a passionate local who loves sharing hidden gems and stories about ${destination}.`;

      console.log('Calling Gemini API...');
      
      const aiResponse = await callGemini(prompt, systemInstruction);
      
      if (!aiResponse) {
        const errorResponse = "I'm sorry, I couldn't process your question right now. Please try again.";
        await speakText(errorResponse);
        await storeInteraction(input, errorResponse);
        return;
      }

      console.log('Got AI response:', aiResponse);
      
      // Extract landmark suggestions
      const suggestions = extractLandmarkSuggestions(aiResponse);
      if (suggestions.length > 0) {
        setSuggestedLandmarks(suggestions);
        setShowSuggestions(true);
      }
      
      // Clean response for speech (remove JSON part)
      const cleanResponse = aiResponse.replace(/\[[\s\S]*?\]/, '').trim();
      
      await speakText(cleanResponse);
      await storeInteraction(input, aiResponse);
      
      // Ask if they want to add suggestions after speaking
      if (suggestions.length > 0) {
        setTimeout(async () => {
          const addQuestion = `I found ${suggestions.length} additional interesting spots. Would you like me to add them to your map?`;
          await speakText(addQuestion);
        }, 1000);
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorResponse = "I'm sorry, I encountered an error. Please try asking again.";
      await speakText(errorResponse);
      await storeInteraction(input, errorResponse);
    }
  };

  const handleAddSuggestedLandmarks = async () => {
    if (!onAddLandmarks || suggestedLandmarks.length === 0) return;
    
    const newLandmarks: Landmark[] = suggestedLandmarks.map(suggestion => ({
      id: `suggested-${crypto.randomUUID()}`,
      name: suggestion.name,
      coordinates: suggestion.coordinates,
      description: suggestion.description
    }));
    
    onAddLandmarks(newLandmarks);
    setShowSuggestions(false);
    setSuggestedLandmarks([]);
    
    toast({
      title: "Landmarks Added!",
      description: `Added ${newLandmarks.length} new landmarks to your map.`,
    });
    
    await speakText(`Great! I've added ${newLandmarks.length} new landmarks to your map. You can now explore them!`);
  };

  const handleDeclineSuggestions = async () => {
    setShowSuggestions(false);
    setSuggestedLandmarks([]);
    await speakText("No problem! Feel free to ask me anything else about your tour.");
  };

  return {
    suggestedLandmarks,
    showSuggestions,
    handleUserInput,
    handleAddSuggestedLandmarks,
    handleDeclineSuggestions
  };
};
