
import { useMemo } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { useBasicNearbyLandmarks } from '@/hooks/useBasicNearbyLandmarks';

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
  // Use basic nearby landmarks as foundation
  const basicNearbyLandmarks = useBasicNearbyLandmarks({
    userLocation,
    searchRadius: notificationDistance
  });

  return useMemo(() => {
    // Convert basic landmarks to the expected format
    const nearbyLandmarks: NearbyLandmark[] = basicNearbyLandmarks.map(basic => ({
      landmark: basic.landmark,
      distance: basic.distance
    }));

    if (nearbyLandmarks.length > 0) {
      const summary = nearbyLandmarks
        .slice(0, 3)
        .map(({ landmark, distance }) => `${landmark.name} (${Math.round(distance)}m)`)
        .join(', ');
      
      console.log(`🎯 Nearby landmarks: ${nearbyLandmarks.length} within ${notificationDistance}m: ${summary}`);
    } else {
      console.log(`🎯 No landmarks found within ${notificationDistance}m`);
    }

    return nearbyLandmarks;
  }, [basicNearbyLandmarks, notificationDistance]);
};
