
import { useMemo, useEffect } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance, formatDistance } from '@/utils/proximityUtils';
import { useToast } from '@/hooks/use-toast';

interface LandmarkWithDistance {
  landmark: Landmark;
  distance: number;
}

export const useSortedLandmarks = (
  userLocation: UserLocation | null,
  landmarks: Landmark[],
  maxDistance?: number
): LandmarkWithDistance[] => {
  const { toast } = useToast();

  const sortedLandmarks = useMemo(() => {
    if (!userLocation || landmarks.length === 0) {
      return [];
    }

    const landmarksWithDistance = landmarks.map(landmark => {
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

    // Filter by distance if maxDistance is provided
    const filteredLandmarks = maxDistance 
      ? landmarksWithDistance.filter(item => item.distance <= maxDistance)
      : landmarksWithDistance;

    // Sort by distance (ascending)
    return filteredLandmarks.sort((a, b) => a.distance - b.distance);
  }, [userLocation, landmarks, maxDistance]);

  // Show toast with closest landmark every time user location updates
  useEffect(() => {
    if (userLocation && sortedLandmarks.length > 0) {
      const closestLandmark = sortedLandmarks[0];
      toast({
        title: "Closest Landmark",
        description: `${closestLandmark.landmark.name} - ${formatDistance(closestLandmark.distance)}`,
      });
    }
  }, [userLocation, sortedLandmarks, toast]);

  return sortedLandmarks;
};
