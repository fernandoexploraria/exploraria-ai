
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
  maxDistance: number
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

    // Filter by distance - only include landmarks within the specified range
    const filteredLandmarks = landmarksWithDistance.filter(item => item.distance <= maxDistance);

    // Sort by distance (ascending)
    return filteredLandmarks.sort((a, b) => a.distance - b.distance);
  }, [userLocation, landmarks, maxDistance]);

  // Show toast only when closest landmark changes, and only if there are landmarks in range
  useEffect(() => {
    if (userLocation) {
      if (sortedLandmarks.length > 0) {
        const closestLandmark = sortedLandmarks[0];
        
        // Only show toast if the closest landmark ID is different from the previous one
        if (closestLandmark.landmark.id !== previousClosestId) {
          console.log(`🔔 Showing proximity toast for: ${closestLandmark.landmark.name} at ${formatDistance(closestLandmark.distance)}`);
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
          console.log(`🔄 No landmarks in range (${maxDistance}m), resetting previous closest ID`);
          setPreviousClosestId(null);
        }
      }
    } else {
      // Reset when no user location
      if (previousClosestId !== null) {
        console.log(`📍 No user location, resetting previous closest ID`);
        setPreviousClosestId(null);
      }
    }
  }, [userLocation, sortedLandmarks, toast, previousClosestId, maxDistance]);

  console.log(`🗺️ useSortedLandmarks: ${landmarks.length} total landmarks, ${sortedLandmarks.length} within ${maxDistance}m range`);

  return sortedLandmarks;
};
