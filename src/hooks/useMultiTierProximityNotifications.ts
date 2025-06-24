
import { useEffect } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance } from '@/utils/proximityUtils';

interface ProximityThresholds {
  floatingCard: number;
  routeVisualization: number;
  toastNotification: number;
}

interface ProximityCallbacks {
  onFloatingCardTrigger: (landmark: Landmark, distance: number) => void;
  onRouteVisualizationTrigger: (landmark: Landmark, distance: number) => void;
}

export const useMultiTierProximityNotifications = (
  userLocation: UserLocation | null,
  landmarks: Landmark[],
  thresholds: ProximityThresholds,
  callbacks: ProximityCallbacks
) => {
  useEffect(() => {
    if (!userLocation || landmarks.length === 0) {
      return;
    }

    // Calculate distances for all landmarks
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

    // Sort by distance (closest first)
    const sortedLandmarks = landmarksWithDistance.sort((a, b) => a.distance - b.distance);

    // Check thresholds for the closest landmarks
    sortedLandmarks.forEach(item => {
      const { landmark, distance } = item;

      // Floating card threshold (closest)
      if (distance <= thresholds.floatingCard) {
        callbacks.onFloatingCardTrigger(landmark, distance);
      }
      // Route visualization threshold
      else if (distance <= thresholds.routeVisualization) {
        callbacks.onRouteVisualizationTrigger(landmark, distance);
      }
    });

  }, [userLocation, landmarks, thresholds, callbacks]);
};
