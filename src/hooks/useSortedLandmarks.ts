
import { useMemo } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { DebugOverrides } from '@/types/debugOverrides';
import { calculateDistance } from '@/utils/proximityUtils';

interface LandmarkWithDistance {
  landmark: Landmark;
  distance: number;
}

export const useSortedLandmarks = (
  userLocation: UserLocation | null,
  landmarks: Landmark[],
  maxDistance: number,
  debugOverrides?: DebugOverrides
): LandmarkWithDistance[] => {
  const sortedLandmarks = useMemo(() => {
    if (!userLocation || landmarks.length === 0) {
      return [];
    }

    const landmarksWithDistance = landmarks.map(landmark => {
      let distance: number;
      
      // Check if this landmark should have its distance overridden
      if (debugOverrides?.enabled && debugOverrides.targetLandmarkId === landmark.id && debugOverrides.forcedDistance !== null) {
        distance = debugOverrides.forcedDistance;
        console.log(`🔧 Debug Override: ${landmark.name} distance forced to ${distance}m`);
      } else {
        distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          landmark.coordinates[1], // latitude
          landmark.coordinates[0]  // longitude
        );
      }

      return {
        landmark,
        distance
      };
    });

    // Filter by distance - only include landmarks within the specified range
    const filteredLandmarks = landmarksWithDistance.filter(item => item.distance <= maxDistance);

    // Sort by distance (ascending)
    return filteredLandmarks.sort((a, b) => a.distance - b.distance);
  }, [userLocation, landmarks, maxDistance, debugOverrides]);

  console.log(`🗺️ useSortedLandmarks: ${landmarks.length} total landmarks, ${sortedLandmarks.length} within ${maxDistance}m range`);

  return sortedLandmarks;
};
