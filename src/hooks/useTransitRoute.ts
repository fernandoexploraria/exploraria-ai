import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { decodePolyline, createRouteGeoJSON } from '@/utils/polylineDecoder';
import { toast } from "sonner";

interface TransitRouteResult {
  routeGeoJSON: GeoJSON.LineString | null;
  routeDetails: {
    duration: string;
    distance: string;
    steps: TransitStep[];
    summary: string;
  } | null;
}

interface TransitStep {
  instruction: string;
  mode: 'WALK' | 'TRANSIT';
  duration: string;
  distance: string;
  transitDetails?: {
    line: string;
    vehicle: string;
    stops: number;
    departureStop: string;
    arrivalStop: string;
  };
}

interface UseTransitRouteReturn extends TransitRouteResult {
  isLoading: boolean;
  error: string | null;
  planTransitRoute: (
    origin: [number, number], 
    destination: [number, number],
    departureTime: string,
    originName: string,
    destinationName: string
  ) => Promise<void>;
  clearRoute: () => void;
}

export const useTransitRoute = (): UseTransitRouteReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeGeoJSON, setRouteGeoJSON] = useState<GeoJSON.LineString | null>(null);
  const [routeDetails, setRouteDetails] = useState<TransitRouteResult['routeDetails']>(null);

  const planTransitRoute = useCallback(async (
    origin: [number, number], 
    destination: [number, number],
    departureTime: string,
    originName: string,
    destinationName: string
  ) => {
    console.log('🚌 Planning transit route:', {
      origin,
      destination,
      departureTime,
      originName,
      destinationName
    });

    setIsLoading(true);
    setError(null);
    setRouteGeoJSON(null);
    setRouteDetails(null);

    try {
      // Call the google-routes-optimization function with transit mode
      const { data, error: apiError } = await supabase.functions.invoke('google-routes-optimization', {
        body: {
          origin: { coordinates: origin },
          destination: { coordinates: destination },
          travelMode: 'TRANSIT',
          departureTime: departureTime,
          returnToOrigin: false
        }
      });

      if (apiError) {
        console.error('❌ Transit route API error:', apiError);
        throw new Error(apiError.message || 'Transit route planning failed');
      }

      if (!data.success) {
        const errorMsg = data.error || 'Transit route planning failed';
        console.error('❌ Transit API error:', errorMsg);
        
        // Provide user-friendly error messages for common scenarios
        if (errorMsg.includes('No routes found') || errorMsg.includes('ZERO_RESULTS')) {
          throw new Error('No transit routes available for this route. Try a different time or location.');
        } else if (errorMsg.includes('NOT_FOUND') || errorMsg.includes('INVALID_REQUEST')) {
          throw new Error('Unable to find transit information for this location. Please try a different destination.');
        } else if (errorMsg.includes('OVER_QUERY_LIMIT')) {
          throw new Error('Transit service temporarily unavailable. Please try again in a few minutes.');
        } else if (errorMsg.includes('REQUEST_DENIED')) {
          throw new Error('Transit service access denied. Please contact support.');
        } else if (errorMsg.includes('UNKNOWN_ERROR')) {
          throw new Error('Transit service temporarily unavailable. Please try again later.');
        } else if (errorMsg.includes('Google Routes API error: 400')) {
          throw new Error('Invalid transit route request. Please check your locations and try again.');
        } else if (errorMsg.includes('Google Routes API error: 403')) {
          throw new Error('Transit service access denied. Please contact support.');
        } else if (errorMsg.includes('Google Routes API error: 404')) {
          throw new Error('Transit service not available for this location. Please try a different destination.');
        } else if (errorMsg.includes('Google Routes API error: 429')) {
          throw new Error('Transit service temporarily busy. Please try again in a few minutes.');
        } else if (errorMsg.includes('Google Routes API error: 500') || errorMsg.includes('Google Routes API error: 503')) {
          throw new Error('Transit service temporarily unavailable. Please try again later.');
        } else if (errorMsg.includes('No routes found for the given waypoints')) {
          throw new Error('No transit routes available between these locations. Try a different time or location.');
        } else {
          // For any other unknown errors, provide a generic user-friendly message
          throw new Error('Unable to plan transit route. Please check your locations and try again.');
        }
      }

      console.log('✅ Transit route planned successfully:', data);

      const { route } = data;

      // Decode the polyline
      const decodedCoordinates = decodePolyline(route.encodedPolyline);
      if (decodedCoordinates.length === 0) {
        throw new Error('Failed to decode transit route polyline');
      }

      // Create GeoJSON for the route
      const geoJSON = createRouteGeoJSON(decodedCoordinates);
      setRouteGeoJSON(geoJSON);

      // Process route details
      const distanceKm = Math.round((route.distanceMeters || 0) / 1000 * 100) / 100;
      const durationMinutes = route.duration ? parseInt(route.duration.replace('s', '')) / 60 : 0;
      const durationText = durationMinutes > 60 
        ? `${Math.floor(durationMinutes / 60)}h ${Math.round(durationMinutes % 60)}m`
        : `${Math.round(durationMinutes)}m`;

      // Extract step-by-step directions from legs
      const steps: TransitStep[] = [];
      
      if (route.legs && route.legs.length > 0) {
        route.legs.forEach((leg: any) => {
          if (leg.steps) {
            leg.steps.forEach((step: any) => {
              const stepInfo: TransitStep = {
                instruction: step.navigationInstruction?.instructions || 'Continue on route',
                mode: step.travelMode || 'WALK',
                duration: step.staticDuration || '0s',
                distance: `${Math.round((step.distanceMeters || 0))}m`
              };

              // Add transit details if available
              if (step.transitDetails) {
                stepInfo.transitDetails = {
                  line: step.transitDetails.transitLine?.name || 'Transit',
                  vehicle: step.transitDetails.transitLine?.vehicle?.type || 'Bus',
                  stops: step.transitDetails.stopCount || 0,
                  departureStop: step.transitDetails.departureStop?.name || '',
                  arrivalStop: step.transitDetails.arrivalStop?.name || ''
                };
              }

              steps.push(stepInfo);
            });
          }
        });
      }

      setRouteDetails({
        duration: durationText,
        distance: `${distanceKm}km`,
        steps,
        summary: `Transit route from ${originName} to ${destinationName}`
      });

      toast.success(`Transit route planned: ${distanceKm}km, ~${durationText}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to plan transit route';
      console.error('❌ Transit route planning failed:', err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearRoute = useCallback(() => {
    setRouteGeoJSON(null);
    setRouteDetails(null);
    setError(null);
    console.log('🧹 Transit route cleared');
  }, []);

  return {
    isLoading,
    error,
    routeGeoJSON,
    routeDetails,
    planTransitRoute,
    clearRoute
  };
};