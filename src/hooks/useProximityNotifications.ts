
import { useEffect, useRef, useState } from 'react';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { toast } from 'sonner';
import { Landmark } from '@/data/landmarks';

interface ActiveCard {
  landmark: Landmark;
  distance: number;
}

export const useProximityNotifications = () => {
  const { proximitySettings } = useProximityAlerts();
  const { userLocation } = useLocationTracking();
  const notifiedLandmarksRef = useRef<Set<string>>(new Set());
  const [activeCards, setActiveCards] = useState<{ [key: string]: Landmark }>({});

  // Get nearby landmarks using outer distance (card_distance for floating cards)
  const nearbyLandmarks = useNearbyLandmarks({
    userLocation,
    notificationDistance: proximitySettings?.card_distance || 100
  });

  useEffect(() => {
    if (!proximitySettings?.is_enabled || !userLocation || nearbyLandmarks.length === 0) {
      return;
    }

    const notificationDistance = proximitySettings.notification_distance;
    const cardDistance = proximitySettings.card_distance;

    console.log('🔔 Processing proximity notifications:', {
      userLocation: { lat: userLocation.latitude, lng: userLocation.longitude },
      nearbyCount: nearbyLandmarks.length,
      notificationDistance,
      cardDistance,
      notifiedCount: notifiedLandmarksRef.current.size
    });

    nearbyLandmarks.forEach(({ landmark, distance }) => {
      const landmarkKey = landmark.id || landmark.placeId || landmark.name;
      const isAlreadyNotified = notifiedLandmarksRef.current.has(landmarkKey);

      // Show floating card for very close landmarks
      if (distance <= cardDistance) {
        setActiveCards(prev => ({
          ...prev,
          [landmarkKey]: landmark
        }));
      } else {
        // Remove card if landmark is now far away
        setActiveCards(prev => {
          const newCards = { ...prev };
          delete newCards[landmarkKey];
          return newCards;
        });
      }

      // Show notification for landmarks within notification distance
      if (distance <= notificationDistance && !isAlreadyNotified) {
        const message = `📍 ${landmark.name} is nearby (${Math.round(distance)}m away)`;

        console.log(`🔔 Proximity notification:`, {
          landmark: landmark.name,
          distance: Math.round(distance)
        });

        toast(message, {
          description: landmark.description || `Explore this ${landmark.types?.[0]?.replace(/_/g, ' ') || 'landmark'}`,
          duration: 5000,
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

        // Trigger panorama metadata preloading for close landmarks
        console.log(`🔄 Triggering panorama metadata preload for ${landmark.name}`);
        // TODO: Implement panorama metadata preloading
      }

      // Clean up notifications for landmarks that are now far away
      if (distance > notificationDistance && isAlreadyNotified) {
        console.log(`🧹 Cleaning up notification for ${landmark.name} (now ${Math.round(distance)}m away)`);
        notifiedLandmarksRef.current.delete(landmarkKey);
      }
    });

    // Log summary
    if (nearbyLandmarks.length > 0) {
      const cardCount = nearbyLandmarks.filter(({ distance }) => distance <= cardDistance).length;
      const notificationCount = nearbyLandmarks.filter(({ distance }) => distance <= notificationDistance).length;
      
      console.log(`📊 Proximity summary: ${cardCount} cards, ${notificationCount} notifications, ${notifiedLandmarksRef.current.size} notified`);
    }

  }, [nearbyLandmarks, proximitySettings, userLocation]);

  // Cleanup notifications when proximity is disabled
  useEffect(() => {
    if (!proximitySettings?.is_enabled) {
      console.log('🧹 Clearing all proximity notifications (proximity disabled)');
      notifiedLandmarksRef.current.clear();
      setActiveCards({});
    }
  }, [proximitySettings?.is_enabled]);

  const closeProximityCard = (landmarkId: string) => {
    setActiveCards(prev => {
      const newCards = { ...prev };
      delete newCards[landmarkId];
      return newCards;
    });
  };

  const showRouteToService = (landmark: Landmark) => {
    console.log('🗺️ Showing route to service:', landmark.name);
    // TODO: Implement route to service functionality
  };

  return {
    nearbyLandmarks,
    notifiedCount: notifiedLandmarksRef.current.size,
    activeCards,
    closeProximityCard,
    showRouteToService
  };
};
