
import { useMemo } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { useSortedLandmarks } from '@/hooks/useSortedLandmarks';

export interface ProximityAwareLandmark extends Landmark {
  isClosest?: boolean;
  distance?: number;
}

export const useProximityAwareMarkers = (
  landmarks: Landmark[],
  userLocation: UserLocation | null,
  maxDistance?: number
): ProximityAwareLandmark[] => {
  const sortedLandmarks = useSortedLandmarks(userLocation, landmarks, maxDistance);

  return useMemo(() => {
    if (!userLocation || sortedLandmarks.length === 0) {
      return landmarks;
    }

    // Create a map of landmark IDs to their proximity data
    const proximityMap = new Map(
      sortedLandmarks.map(item => [
        item.landmark.id,
        { 
          isClosest: item.isClosest || false, 
          distance: item.distance 
        }
      ])
    );

    // Enhance landmarks with proximity information
    return landmarks.map(landmark => ({
      ...landmark,
      isClosest: proximityMap.get(landmark.id)?.isClosest || false,
      distance: proximityMap.get(landmark.id)?.distance
    }));
  }, [landmarks, sortedLandmarks, userLocation]);
};
