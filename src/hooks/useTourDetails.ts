
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TourDetails {
  destination: string;
  systemPrompt: string;
  // Enhanced with raw data access and photo capabilities
  landmarksWithRawData?: any[];
  landmarksWithPhotos?: any[];
}

export const useTourDetails = (landmarks: any[], forceRefresh: boolean = false) => {
  const [tourDetails, setTourDetails] = useState<TourDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize the tour ID to prevent unnecessary re-fetches
  const tourId = useMemo(() => {
    const firstLandmarkWithTourId = landmarks.find(landmark => landmark.tourId);
    return firstLandmarkWithTourId?.tourId || null;
  }, [landmarks]);

  // Debounce database calls to prevent rapid successive requests (unless forced refresh)
  const [debouncedTourId, setDebouncedTourId] = useState<string | null>(null);

  useEffect(() => {
    if (forceRefresh) {
      // Skip debounce for force refresh
      setDebouncedTourId(tourId);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      setDebouncedTourId(tourId);
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [tourId, forceRefresh]);

  useEffect(() => {
    const fetchTourDetails = async () => {
      console.log('🔍 DEBUG fetchTourDetails called:', {
        forceRefresh,
        debouncedTourId,
        hasTourDetails: !!tourDetails,
        landmarksCount: landmarks.length
      });

      // For force refresh, we need a valid tour ID - if not found, fail immediately
      if (forceRefresh && !debouncedTourId) {
        console.error('🚨 Force refresh requested but no tourId found in landmarks');
        setError('No tour ID found - cannot fetch tour details');
        setIsLoading(false);
        return;
      }

      // Skip cache checks if force refresh is enabled
      if (!forceRefresh) {
        // Only fetch if we have a valid tour_id and it's different from what we already have
        if (!debouncedTourId || (tourDetails && landmarks.some(l => l.tourId === debouncedTourId))) {
          // Skip if we already have tour details for this tour ID
          if (tourDetails && landmarks.some(l => l.tourId === debouncedTourId)) {
            return;
          }
          
          if (!debouncedTourId) {
            setTourDetails(null);
            return;
          }
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log('🔍 DEBUG Fetching tour details for tourId:', debouncedTourId);
        
        // Fetch basic tour details with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout - function may not be deployed')), 10000)
        );
        
        const fetchPromise = supabase.functions.invoke('get-tour-details', {
          body: { tourId: debouncedTourId }
        });
        
        const { data: tourData, error: tourError } = await Promise.race([fetchPromise, timeoutPromise]) as any;

        if (tourError) {
          throw new Error(`Function error: ${tourError.message || 'Unknown error'}`);
        }

        if (!tourData) {
          throw new Error('No data returned from tour details function');
        }

        // 🔥 ENHANCED: Fetch landmark data with full photo capabilities
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
          .eq('tour_id', debouncedTourId);

        if (landmarksError) {
          console.warn('⚠️ Could not fetch enhanced landmark data, using basic tour details only');
        }

        // Reduced logging for photo source analysis - only in development
        if (process.env.NODE_ENV === 'development') {
          const photoSourceAnalysis = landmarksData?.reduce((acc: any, landmark: any) => {
            if (landmark.raw_data?.photos) acc.rawDataPhotos++;
            if (landmark.photos) acc.photosField++;
            if (landmark.photo_references?.length) acc.photoReferences++;
            return acc;
          }, { rawDataPhotos: 0, photosField: 0, photoReferences: 0 }) || {};

          console.log('✅ Enhanced tour details fetched:', {
            destination: tourData.destination,
            landmarksCount: landmarksData?.length || 0,
            photoSources: photoSourceAnalysis
          });
        }

        setTourDetails({
          destination: tourData.destination,
          systemPrompt: tourData.systemPrompt,
          landmarksWithRawData: landmarksData || [],
          landmarksWithPhotos: landmarksData?.filter(l => 
            l.raw_data?.photos || l.photos || l.photo_references?.length
          ) || []
        });

      } catch (err) {
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
  }, [debouncedTourId, tourDetails, forceRefresh]); // Include forceRefresh to trigger fresh fetches

  return { tourDetails, isLoading, error };
};
