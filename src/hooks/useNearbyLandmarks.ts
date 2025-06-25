
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance, filterLandmarksWithinRadius } from '@/utils/proximityUtils';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { TOUR_LANDMARKS } from '@/data/tourLandmarks';

export interface NearbyLandmark {
  landmark: {
    id: string;
    name: string;
    coordinates: [number, number];
    description: string;
  };
  distance: number; // in meters
}

interface UseNearbyLandmarksProps {
  userLocation: UserLocation | null;
  toastDistance: number;
}

export const useNearbyLandmarks = ({ 
  userLocation, 
  toastDistance 
}: UseNearbyLandmarksProps): NearbyLandmark[] => {
  if (!userLocation) {
    console.log('🎯 No nearby landmarks: missing location');
    return [];
  }

  // Step 1: Create fresh combined array on every call (no useMemo)
  // Convert TOP_LANDMARKS to Landmark format
  const staticLandmarks = TOP_LANDMARKS.map(topLandmark => ({
    id: `top-${topLandmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: topLandmark.name,
    coordinates: topLandmark.coordinates,
    description: topLandmark.description
  }));

  // Convert TOUR_LANDMARKS to Landmark format
  const tourLandmarks = TOUR_LANDMARKS.map(tourLandmark => ({
    id: `tour-landmark-${tourLandmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: tourLandmark.name,
    coordinates: tourLandmark.coordinates,
    description: tourLandmark.description
  }));

  // Combine arrays fresh on every call
  const combinedLandmarks = [...staticLandmarks, ...tourLandmarks];

  console.log(`🎯 Fresh combined landmarks: ${staticLandmarks.length} static + ${tourLandmarks.length} tour = ${combinedLandmarks.length} total`);

  if (combinedLandmarks.length === 0) {
    console.log('🎯 No nearby landmarks: no landmarks available');
    return [];
  }

  // Step 2: Filter landmarks within toast_distance
  const nearbyLandmarks = filterLandmarksWithinRadius(
    userLocation,
    combinedLandmarks,
    toastDistance
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
    
    console.log(`🎯 Found ${sortedLandmarks.length} landmarks within ${toastDistance}m: ${landmarkSummary}`);
  } else {
    console.log(`🎯 No landmarks found within ${toastDistance}m`);
  }

  return sortedLandmarks;
};
