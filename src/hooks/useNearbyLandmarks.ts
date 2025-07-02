
import { useMemo } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance, filterLandmarksWithinRadius } from '@/utils/proximityUtils';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { TOUR_LANDMARKS } from '@/data/tourLandmarks';

export interface NearbyLandmark {
  landmark: Landmark;
  distance: number; // in meters
}

interface UseNearbyLandmarksProps {
  userLocation: UserLocation | null;
  notificationDistance: number;
  baseLandmarks?: Landmark[]; // Add support for base landmarks from props
}

// Convert TopLandmark to Landmark format
const convertTopLandmarkToLandmark = (topLandmark: any): Landmark => {
  return {
    id: `top-${topLandmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: topLandmark.name,
    coordinates: topLandmark.coordinates,
    description: topLandmark.description,
    placeId: topLandmark.place_id // 🔥 PRESERVE GOOGLE PLACES ID
  };
};

// Convert TourLandmark to Landmark format
const convertTourLandmarkToLandmark = (tourLandmark: any): Landmark => {
  return {
    id: `tour-landmark-${tourLandmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: tourLandmark.name,
    coordinates: tourLandmark.coordinates,
    description: tourLandmark.description,
    placeId: tourLandmark.placeId // 🔥 PRESERVE GOOGLE PLACES ID
  };
};

export const useNearbyLandmarks = ({ 
  userLocation, 
  notificationDistance,
  baseLandmarks = [] // Default to empty array if not provided
}: UseNearbyLandmarksProps): NearbyLandmark[] => {
  return useMemo(() => {
    if (!userLocation) {
      console.log('🎯 No nearby landmarks: missing location');
      return [];
    }

    // TODO: This will be broken temporarily - next steps will fix this
    // Step 1: Combined array definition and population removed
    console.log('🎯 Combined landmarks array creation removed - flow temporarily broken');

    // Placeholder return until next steps are implemented
    return [];

    // Step 2: Filter landmarks within notification distance - CURRENTLY BROKEN
    // const nearbyLandmarks = filterLandmarksWithinRadius(
    //   userLocation,
    //   combinedLandmarks, // This no longer exists
    //   notificationDistance
    // );

    // Step 3: Calculate distance for each nearby landmark and create NearbyLandmark objects - CURRENTLY BROKEN
    // const landmarksWithDistance: NearbyLandmark[] = nearbyLandmarks.map(landmark => {
    //   const distance = calculateDistance(
    //     userLocation.latitude,
    //     userLocation.longitude,
    //     landmark.coordinates[1], // latitude
    //     landmark.coordinates[0]  // longitude
    //   );

    //   return {
    //     landmark,
    //     distance
    //   };
    // });

    // Step 4: Sort by distance (ascending - closest first) - CURRENTLY BROKEN
    // const sortedLandmarks = landmarksWithDistance.sort((a, b) => a.distance - b.distance);

    // Log the nearby landmarks for debugging - CURRENTLY BROKEN
    // if (sortedLandmarks.length > 0) {
    //   const landmarkSummary = sortedLandmarks
    //     .map(({ landmark, distance }) => `${landmark.name} (${Math.round(distance)}m)`)
    //     .join(', ');
      
    //   console.log(`🎯 Found ${sortedLandmarks.length} landmarks within ${notificationDistance}m: ${landmarkSummary}`);
    // } else {
    //   console.log(`🎯 No landmarks found within ${notificationDistance}m`);
    // }

    // return sortedLandmarks;
  }, [userLocation, notificationDistance, baseLandmarks]);
};
