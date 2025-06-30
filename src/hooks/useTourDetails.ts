
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
        const { data, error } = await supabase.functions.invoke('get-tour-details', {
          body: { tourId: firstLandmarkWithTourId.tourId }
        });

        if (error) {
          console.error('❌ Error fetching tour details:', error);
          throw error;
        }

        console.log('✅ Successfully fetched tour details:', data);
        setTourDetails(data);

      } catch (err) {
        console.error('❌ Failed to fetch tour details:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch tour details');
        setTourDetails(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTourDetails();
  }, [landmarks]);

  return { tourDetails, isLoading, error };
};
