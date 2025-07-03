
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { TOUR_LANDMARKS } from '@/data/tourLandmarks';

interface OptimalRouteResult {
  geometry: any;
  distance: number;
  duration: number;
  waypoint_order: number[];
}

export const useOptimalRoute = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<OptimalRouteResult | null>(null);
  const { userLocation } = useLocationTracking();

  const calculateOptimalRoute = async () => {
    if (!userLocation) {
      setError('User location not available');
      return null;
    }

    if (TOUR_LANDMARKS.length === 0) {
      setError('No tour landmarks available');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Prepare coordinates: user location + all tour landmarks
      const coordinates = [
        [userLocation.longitude, userLocation.latitude], // Start at user location
        ...TOUR_LANDMARKS.map(landmark => landmark.coordinates)
      ];

      console.log('Calculating optimal route for coordinates:', coordinates);

      const { data, error: functionError } = await supabase.functions.invoke('mapbox-optimization', {
        body: { coordinates }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Failed to calculate optimal route');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const routeResult = data.route;
      setRoute(routeResult);
      return routeResult;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Error calculating optimal route:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    calculateOptimalRoute,
    isLoading,
    error,
    route,
    hasUserLocation: !!userLocation,
    hasTourLandmarks: TOUR_LANDMARKS.length > 0
  };
};
