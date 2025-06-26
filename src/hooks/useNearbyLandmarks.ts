
import { useMemo } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance, filterLandmarksWithinRadius } from '@/utils/proximityUtils';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { TOUR_LANDMARKS } from '@/data/tourLandmarks';
import { convertTopLandmarkToLandmark, convertTourLandmarkToLandmark } from '@/utils/landmarkUtils';

export interface NearbyLandmark {
  landmark: Landmark;
  distance: number; // in meters
}

interface UseNearbyLandmarksProps {
  userLocation: UserLocation | null;
  notificationDistance: number;
}

export const useNearbyLandmarks = ({ 
  userLocation, 
  notificationDistance 
}: UseNearbyLandmarksProps): NearbyLandmark[] => {
  return useMemo(() => {
    if (!userLocation) {
      console.log('🎯 No nearby landmarks: missing location');
      return [];
    }

    // Step 1: Combine TOP_LANDMARKS and TOUR_LANDMARKS into a single array with validation
    const staticLandmarks = TOP_LANDMARKS
      .map(convertTopLandmarkToLandmark)
      .filter((landmark): landmark is Landmark => landmark !== null);
    
    const tourLandmarks = TOUR_LANDMARKS
      .map(convertTourLandmarkToLandmark)
      .filter((landmark): landmark is Landmark => landmark !== null);
    
    const combinedLandmarks = [...staticLandmarks, ...tourLandmarks];

    console.log(`🎯 Combined landmarks: ${staticLandmarks.length} static + ${tourLandmarks.length} tour = ${combinedLandmarks.length} total`);

    if (combinedLandmarks.length === 0) {
      console.log('🎯 No nearby landmarks: no landmarks available');
      return [];
    }

    // Step 2: Filter landmarks within notification distance
    const nearbyLandmarks = filterLandmarksWithinRadius(
      userLocation,
      combinedLandmarks,
      notificationDistance
    );

    // Step 3: Calculate distance for each nearby landmark and create NearbyLandmark objects
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

    // Step 4: Sort by distance (ascending - closest first)
    const sortedLandmarks = landmarksWithDistance.sort((a, b) => a.distance - b.distance);

    // Log the nearby landmarks for debugging
    if (sortedLandmarks.length > 0) {
      const landmarkSummary = sortedLandmarks
        .map(({ landmark, distance }) => `${landmark.name} (${Math.round(distance)}m)`)
        .join(', ');
      
      console.log(`🎯 Found ${sortedLandmarks.length} landmarks within ${notificationDistance}m: ${landmarkSummary}`);
    } else {
      console.log(`🎯 No landmarks found within ${notificationDistance}m`);
    }

    return sortedLandmarks;
  }, [userLocation, notificationDistance]);
};
