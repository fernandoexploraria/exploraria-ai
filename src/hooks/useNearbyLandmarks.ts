
import { useMemo } from 'react';
import { UserLocation } from '@/types/proximityAlerts';
import { TourLandmark, TOUR_LANDMARKS } from '@/data/tourLandmarks';
import { calculateDistance, filterLandmarksWithinRadius } from '@/utils/proximityUtils';

export interface NearbyLandmark {
  landmark: TourLandmark;
  distance: number; // in meters
  panoramaReady?: boolean; // Indicates if panorama data is preloaded
  streetViewStatus?: 'available' | 'preloading' | 'unavailable' | 'unknown';
  panoramaStats?: {
    availableCount: number;
    panoramaIds: string[];
    hasConnectedViews: boolean;
    lastChecked: number;
  };
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
      console.log('🎯 [TEST] No nearby landmarks: missing user location');
      return [];
    }

    if (TOUR_LANDMARKS.length === 0) {
      console.log('🎯 [TEST] No nearby landmarks: TOUR_LANDMARKS array is empty');
      return [];
    }

    console.log('🎯 [TEST] Processing tour landmarks for proximity detection with panorama support:', {
      totalTourLandmarks: TOUR_LANDMARKS.length,
      userLocation: { lat: userLocation.latitude, lng: userLocation.longitude },
      notificationDistance,
      testMode: process.env.NODE_ENV === 'development'
    });

    // Filter tour landmarks within notification distance
    const nearbyTourLandmarks = filterLandmarksWithinRadius(
      userLocation,
      TOUR_LANDMARKS,
      notificationDistance
    );

    console.log('🎯 [TEST] Tour landmarks within radius:', nearbyTourLandmarks.length);

    // Calculate distance for each nearby tour landmark and create NearbyLandmark objects
    const landmarksWithDistance: NearbyLandmark[] = nearbyTourLandmarks.map(tourLandmark => {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        tourLandmark.coordinates[1], // latitude
        tourLandmark.coordinates[0]  // longitude
      );

      // Initialize Street View status as unknown - will be updated by proximity system
      return {
        landmark: tourLandmark,
        distance,
        panoramaReady: false,
        streetViewStatus: 'unknown',
        panoramaStats: {
          availableCount: 0,
          panoramaIds: [],
          hasConnectedViews: false,
          lastChecked: 0
        }
      };
    });

    // Sort by distance (ascending - closest first)
    const sortedLandmarks = landmarksWithDistance.sort((a, b) => a.distance - b.distance);

    // Enhanced logging with panorama preparation status
    if (sortedLandmarks.length > 0) {
      const landmarkSummary = sortedLandmarks
        .map(({ landmark, distance, streetViewStatus, panoramaStats }) => {
          const hasRichData = landmark.rating || landmark.photos?.length || landmark.types?.length;
          const statusIcon = streetViewStatus === 'available' ? '📸' : 
                           streetViewStatus === 'preloading' ? '⏳' : 
                           streetViewStatus === 'unavailable' ? '❌' : '❓';
          const panoramaIcon = panoramaStats && panoramaStats.availableCount > 0 ? '🔗' : '📷';
          return `${landmark.name} (${Math.round(distance)}m)${hasRichData ? ' [rich data]' : ''} ${statusIcon}${panoramaIcon}`;
        })
        .join(', ');
      
      console.log(`🎯 [TEST] Found ${sortedLandmarks.length} tour landmarks within ${notificationDistance}m: ${landmarkSummary}`);
      
      // Enhanced rich data and panorama logging for testing
      const richDataCount = sortedLandmarks.filter(({ landmark }) => 
        landmark.rating || landmark.photos?.length || landmark.types?.length
      ).length;
      
      const closeCount = sortedLandmarks.filter(({ distance }) => distance < 100).length;
      const moderateCount = sortedLandmarks.filter(({ distance }) => distance >= 100 && distance < 500).length;
      
      console.log(`🎯 [TEST] Tour landmarks analysis:`, {
        withRichData: `${richDataCount}/${sortedLandmarks.length}`,
        veryClose: `${closeCount} (<100m) - panorama priority`,
        close: `${moderateCount} (100-500m) - street view ready`,
        total: sortedLandmarks.length,
        panoramaReadyCount: sortedLandmarks.filter(l => l.panoramaReady).length,
        testingMode: true
      });

      // Log panorama preloading recommendations for testing
      if (closeCount > 0) {
        console.log(`🔄 [TEST] Panorama preloading recommended for ${closeCount} very close landmarks`);
      }
    } else {
      console.log(`🎯 [TEST] No tour landmarks found within ${notificationDistance}m`);
    }

    return sortedLandmarks;
  }, [userLocation, notificationDistance]);
};
