import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { TOUR_LANDMARKS } from '@/data/tourLandmarks';

interface OptimalRouteState {
  isLoading: boolean;
  error: string | null;
  route: any | null;
}

export const useOptimalRoute = () => {
  const [state, setState] = useState<OptimalRouteState>({
    isLoading: false,
    error: null,
    route: null
  });

  const { userLocation } = useLocationTracking();

  const calculateOptimalRoute = useCallback(async () => {
    if (!userLocation) {
      setState(prev => ({ ...prev, error: 'User location not available' }));
      return null;
    }

    if (TOUR_LANDMARKS.length === 0) {
      setState(prev => ({ ...prev, error: 'No tour landmarks available' }));
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('🔄 Calculating optimal route with', TOUR_LANDMARKS.length, 'landmarks');

      // Build coordinates array: start with user location, add all tour landmarks
      const coordinates = [
        [userLocation.longitude, userLocation.latitude], // Starting point
        ...TOUR_LANDMARKS.map(landmark => landmark.coordinates)
      ];

      console.log('📍 Route coordinates:', {
        userLocation: [userLocation.longitude, userLocation.latitude],
        landmarkCount: TOUR_LANDMARKS.length,
        totalPoints: coordinates.length
      });

      const { data, error } = await supabase.functions.invoke('mapbox-optimization', {
        body: {
          coordinates,
          profile: 'walking'
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to calculate optimal route');
      }

      if (!data?.success || !data?.route) {
        throw new Error('No optimal route found');
      }

      console.log('✅ Optimal route calculated:', {
        distance: Math.round(data.route.distance),
        duration: Math.round(data.route.duration / 60),
        waypoints: data.route.waypointOrder?.length || 0
      });

      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        route: data.route,
        error: null 
      }));

      return data.route;
    } catch (error) {
      console.error('❌ Failed to calculate optimal route:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to calculate route' 
      }));
      return null;
    }
  }, [userLocation]);

  const displayOptimalRoute = useCallback(async () => {
    const route = await calculateOptimalRoute();
    
    if (route && (window as any).showOptimalRoute) {
      (window as any).showOptimalRoute(route);
    }
    
    return route;
  }, [calculateOptimalRoute]);

  return {
    ...state,
    calculateOptimalRoute,
    displayOptimalRoute,
    hasUserLocation: !!userLocation,
    hasTourLandmarks: TOUR_LANDMARKS.length > 0
  };
};