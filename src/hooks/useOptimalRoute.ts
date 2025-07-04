
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { decodePolyline, createRouteGeoJSON } from '@/utils/polylineDecoder';
import { TourLandmark } from '@/data/tourLandmarks';
import { toast } from "sonner";
import { calculateCentroid, calculateDistance, findNearestLandmark, formatDistance } from '@/utils/proximityUtils';

interface OptimalRouteResult {
  routeGeoJSON: GeoJSON.LineString | null;
  optimizedLandmarks: TourLandmark[];
  routeStats: {
    distanceKm: number;
    durationText: string;
    waypointCount: number;
  } | null;
}

interface UseOptimalRouteReturn extends OptimalRouteResult {
  isLoading: boolean;
  error: string | null;
  calculateOptimalRoute: (
    userLocation: [number, number], 
    landmarks: TourLandmark[]
  ) => Promise<void>;
  clearRoute: () => void;
}

export const useOptimalRoute = (): UseOptimalRouteReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeGeoJSON, setRouteGeoJSON] = useState<GeoJSON.LineString | null>(null);
  const [optimizedLandmarks, setOptimizedLandmarks] = useState<TourLandmark[]>([]);
  const [routeStats, setRouteStats] = useState<OptimalRouteResult['routeStats']>(null);

  const calculateOptimalRoute = useCallback(async (
    userLocation: [number, number], 
    landmarks: TourLandmark[]
  ) => {
    if (!landmarks || landmarks.length === 0) {
      toast.error("No landmarks available for route optimization");
      return;
    }

    if (landmarks.length < 2) {
      toast.error("At least 2 landmarks are needed for route optimization");
      return;
    }

    console.log('🚀 Starting optimal route calculation:', {
      userLocation,
      landmarkCount: landmarks.length
    });

    setIsLoading(true);
    setError(null);
    setRouteGeoJSON(null);
    setOptimizedLandmarks([]);
    setRouteStats(null);

    try {
      // Step 1: Calculate tour centroid and determine optimal starting point
      const tourCentroid = calculateCentroid(landmarks);
      const userLocationForDistance = { 
        latitude: userLocation[1], 
        longitude: userLocation[0] 
      };
      
      const distanceToCentroid = calculateDistance(
        userLocationForDistance.latitude,
        userLocationForDistance.longitude,
        tourCentroid[1], // latitude
        tourCentroid[0]  // longitude
      );

      // Tour proximity threshold: 20km (aligned with city nearby search radius)
      const TOUR_PROXIMITY_THRESHOLD = 20000; // 20km in meters
      
      let routeOrigin: [number, number];
      let routeStartMessage: string;
      
      if (distanceToCentroid <= TOUR_PROXIMITY_THRESHOLD) {
        // Use user location as origin
        routeOrigin = userLocation;
        routeStartMessage = `Starting route from your location (${formatDistance(distanceToCentroid)} from tour area)`;
        console.log('📍 User within tour area, starting from user location:', {
          userLocation,
          distanceToCentroid: formatDistance(distanceToCentroid)
        });
      } else {
        // Use closest landmark as origin
        const nearest = findNearestLandmark(userLocationForDistance, landmarks);
        if (!nearest) {
          throw new Error('Failed to find nearest landmark for route starting point');
        }
        
        routeOrigin = nearest.landmark.coordinates;
        routeStartMessage = `Starting route from ${nearest.landmark.name} - you're ${formatDistance(distanceToCentroid)} away from the tour area`;
        console.log('📍 User far from tour area, starting from closest landmark:', {
          startingLandmark: nearest.landmark.name,
          landmarkCoordinates: routeOrigin,
          distanceToCentroid: formatDistance(distanceToCentroid)
        });
      }

      // Prepare waypoints for the API
      const waypoints = landmarks.map(landmark => ({
        placeId: landmark.placeId,
        coordinates: landmark.coordinates as [number, number]
      }));

      console.log('📍 Prepared waypoints:', waypoints.length);

      // Call the edge function with determined origin
      const { data, error: apiError } = await supabase.functions.invoke('google-routes-optimization', {
        body: {
          origin: { coordinates: routeOrigin },
          waypoints,
          returnToOrigin: true
        }
      });

      if (apiError) {
        console.error('❌ Edge function error:', apiError);
        throw new Error(apiError.message || 'Route optimization failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Route optimization failed');
      }

      console.log('✅ Route optimization successful:', data);

      const { route } = data;

      // Decode the polyline
      const decodedCoordinates = decodePolyline(route.encodedPolyline);
      if (decodedCoordinates.length === 0) {
        throw new Error('Failed to decode route polyline');
      }

      // Create GeoJSON for the route
      const geoJSON = createRouteGeoJSON(decodedCoordinates);
      setRouteGeoJSON(geoJSON);

      // Reorder landmarks based on optimization
      const optimizedOrder = route.optimizedWaypointOrder || [];
      const reorderedLandmarks: TourLandmark[] = [];
      
      // Add landmarks in optimized order
      optimizedOrder.forEach((originalIndex: number) => {
        if (originalIndex < landmarks.length) {
          reorderedLandmarks.push(landmarks[originalIndex]);
        }
      });

      // If no optimization was provided, use original order
      if (reorderedLandmarks.length === 0) {
        reorderedLandmarks.push(...landmarks);
      }

      setOptimizedLandmarks(reorderedLandmarks);

      // Set route statistics
      const distanceKm = Math.round((route.distanceMeters || 0) / 1000 * 100) / 100;
      const durationMinutes = route.duration ? parseInt(route.duration.replace('s', '')) / 60 : 0;
      const durationText = durationMinutes > 60 
        ? `${Math.floor(durationMinutes / 60)}h ${Math.round(durationMinutes % 60)}m`
        : `${Math.round(durationMinutes)}m`;

      setRouteStats({
        distanceKm,
        durationText,
        waypointCount: reorderedLandmarks.length
      });

      // Show the route start message and success message
      toast.success(routeStartMessage);
      toast.success(`Optimal route calculated: ${distanceKm}km, ~${durationText} walking`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to calculate optimal route';
      console.error('❌ Optimal route calculation failed:', err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearRoute = useCallback(() => {
    setRouteGeoJSON(null);
    setOptimizedLandmarks([]);
    setRouteStats(null);
    setError(null);
    console.log('🧹 Route cleared');
  }, []);

  return {
    isLoading,
    error,
    routeGeoJSON,
    optimizedLandmarks,
    routeStats,
    calculateOptimalRoute,
    clearRoute
  };
};
