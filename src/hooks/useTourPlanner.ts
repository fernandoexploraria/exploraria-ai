import { useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { setTourLandmarks, clearTourMarkers } from '@/data/tourLandmarks';
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useTourStats } from '@/hooks/useTourStats';
import { useGeminiAPI } from '@/hooks/useGeminiAPI';

export interface TourPlan {
  landmarks: Landmark[];
  systemPrompt: string;
  destination: string;
}

export const useTourPlanner = () => {
  const [tourPlan, setTourPlan] = useState<TourPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { subscriptionData } = useSubscription();
  const { tourStats, forceRefresh } = useTourStats();
  const { callGemini } = useGeminiAPI();

  // Keep backward compatibility
  const plannedLandmarks = tourPlan?.landmarks || [];

  const generateTour = async (destination: string) => {
    // Check current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to generate tours.");
      return;
    }

    console.log('Generating tour for user:', user.id);

    // Clear existing tour markers first
    clearTourMarkers();

    // Check if user is subscribed or within free tour limit
    const FREE_TOUR_LIMIT = 3;
    const toursUsed = tourStats?.tour_count || 0;
    const isSubscribed = subscriptionData?.subscribed || false;
    
    console.log('Tour generation check:', { toursUsed, isSubscribed, FREE_TOUR_LIMIT, userId: user.id });
    
    if (!isSubscribed && toursUsed >= FREE_TOUR_LIMIT) {
      toast.error("You've reached your free tour limit. Please subscribe to generate more tours.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setTourPlan(null); // Clear previous results

    try {
      // ... keep existing code (systemInstruction and prompt definitions)
      const systemInstruction = `You are an expert tour planner. Your response MUST be a valid JSON object with exactly this structure:
      {
        "landmarks": [array of landmark objects],
        "systemPrompt": "string containing the ElevenLabs assistant system prompt"
      }
      
      Do not include any text before or after the JSON object.
      Each landmark object should have: {"name": "string", "coordinates": [longitude, latitude], "description": "string"}
      
      The systemPrompt should be a comprehensive prompt for an AI tour guide that includes:
      - Deep knowledge about the destination's history, culture, and significance
      - Specific information about the landmarks you're providing
      - Engaging storytelling elements and local insights
      - Tips about best times to visit, routes between landmarks, and hidden gems
      - A conversational, enthusiastic tone suitable for audio narration`;

      const prompt = `Create a comprehensive tour plan for ${destination} that includes:

      1. A list of the top 10 most famous landmarks with their exact coordinates and descriptions
      2. A detailed system prompt for an AI tour guide assistant that will provide audio narration

      The system prompt should make the AI assistant an expert on ${destination} with deep knowledge about:
      - The historical and cultural significance of each landmark
      - Interesting stories and facts about the destination
      - Practical tips for visitors (best times to visit, routes, local customs)
      - Connections between the landmarks and how they relate to the city's story
      - Local insights and hidden gems
      
      Format the response as a JSON object with "landmarks" and "systemPrompt" fields.`;
      
      console.log('Calling Gemini API for comprehensive tour generation...');
      
      const responseText = await callGemini(prompt, systemInstruction);
      
      if (!responseText) {
        throw new Error("Failed to get response from AI service.");
      }

      console.log('Got Gemini response:', responseText);
      
      // Sometimes the model wraps the JSON in markdown, let's clean it.
      const cleanedJson = responseText.replace(/```json\n|```/g, '').trim();
      
      const tourData = JSON.parse(cleanedJson);

      if (!tourData.landmarks || !tourData.systemPrompt) {
        throw new Error("Invalid tour data structure received from AI.");
      }

      const newLandmarks: Landmark[] = tourData.landmarks.map((lm: Omit<Landmark, 'id'>) => ({
        ...lm,
        id: `tour-landmark-${crypto.randomUUID()}`,
      }));

      // Set tour landmarks in the separate array (this clears and repopulates)
      console.log('Setting tour landmarks in separate array:', newLandmarks.length);
      setTourLandmarks(tourData.landmarks.map((lm: any) => ({
        name: lm.name,
        coordinates: lm.coordinates,
        description: lm.description
      })));

      const newTourPlan: TourPlan = {
        landmarks: newLandmarks,
        systemPrompt: tourData.systemPrompt,
        destination: destination
      };

      setTourPlan(newTourPlan);
      
      // ... keep existing code (increment tour count logic)
      try {
        console.log('Calling increment_tour_count function for user:', user.id);
        
        // Call the database function to increment tour count with correct parameter name
        const { data: incrementResult, error: incrementError } = await supabase.rpc('increment_tour_count', {
          p_user_id: user.id
        });
        
        if (incrementError) {
          console.error('Error calling increment_tour_count:', incrementError);
          // Try to insert directly if the function fails
          console.log('Attempting direct insert/update...');
          const { data: insertResult, error: insertError } = await supabase
            .from('user_tour_stats')
            .upsert({
              user_id: user.id,
              tour_count: toursUsed + 1,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            })
            .select()
            .single();
          
          if (insertError) {
            console.error('Error with direct insert:', insertError);
          } else {
            console.log('Direct insert successful:', insertResult);
          }
        } else {
          console.log('increment_tour_count successful, new count:', incrementResult);
        }
        
        // Force refresh tour stats after increment
        console.log('Triggering force refresh of tour stats...');
        await forceRefresh();
        
      } catch (countErr) {
        console.error('Failed to update tour count:', countErr);
      }
      
      toast.success(`Generated a comprehensive tour for ${destination}! Tour landmarks added with green markers.`);
      
    } catch (err) {
      console.error("Error generating tour:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      toast.error(`Failed to generate tour: ${errorMessage}`);
      setTourPlan(null);
    } finally {
      setIsLoading(false);
    }
  };

  return { 
    tourPlan, 
    plannedLandmarks, // Keep for backward compatibility
    isLoading, 
    error, 
    generateTour 
  };
};
