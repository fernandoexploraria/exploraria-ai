
import { useMemo } from 'react';
import { Landmark } from '@/data/landmarks';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useSortedLandmarks } from '@/hooks/useSortedLandmarks';
import { useCombinedLandmarks } from '@/hooks/useCombinedLandmarks';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { formatDistance } from '@/utils/proximityUtils';

export const useProximityLandmarks = (): Landmark[] => {
  const { userLocation } = useLocationTracking();
  const { proximitySettings } = useProximityAlerts();
  const allLandmarks = useCombinedLandmarks();

  // Get sorted landmarks within proximity range
  const proximityDistance = proximitySettings?.default_distance || 50;
  const sortedLandmarks = useSortedLandmarks(
    userLocation,
    allLandmarks,
    proximityDistance // This filters to only landmarks within range
  );

  // Create proximity landmark objects
  const proximityLandmarks = useMemo(() => {
    if (!proximitySettings?.is_enabled || !userLocation || sortedLandmarks.length === 0) {
      return [];
    }

    // Only show the closest landmark within proximity range
    const closestLandmark = sortedLandmarks[0];
    
    if (closestLandmark) {
      const proximityLandmark: Landmark = {
        id: `proximity-${closestLandmark.landmark.id}`,
        name: `📍 ${closestLandmark.landmark.name}`,
        coordinates: closestLandmark.landmark.coordinates,
        description: `${closestLandmark.landmark.description}\n\n🚶 Distance: ${formatDistance(closestLandmark.distance)} away`
      };

      return [proximityLandmark];
    }

    return [];
  }, [proximitySettings, userLocation, sortedLandmarks]);

  return proximityLandmarks;
};
