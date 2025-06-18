
import { useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useTourStats } from '@/hooks/useTourStats';

export const useTourPlanner = () => {
  const [plannedLandmarks, setPlannedLandmarks] = useState<Landmark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { subscriptionData } = useSubscription();
  const { tourStats, refetch: refetchTourStats } = useTourStats();

  const generateTour = async (destination: string, apiKey: string) => {
    if (!apiKey) {
      toast.error("Please provide a Perplexity API key.");
      return;
    }

    // Check if user is subscribed or within free tour limit
    const FREE_TOUR_LIMIT = 3;
    const toursUsed = tourStats?.tour_count || 0;
    const isSubscribed = subscriptionData?.subscribed || false;
    
    console.log('Tour generation check:', { toursUsed, isSubscribed, FREE_TOUR_LIMIT });
    
    if (!isSubscribed && toursUsed >= FREE_TOUR_LIMIT) {
      toast.error("You've reached your free tour limit. Please subscribe to generate more tours.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPlannedLandmarks([]); // Clear previous results

    try {
      const prompt = `You are an expert tour planner. Provide a list of the top 10 most famous landmarks in ${destination}.
      For each landmark, provide its name, a short description (2-3 sentences), and its geographic coordinates (latitude and longitude).
      VERY IMPORTANT: Your response MUST be a valid JSON array of objects. Do not include any text before or after the JSON array.
      Each object in the array should have the following structure:
      {
        "name": "Landmark Name",
        "coordinates": [longitude, latitude],
        "description": "A short description of the landmark."
      }
      Example for Paris:
      [
        {
          "name": "Eiffel Tower",
          "coordinates": [2.2945, 48.8584],
          "description": "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It's a global cultural icon."
        }
      ]
      `;
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            { role: 'system', content: 'You are an expert tour planner that only responds with valid JSON.' },
            { role: 'user', content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.message || "Failed to fetch tour plan from Perplexity.");
      }

      const data = await response.json();
      const responseText = data.choices[0].message.content;

      // Sometimes the model wraps the JSON in markdown, let's clean it.
      const cleanedJson = responseText.replace(/```json\n|```/g, '').trim();
      
      const landmarksData = JSON.parse(cleanedJson) as Omit<Landmark, 'id'>[];

      const newLandmarks: Landmark[] = landmarksData.map(lm => ({
        ...lm,
        id: `ai-${crypto.randomUUID()}`,
      }));

      setPlannedLandmarks(newLandmarks);
      
      // Increment tour count for authenticated users
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          console.log('Incrementing tour count for user:', user.id);
          const { data: tourCount, error: countError } = await supabase.rpc('increment_tour_count', {
            user_id: user.id
          });
          
          if (countError) {
            console.error('Error incrementing tour count:', countError);
          } else {
            console.log('Tour count updated:', tourCount);
            // Manually refetch tour stats to ensure UI updates
            setTimeout(() => {
              refetchTourStats();
            }, 500);
          }
        } catch (countErr) {
          console.error('Failed to update tour count:', countErr);
        }
      }
      
      toast.success(`Generated a tour for ${destination}!`);
      
    } catch (err) {
      console.error("Error generating tour:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      toast.error(`Failed to generate tour: ${errorMessage}`);
      setPlannedLandmarks([]);
    } finally {
      setIsLoading(false);
    }
  };

  return { plannedLandmarks, isLoading, error, generateTour };
};
