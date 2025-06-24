import { useMemo, useEffect, useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance, formatDistance } from '@/utils/proximityUtils';
import { useToast } from '@/hooks/use-toast';
import { addGlobalProximityMarker, ProximityMarker } from '@/data/proximityMarkers';

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

    // Filter by distance if maxDistance is provided
    const filteredLandmarks = maxDistance 
      ? landmarksWithDistance.filter(item => item.distance <= maxDistance)
      : landmarksWithDistance;

    // Sort by distance (ascending)
    return filteredLandmarks.sort((a, b) => a.distance - b.distance);
  }, [userLocation, landmarks, maxDistance]);

  // Show toast and add marker when closest landmark changes
  useEffect(() => {
    if (userLocation && sortedLandmarks.length > 0) {
      const closestLandmark = sortedLandmarks[0];
      
      // Only show toast if the closest landmark ID is different from the previous one
      if (closestLandmark.landmark.id !== previousClosestId) {
        toast({
          title: "Closest Landmark",
          description: `${closestLandmark.landmark.name} - ${formatDistance(closestLandmark.distance)}`,
        });
        
        // Add proximity marker to the map
        const proximityMarker: ProximityMarker = {
          id: `proximity-${closestLandmark.landmark.id}-${Date.now()}`,
          name: `Closest: ${closestLandmark.landmark.name}`,
          coordinates: closestLandmark.landmark.coordinates,
          description: `You are ${formatDistance(closestLandmark.distance)} away from ${closestLandmark.landmark.name}`,
          type: 'proximity'
        };
        
        addGlobalProximityMarker(proximityMarker);
        
        // Update the stored ID to the current closest landmark
        setPreviousClosestId(closestLandmark.landmark.id);
      }
    }
  }, [userLocation, sortedLandmarks, toast, previousClosestId]);

  return sortedLandmarks;
};
