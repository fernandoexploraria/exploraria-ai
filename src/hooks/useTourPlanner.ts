
import { useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { toast } from "sonner";

export const useTourPlanner = () => {
  const [plannedLandmarks, setPlannedLandmarks] = useState<Landmark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateTour = async (destination: string, apiKey: string) => {
    if (!apiKey) {
      toast.error("Please provide a Perplexity API key.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPlannedLandmarks([]); // Clear previous results

    try {
      const prompt = `You are an expert tour planner. Provide a list of the top 5 most famous landmarks in ${destination}.
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
