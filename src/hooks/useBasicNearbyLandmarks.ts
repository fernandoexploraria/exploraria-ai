
import { useMemo } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance, filterLandmarksWithinRadius } from '@/utils/proximityUtils';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { TOUR_LANDMARKS } from '@/data/tourLandmarks';

export interface BasicNearbyLandmark {
  landmark: Landmark;
  distance: number; // in meters
}

interface UseBasicNearbyLandmarksProps {
  userLocation: UserLocation | null;
  searchRadius?: number;
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

// Convert TourLandmark to Landmark format
const convertTourLandmarkToLandmark = (tourLandmark: any): Landmark => {
  return {
    id: `tour-landmark-${tourLandmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: tourLandmark.name,
    coordinates: tourLandmark.coordinates,
    description: tourLandmark.description
  };
};

export const useBasicNearbyLandmarks = ({ 
  userLocation, 
  searchRadius = 1000 // Default 1km radius
}: UseBasicNearbyLandmarksProps): BasicNearbyLandmark[] => {
  return useMemo(() => {
    if (!userLocation) {
      console.log('🎯 No basic nearby landmarks: missing location');
      return [];
    }

    // Combine landmarks from both sources
    const staticLandmarks = TOP_LANDMARKS.map(convertTopLandmarkToLandmark);
    const tourLandmarks = TOUR_LANDMARKS.map(convertTourLandmarkToLandmark);
    const combinedLandmarks = [...staticLandmarks, ...tourLandmarks];

    console.log(`🎯 Basic search: ${combinedLandmarks.length} total landmarks within ${searchRadius}m`);

    if (combinedLandmarks.length === 0) {
      return [];
    }

    // Filter landmarks within search radius
    const nearbyLandmarks = filterLandmarksWithinRadius(
      userLocation,
      combinedLandmarks,
      searchRadius
    );

    // Calculate distance for each nearby landmark
    const landmarksWithDistance: BasicNearbyLandmark[] = nearbyLandmarks.map(landmark => {
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

    // Sort by distance (closest first)
    const sortedLandmarks = landmarksWithDistance.sort((a, b) => a.distance - b.distance);

    if (sortedLandmarks.length > 0) {
      const landmarkSummary = sortedLandmarks
        .slice(0, 3) // Show only first 3 for brevity
        .map(({ landmark, distance }) => `${landmark.name} (${Math.round(distance)}m)`)
        .join(', ');
      
      console.log(`🎯 Basic nearby: ${sortedLandmarks.length} landmarks found, closest: ${landmarkSummary}`);
    }

    return sortedLandmarks;
  }, [userLocation, searchRadius]);
};
