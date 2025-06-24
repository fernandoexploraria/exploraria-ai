
import { useMemo, useEffect, useState } from 'react';
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
  maxDistance: number // Made mandatory - no longer optional
): LandmarkWithDistance[] => {
  const { toast } = useToast();
  const [previousClosestId, setPreviousClosestId] = useState<string | null>(null);

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

    // Filter by distance - maxDistance is now always provided
    const filteredLandmarks = landmarksWithDistance.filter(item => item.distance <= maxDistance);

    // Sort by distance (ascending)
    return filteredLandmarks.sort((a, b) => a.distance - b.distance);
  }, [userLocation, landmarks, maxDistance]);

  // Show toast only when closest landmark changes and reset state when no landmarks in range
  useEffect(() => {
    if (userLocation) {
      if (sortedLandmarks.length > 0) {
        const closestLandmark = sortedLandmarks[0];
        
        // Only show toast if the closest landmark ID is different from the previous one
        if (closestLandmark.landmark.id !== previousClosestId) {
          toast({
            title: "Closest Landmark",
            description: `${closestLandmark.landmark.name} - ${formatDistance(closestLandmark.distance)}`,
          });
          
          // Update the stored ID to the current closest landmark
          setPreviousClosestId(closestLandmark.landmark.id);
        }
      } else {
        // Reset previousClosestId when no landmarks are in range
        if (previousClosestId !== null) {
          setPreviousClosestId(null);
        }
      }
    }
  }, [userLocation, sortedLandmarks, toast, previousClosestId]);

  return sortedLandmarks;
};
