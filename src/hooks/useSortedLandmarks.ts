
import { useMemo, useEffect, useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation, ProximitySettings } from '@/types/proximityAlerts';
import { calculateDistance, formatDistance } from '@/utils/proximityUtils';
import { useToast } from '@/hooks/use-toast';

interface LandmarkWithDistance {
  landmark: Landmark;
  distance: number;
}

export const useSortedLandmarks = (
  userLocation: UserLocation | null,
  landmarks: Landmark[],
  maxDistance?: number,
  proximitySettings?: ProximitySettings | null
): LandmarkWithDistance[] => {
  const { toast } = useToast();
  const [previousClosestId, setPreviousClosestId] = useState<string | null>(null);

  // Debug logging
  console.log('🎯 [useSortedLandmarks] Hook called with:', {
    userLocationExists: !!userLocation,
    landmarksCount: landmarks.length,
    maxDistance,
    proximityEnabled: proximitySettings?.is_enabled,
    proximityDefaultDistance: proximitySettings?.default_distance
  });

  // Use proximity settings default distance if no maxDistance provided
  const effectiveMaxDistance = maxDistance || proximitySettings?.default_distance;

  const sortedLandmarks = useMemo(() => {
    console.log('🎯 [useSortedLandmarks] useMemo recalculating...');
    
    if (!userLocation || landmarks.length === 0) {
      console.log('🎯 [useSortedLandmarks] Early return - no user location or landmarks');
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

    // Filter by distance if effectiveMaxDistance is provided
    const filteredLandmarks = effectiveMaxDistance 
      ? landmarksWithDistance.filter(item => item.distance <= effectiveMaxDistance)
      : landmarksWithDistance;

    // Sort by distance (ascending)
    const sorted = filteredLandmarks.sort((a, b) => a.distance - b.distance);
    
    console.log('🎯 [useSortedLandmarks] Sorted landmarks:', {
      totalLandmarks: landmarksWithDistance.length,
      filteredCount: filteredLandmarks.length,
      closestLandmark: sorted[0] ? `${sorted[0].landmark.name} (${Math.round(sorted[0].distance)}m)` : 'none'
    });
    
    return sorted;
  }, [userLocation, landmarks, effectiveMaxDistance]);

  // Show toast only when proximity alerts are enabled and closest landmark changes
  useEffect(() => {
    console.log('🎯 [useSortedLandmarks] useEffect triggered:', {
      userLocationExists: !!userLocation,
      proximityEnabled: proximitySettings?.is_enabled,
      sortedLandmarksCount: sortedLandmarks.length,
      previousClosestId
    });

    // Only show proximity alerts when:
    // 1. User location is available
    // 2. Proximity settings exist and are enabled
    // 3. There are landmarks within range
    if (userLocation && 
        proximitySettings?.is_enabled && 
        sortedLandmarks.length > 0) {
      
      const closestLandmark = sortedLandmarks[0];
      
      console.log('🎯 [useSortedLandmarks] Checking closest landmark:', {
        closestId: closestLandmark.landmark.id,
        closestName: closestLandmark.landmark.name,
        distance: Math.round(closestLandmark.distance),
        previousClosestId,
        shouldShowToast: closestLandmark.landmark.id !== previousClosestId
      });
      
      // Only show toast if the closest landmark ID is different from the previous one
      if (closestLandmark.landmark.id !== previousClosestId) {
        console.log('🎯 [useSortedLandmarks] SHOWING TOAST!');
        toast({
          title: "Proximity Alert",
          description: `${closestLandmark.landmark.name} - ${formatDistance(closestLandmark.distance)}`,
        });
        
        // Update the stored ID to the current closest landmark
        setPreviousClosestId(closestLandmark.landmark.id);
      } else {
        console.log('🎯 [useSortedLandmarks] Not showing toast - same landmark as before');
      }
    } else {
      console.log('🎯 [useSortedLandmarks] Not showing proximity alert - conditions not met');
    }
  }, [sortedLandmarks, toast, previousClosestId, proximitySettings?.is_enabled]);

  return sortedLandmarks;
};
