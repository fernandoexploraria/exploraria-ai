
import { useMemo, useEffect, useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance, formatDistance } from '@/utils/proximityUtils';
import { useToast } from '@/hooks/use-toast';

interface LandmarkWithDistance {
  landmark: Landmark;
  distance: number;
}

interface ProximityEventHandlers {
  onFloatingCardTrigger?: (landmark: Landmark, distance: number) => void;
  onRouteVisualizationTrigger?: (landmark: Landmark, distance: number) => void;
}

export const useSortedLandmarks = (
  userLocation: UserLocation | null,
  landmarks: Landmark[],
  maxDistance: number,
  eventHandlers?: ProximityEventHandlers
): LandmarkWithDistance[] => {
  const { toast } = useToast();
  const [previousClosestId, setPreviousClosestId] = useState<string | null>(null);
  const [triggeredLandmarks] = useState<Set<string>>(new Set());

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

  // Enhanced proximity notification logic
  useEffect(() => {
    if (userLocation && sortedLandmarks.length > 0) {
      const closestLandmark = sortedLandmarks[0];
      const distance = closestLandmark.distance;
      
      // Only trigger if the closest landmark changed
      if (closestLandmark.landmark.id !== previousClosestId) {
        console.log(`🔔 New closest landmark: ${closestLandmark.landmark.name} at ${formatDistance(distance)}`);
        
        // Progressive notification logic based on distance
        if (distance <= 25) {
          // Very close - show floating card with enhanced features
          console.log('📍 Very close proximity - triggering floating card');
          eventHandlers?.onFloatingCardTrigger?.(closestLandmark.landmark, distance);
        } else if (distance <= 50) {
          // Close - show route visualization
          console.log('🗺️ Close proximity - triggering route visualization');
          eventHandlers?.onRouteVisualizationTrigger?.(closestLandmark.landmark, distance);
        } else if (distance <= 100) {
          // Medium distance - show basic toast notification
          console.log('💬 Medium proximity - showing toast notification');
          toast({
            title: "Nearby Landmark",
            description: `${closestLandmark.landmark.name} - ${formatDistance(distance)}`,
          });
        }
        
        setPreviousClosestId(closestLandmark.landmark.id);
      }
    } else {
      // Reset when no landmarks are in range
      if (previousClosestId !== null) {
        console.log(`🔄 No landmarks in range (${maxDistance}m), resetting previous closest ID`);
        setPreviousClosestId(null);
        triggeredLandmarks.clear();
      }
    }
  }, [userLocation, sortedLandmarks, toast, previousClosestId, maxDistance, eventHandlers]);

  console.log(`🗺️ useSortedLandmarks: ${landmarks.length} total landmarks, ${sortedLandmarks.length} within ${maxDistance}m range`);

  return sortedLandmarks;
};
