
import { useEffect, useRef } from 'react';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { toast } from 'sonner';

export const useProximityNotifications = () => {
  const { proximitySettings } = useProximityAlerts();
  const { userLocation } = useLocationTracking();
  const notifiedLandmarksRef = useRef<Set<string>>(new Set());

  // Get nearby landmarks using inner and outer distances
  const nearbyLandmarks = useNearbyLandmarks({
    userLocation,
    notificationDistance: proximitySettings?.outer_distance || 250
  });

  useEffect(() => {
    if (!proximitySettings?.is_enabled || !userLocation || nearbyLandmarks.length === 0) {
      return;
    }

    const innerDistance = proximitySettings.inner_distance;
    const outerDistance = proximitySettings.outer_distance;

    console.log('🔔 Processing proximity notifications:', {
      userLocation: { lat: userLocation.latitude, lng: userLocation.longitude },
      nearbyCount: nearbyLandmarks.length,
      innerDistance,
      outerDistance,
      notifiedCount: notifiedLandmarksRef.current.size
    });

    nearbyLandmarks.forEach(({ landmark, distance }) => {
      const landmarkKey = landmark.id || landmark.placeId || landmark.name;
      const isAlreadyNotified = notifiedLandmarksRef.current.has(landmarkKey);

      // Determine notification zone
      let notificationZone: 'inner' | 'outer' | null = null;
      if (distance <= innerDistance) {
        notificationZone = 'inner';
      } else if (distance <= outerDistance) {
        notificationZone = 'outer';
      }

      if (notificationZone && !isAlreadyNotified) {
        const message = notificationZone === 'inner' 
          ? `📍 You're very close to ${landmark.name} (${Math.round(distance)}m away)!`
          : `🗺️ ${landmark.name} is nearby (${Math.round(distance)}m away)`;

        console.log(`🔔 Proximity notification (${notificationZone} zone):`, {
          landmark: landmark.name,
          distance: Math.round(distance),
          zone: notificationZone
        });

        toast(message, {
          description: landmark.description || `Explore this ${landmark.types?.[0]?.replace(/_/g, ' ') || 'landmark'}`,
          duration: notificationZone === 'inner' ? 8000 : 5000,
          action: {
            label: "View Details",
            onClick: () => {
              console.log(`🔍 Opening details for ${landmark.name}`);
              // TODO: Implement landmark details view
            }
          }
        });

        // Mark as notified
        notifiedLandmarksRef.current.add(landmarkKey);

        // Trigger panorama metadata preloading for inner zone landmarks
        if (notificationZone === 'inner') {
          console.log(`🔄 Triggering panorama metadata preload for ${landmark.name} (inner zone)`);
          // TODO: Implement panorama metadata preloading
        }
      }

      // Clean up notifications for landmarks that are now far away
      if (distance > outerDistance && isAlreadyNotified) {
        console.log(`🧹 Cleaning up notification for ${landmark.name} (now ${Math.round(distance)}m away)`);
        notifiedLandmarksRef.current.delete(landmarkKey);
      }
    });

    // Log summary
    if (nearbyLandmarks.length > 0) {
      const innerCount = nearbyLandmarks.filter(({ distance }) => distance <= innerDistance).length;
      const outerCount = nearbyLandmarks.filter(({ distance }) => distance <= outerDistance && distance > innerDistance).length;
      
      console.log(`📊 Proximity summary: ${innerCount} inner, ${outerCount} outer, ${notifiedLandmarksRef.current.size} notified`);
    }

  }, [nearbyLandmarks, proximitySettings, userLocation]);

  // Cleanup notifications when proximity is disabled
  useEffect(() => {
    if (!proximitySettings?.is_enabled) {
      console.log('🧹 Clearing all proximity notifications (proximity disabled)');
      notifiedLandmarksRef.current.clear();
    }
  }, [proximitySettings?.is_enabled]);

  return {
    nearbyLandmarks,
    notifiedCount: notifiedLandmarksRef.current.size
  };
};
