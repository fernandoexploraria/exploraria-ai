
import { useEffect } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { DebugOverrides } from '@/types/debugOverrides';
import { useSortedLandmarks } from '@/hooks/useSortedLandmarks';

interface ProximityEventHandlers {
  onFloatingCardTrigger?: (landmark: Landmark, distance: number) => void;
  onRouteVisualizationTrigger?: (landmark: Landmark, distance: number) => void;
}

export const useProximityDetection = (
  userLocation: UserLocation | null,
  landmarks: Landmark[],
  maxDistance: number,
  eventHandlers?: ProximityEventHandlers,
  debugOverrides?: DebugOverrides
) => {
  // Use the sorted landmarks hook for proximity detection
  const sortedLandmarks = useSortedLandmarks(
    userLocation,
    landmarks,
    maxDistance,
    eventHandlers,
    debugOverrides
  );

  return {
    sortedLandmarks,
    nearbyLandmarks: sortedLandmarks.slice(0, 5) // Return top 5 closest landmarks
  };
};
