
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

export const useNearbyLandmarks = ({ 
  userLocation, 
  notificationDistance 
}: UseNearbyLandmarksProps): NearbyLandmark[] => {
  return useMemo(() => {
    if (!userLocation) {
      console.log('🎯 No nearby landmarks: missing location');
      return [];
    }

    // Validate user location
    if (typeof userLocation.latitude !== 'number' || typeof userLocation.longitude !== 'number') {
      console.log('🎯 No nearby landmarks: invalid location format', userLocation);
      return [];
    }

    // Step 1: Combine TOP_LANDMARKS and TOUR_LANDMARKS into a single array
    const staticLandmarks = TOP_LANDMARKS.map(convertTopLandmarkToLandmark);
    
    // Filter tour landmarks to only include those with valid coordinates
    const validTourLandmarks = TOUR_LANDMARKS
      .filter(landmark => {
        const [lng, lat] = landmark.coordinates;
        const isValid = typeof lng === 'number' && typeof lat === 'number' && 
                       lng !== 0 && lat !== 0 &&
                       lng >= -180 && lng <= 180 && 
                       lat >= -90 && lat <= 90;
        
        if (!isValid) {
          console.log('🎯 Skipping invalid tour landmark:', landmark.name, landmark.coordinates);
        }
        
        return isValid;
      })
      .map(convertTourLandmarkToLandmark);
    
    const combinedLandmarks = [...staticLandmarks, ...validTourLandmarks];

    console.log(`🎯 Combined landmarks: ${staticLandmarks.length} static + ${validTourLandmarks.length} valid tour = ${combinedLandmarks.length} total`);

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
      console.log(`🎯 No landmarks found within ${notificationDistance}m of`, {
        lat: userLocation.latitude,
        lng: userLocation.longitude
      });
    }

    return sortedLandmarks;
  }, [userLocation?.latitude, userLocation?.longitude, notificationDistance, TOUR_LANDMARKS.length]);
};
