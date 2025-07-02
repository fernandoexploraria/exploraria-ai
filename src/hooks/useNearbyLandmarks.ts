
import { useMemo } from 'react';
import { UserLocation } from '@/types/proximityAlerts';
import { TourLandmark, TOUR_LANDMARKS } from '@/data/tourLandmarks';
import { calculateDistance, filterLandmarksWithinRadius } from '@/utils/proximityUtils';

export interface NearbyLandmark {
  landmark: TourLandmark;
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
      console.log('🎯 No nearby landmarks: missing user location');
      return [];
    }

    if (TOUR_LANDMARKS.length === 0) {
      console.log('🎯 No nearby landmarks: TOUR_LANDMARKS array is empty');
      return [];
    }

    console.log('🎯 Processing tour landmarks for panorama availability:', {
      totalTourLandmarks: TOUR_LANDMARKS.length,
      userLocation: { lat: userLocation.latitude, lng: userLocation.longitude },
      notificationDistance
    });

    // Filter tour landmarks within notification distance
    const nearbyTourLandmarks = filterLandmarksWithinRadius(
      userLocation,
      TOUR_LANDMARKS,
      notificationDistance
    );

    console.log('🎯 Tour landmarks within radius:', nearbyTourLandmarks.length);

    // Calculate distance for each nearby tour landmark
    const landmarksWithDistance: NearbyLandmark[] = nearbyTourLandmarks.map(tourLandmark => {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        tourLandmark.coordinates[1], // latitude
        tourLandmark.coordinates[0]  // longitude
      );

      return {
        landmark: tourLandmark,
        distance
      };
    });

    // Sort by distance (ascending - closest first)
    const sortedLandmarks = landmarksWithDistance.sort((a, b) => a.distance - b.distance);

    // Log the nearby tour landmarks for debugging
    if (sortedLandmarks.length > 0) {
      const landmarkSummary = sortedLandmarks
        .map(({ landmark, distance }) => {
          const hasRichData = landmark.rating || landmark.photos?.length || landmark.types?.length;
          return `${landmark.name} (${Math.round(distance)}m)${hasRichData ? ' [rich data]' : ''}`;
        })
        .join(', ');
      
      console.log(`🎯 Found ${sortedLandmarks.length} tour landmarks within ${notificationDistance}m: ${landmarkSummary}`);
      
      // Log panorama availability potential
      const richDataCount = sortedLandmarks.filter(({ landmark }) => 
        landmark.rating || landmark.photos?.length || landmark.types?.length
      ).length;
      
      console.log(`🎯 Tour landmarks with rich data (panorama candidates): ${richDataCount}/${sortedLandmarks.length}`);
    } else {
      console.log(`🎯 No tour landmarks found within ${notificationDistance}m for panorama checking`);
    }

    return sortedLandmarks;
  }, [userLocation, notificationDistance]);
};
