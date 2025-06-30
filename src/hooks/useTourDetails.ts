
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TourDetails {
  destination: string;
  systemPrompt: string;
}

export const useTourDetails = (landmarks: any[]) => {
  const [tourDetails, setTourDetails] = useState<TourDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTourDetails = async () => {
      // Only fetch if we have landmarks with tour_id
      const firstLandmarkWithTourId = landmarks.find(landmark => landmark.tourId);
      
      if (!firstLandmarkWithTourId?.tourId) {
        console.log('🔍 No landmarks with tour_id found, skipping database fetch');
        setTourDetails(null);
        return;
      }

      console.log('🔍 Fetching tour details for tour_id:', firstLandmarkWithTourId.tourId);
      setIsLoading(true);
      setError(null);

      try {
        console.log('📡 Calling get-tour-details function...');
        const { data, error } = await supabase.functions.invoke('get-tour-details', {
          body: { tourId: firstLandmarkWithTourId.tourId }
        });

        if (error) {
          console.error('❌ Supabase function error:', error);
          throw new Error(`Function error: ${error.message || 'Unknown error'}`);
        }

        if (!data) {
          console.error('❌ No data returned from function');
          throw new Error('No data returned from tour details function');
        }

        console.log('✅ Successfully fetched tour details:', data);
        setTourDetails(data);

      } catch (err) {
        console.error('❌ Failed to fetch tour details:', err);
        
        // Enhanced error handling
        let errorMessage = 'Failed to fetch tour details';
        if (err instanceof Error) {
          if (err.message.includes('CORS')) {
            errorMessage = 'CORS error - function may not be deployed correctly';
          } else if (err.message.includes('Failed to send a request')) {
            errorMessage = 'Network error - function may not be available';
          } else {
            errorMessage = err.message;
          }
        }
        
        setError(errorMessage);
        setTourDetails(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTourDetails();
  }, [landmarks]);

  return { tourDetails, isLoading, error };
};
