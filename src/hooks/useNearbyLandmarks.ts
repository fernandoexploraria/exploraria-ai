
import { useMemo } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance, filterLandmarksWithinRadius } from '@/utils/proximityUtils';

export interface NearbyLandmark {
  landmark: Landmark;
  distance: number; // in meters
}

interface UseNearbyLandmarksProps {
  userLocation: UserLocation | null;
  landmarks: Landmark[];
  toastDistance: number;
}

export const useNearbyLandmarks = ({ 
  userLocation, 
  landmarks, 
  toastDistance 
}: UseNearbyLandmarksProps): NearbyLandmark[] => {
  return useMemo(() => {
    if (!userLocation || landmarks.length === 0) {
      console.log('🎯 No nearby landmarks: missing location or landmarks');
      return [];
    }

    // Filter landmarks within toast_distance
    const nearbyLandmarks = filterLandmarksWithinRadius(
      userLocation,
      landmarks,
      toastDistance
    );

    // Calculate distance for each nearby landmark and create NearbyLandmark objects
    const landmarksWithDistance: NearbyLandmark[] = nearbyLandmarks.map(landmark => {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        landmark.coordinates[1], // latitude
        landmark.coordinates[0]  // longitude
      );

      return {
        landmark,
        distance
      };
    });

    // Sort by distance (ascending - closest first)
    const sortedLandmarks = landmarksWithDistance.sort((a, b) => a.distance - b.distance);

    // Log the nearby landmarks for debugging
    if (sortedLandmarks.length > 0) {
      const landmarkSummary = sortedLandmarks
        .map(({ landmark, distance }) => `${landmark.name} (${Math.round(distance)}m)`)
        .join(', ');
      
      console.log(`🎯 Found ${sortedLandmarks.length} landmarks within ${toastDistance}m: ${landmarkSummary}`);
    } else {
      console.log(`🎯 No landmarks found within ${toastDistance}m`);
    }

    return sortedLandmarks;
  }, [userLocation, landmarks, toastDistance]);
};
