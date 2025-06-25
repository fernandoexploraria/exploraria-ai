
import { useMemo } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance, filterLandmarksWithinRadius } from '@/utils/proximityUtils';
import { TOP_LANDMARKS } from '@/data/topLandmarks';

export interface NearbyLandmark {
  landmark: Landmark;
  distance: number; // in meters
}

interface UseNearbyLandmarksProps {
  userLocation: UserLocation | null;
  toastDistance: number;
}

// Convert TopLandmark to Landmark format
const convertTopLandmarkToLandmark = (topLandmark: any): Landmark => {
  return {
    id: `top-${topLandmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: topLandmark.name,
    coordinates: topLandmark.coordinates,
    description: topLandmark.description
  };
};

export const useNearbyLandmarks = ({ 
  userLocation, 
  toastDistance 
}: UseNearbyLandmarksProps): NearbyLandmark[] => {
  return useMemo(() => {
    if (!userLocation) {
      console.log('🎯 No nearby landmarks: missing location');
      return [];
    }

    // Get landmarks from TOP_LANDMARKS array (includes tour landmarks)
    const landmarks = TOP_LANDMARKS.map(convertTopLandmarkToLandmark);

    if (landmarks.length === 0) {
      console.log('🎯 No nearby landmarks: no landmarks available');
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
  }, [userLocation, toastDistance]);
};
