
import { useMemo } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { useSortedLandmarks } from '@/hooks/useSortedLandmarks';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';

export const useClosestLandmark = (
  userLocation: UserLocation | null,
  landmarks: Landmark[]
): string | null => {
  const { proximitySettings } = useProximityAlerts();
  
  // Get landmarks sorted by distance within proximity range
  const sortedLandmarks = useSortedLandmarks(
    userLocation,
    landmarks,
    proximitySettings?.default_distance
  );

  // Return the ID of the closest landmark (first in sorted array) or null if none in range
  return useMemo(() => {
    if (sortedLandmarks.length === 0) {
      return null;
    }
    
    const closestLandmark = sortedLandmarks[0];
    console.log(`🎯 Closest landmark: ${closestLandmark.landmark.name} (${closestLandmark.distance.toFixed(2)}km)`);
    
    return closestLandmark.landmark.id;
  }, [sortedLandmarks]);
};
