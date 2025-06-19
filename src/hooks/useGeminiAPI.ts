
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

export const useGeminiAPI = () => {
  const [isLoading, setIsLoading] = useState(false);

  const callGemini = async (prompt: string, systemInstruction?: string) => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: {
          prompt,
          systemInstruction
        }
      });

      if (error) {
        console.error('Gemini API error:', error);
        toast.error("Failed to get AI response. Please try again.");
        return null;
      }

      return data.response;
    } catch (err) {
      console.error('Error calling Gemini API:', err);
      toast.error("An error occurred while processing your request.");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { callGemini, isLoading };
};
