
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TourDetails {
  destination: string;
  systemPrompt: string;
  // Enhanced with raw data access and photo capabilities
  landmarksWithRawData?: any[];
  landmarksWithPhotos?: any[];
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

      console.log('🔍 Fetching enhanced tour details for tour_id:', firstLandmarkWithTourId.tourId);
      setIsLoading(true);
      setError(null);

      try {
        // Fetch basic tour details
        console.log('📡 Calling get-tour-details function...');
        const { data: tourData, error: tourError } = await supabase.functions.invoke('get-tour-details', {
          body: { tourId: firstLandmarkWithTourId.tourId }
        });

        if (tourError) {
          console.error('❌ Supabase function error:', tourError);
          throw new Error(`Function error: ${tourError.message || 'Unknown error'}`);
        }

        if (!tourData) {
          console.error('❌ No data returned from function');
          throw new Error('No data returned from tour details function');
        }

        // 🔥 ENHANCED: Fetch landmark data with full photo capabilities
        console.log('🔍 Fetching enhanced landmark data with photo capabilities...');
        const { data: landmarksData, error: landmarksError } = await supabase
          .from('generated_landmarks')
          .select(`
            *,
            raw_data,
            price_level,
            user_ratings_total,
            website_uri,
            opening_hours,
            editorial_summary,
            photo_references
          `)
          .eq('tour_id', firstLandmarkWithTourId.tourId);

        if (landmarksError) {
          console.error('❌ Error fetching enhanced landmarks:', landmarksError);
          // Don't throw error, just log warning and continue with basic tour data
          console.warn('⚠️ Could not fetch enhanced landmark data, using basic tour details only');
        }

        // Enhanced logging with photo source analysis
        const photoSourceAnalysis = landmarksData?.reduce((acc: any, landmark: any) => {
          if (landmark.raw_data?.photos) acc.rawDataPhotos++;
          if (landmark.photos) acc.photosField++;
          if (landmark.photo_references?.length) acc.photoReferences++;
          return acc;
        }, { rawDataPhotos: 0, photosField: 0, photoReferences: 0 }) || {};

        console.log('✅ Successfully fetched enhanced tour details:', {
          destination: tourData.destination,
          landmarksCount: landmarksData?.length || 0,
          photoSources: photoSourceAnalysis,
          hasRawData: landmarksData?.some(l => l.raw_data) || false
        });

        setTourDetails({
          destination: tourData.destination,
          systemPrompt: tourData.systemPrompt,
          landmarksWithRawData: landmarksData || [],
          landmarksWithPhotos: landmarksData?.filter(l => 
            l.raw_data?.photos || l.photos || l.photo_references?.length
          ) || []
        });

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
