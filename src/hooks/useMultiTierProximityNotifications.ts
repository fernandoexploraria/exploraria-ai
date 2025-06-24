
import { useEffect, useState } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { DebugOverrides } from '@/types/debugOverrides';
import { formatDistance } from '@/utils/proximityUtils';
import { useToast } from '@/hooks/use-toast';
import { useSortedLandmarksV2 } from '@/hooks/useSortedLandmarksV2';

interface MultiTierThresholds {
  floatingCard: number;    // e.g., 25m in production, 300000m in testing
  routeVisualization: number; // e.g., 50m in production, 600000m in testing
  toastNotification: number;  // e.g., 100m in production, 1200000m in testing
}

interface ProximityEventHandlers {
  onFloatingCardTrigger?: (landmark: Landmark, distance: number) => void;
  onRouteVisualizationTrigger?: (landmark: Landmark, distance: number) => void;
}

export const useMultiTierProximityNotifications = (
  userLocation: UserLocation | null,
  landmarks: Landmark[],
  thresholds: MultiTierThresholds,
  eventHandlers?: ProximityEventHandlers,
  debugOverrides?: DebugOverrides
) => {
  const { toast } = useToast();
  const [previousClosestId, setPreviousClosestId] = useState<string | null>(null);
  const [triggeredLandmarks] = useState<Set<string>>(new Set());

  // Use the largest threshold as the max distance for filtering
  const maxDistance = Math.max(
    thresholds.floatingCard,
    thresholds.routeVisualization,
    thresholds.toastNotification
  );

  // Get sorted landmarks within the maximum threshold using V2 hook
  const sortedLandmarks = useSortedLandmarksV2(
    userLocation,
    landmarks,
    maxDistance,
    debugOverrides
  );

  // Multi-tier proximity notification logic
  useEffect(() => {
    if (userLocation && sortedLandmarks.length > 0) {
      const closestLandmark = sortedLandmarks[0];
      const distance = closestLandmark.distance;
      
      // Only trigger if the closest landmark changed
      if (closestLandmark.landmark.id !== previousClosestId) {
        console.log(`🔔 [V2] New closest landmark: ${closestLandmark.landmark.name} at ${formatDistance(distance)}`);
        
        // Multi-tier notification logic (hierarchical - only one notification type)
        if (distance <= thresholds.floatingCard) {
          // Very close - show floating card with enhanced features
          console.log('📍 [V2] Very close proximity - triggering floating card');
          eventHandlers?.onFloatingCardTrigger?.(closestLandmark.landmark, distance);
        } else if (distance <= thresholds.routeVisualization) {
          // Close - show route visualization
          console.log('🗺️ [V2] Close proximity - triggering route visualization');
          eventHandlers?.onRouteVisualizationTrigger?.(closestLandmark.landmark, distance);
        } else if (distance <= thresholds.toastNotification) {
          // Medium distance - show basic toast notification
          console.log('💬 [V2] Medium proximity - showing toast notification');
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
        console.log(`🔄 [V2] No landmarks in range (${maxDistance}m), resetting previous closest ID`);
        setPreviousClosestId(null);
        triggeredLandmarks.clear();
      }
    }
  }, [userLocation, sortedLandmarks, toast, previousClosestId, maxDistance, eventHandlers, thresholds]);

  return {
    sortedLandmarks,
    nearbyLandmarks: sortedLandmarks.slice(0, 5), // Return top 5 closest landmarks
    thresholds,
    maxDistance
  };
};
