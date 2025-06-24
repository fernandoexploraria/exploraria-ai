
import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { Landmark } from '@/data/landmarks';

interface NotificationState {
  [landmarkId: string]: number; // timestamp of last notification
}

const NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes in milliseconds
const STORAGE_KEY = 'proximity_notifications_state';

export const useProximityNotifications = (onSelectLandmark?: (landmark: Landmark) => void) => {
  const { proximitySettings, combinedLandmarks } = useProximityAlerts();
  const { userLocation } = useLocationTracking();
  const notificationStateRef = useRef<NotificationState>({});
  const previousNearbyLandmarksRef = useRef<Set<string>>(new Set());

  // Get nearby landmarks within toast distance
  const nearbyLandmarks = useNearbyLandmarks({
    userLocation,
    landmarks: combinedLandmarks,
    toastDistance: proximitySettings?.toast_distance || 100
  });

  // Load notification state from localStorage
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        notificationStateRef.current = JSON.parse(savedState);
      }
    } catch (error) {
      console.error('Failed to load notification state:', error);
    }
  }, []);

  // Save notification state to localStorage
  const saveNotificationState = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notificationStateRef.current));
    } catch (error) {
      console.error('Failed to save notification state:', error);
    }
  }, []);

  // Check if notification cooldown has passed
  const canNotify = useCallback((landmarkId: string): boolean => {
    const lastNotification = notificationStateRef.current[landmarkId];
    if (!lastNotification) return true;
    
    const timeSinceLastNotification = Date.now() - lastNotification;
    return timeSinceLastNotification >= NOTIFICATION_COOLDOWN;
  }, []);

  // Handle "Learn More" action with Mapbox integration
  const handleLearnMore = useCallback(async (landmark: Landmark) => {
    console.log(`🗺️ Learn More clicked for ${landmark.name} - triggering map focus`);
    
    // Trigger map focus and selection through the callback
    if (onSelectLandmark) {
      onSelectLandmark(landmark);
    }
    
    // Also trigger global map navigation if available
    if ((window as any).focusMapOnLandmark) {
      (window as any).focusMapOnLandmark(landmark);
    }
  }, [onSelectLandmark]);

  // Show proximity toast notification
  const showProximityToast = useCallback((landmark: Landmark, distance: number) => {
    const formattedDistance = distance >= 1000 
      ? `${(distance / 1000).toFixed(1)} km` 
      : `${Math.round(distance)} m`;

    console.log(`🔔 Showing proximity notification for ${landmark.name} at ${formattedDistance}`);

    toast(`🗺️ ${landmark.name}`, {
      description: `You're ${formattedDistance} away • ${landmark.description.substring(0, 100)}${landmark.description.length > 100 ? '...' : ''}`,
      duration: 8000,
      action: {
        label: 'Learn More',
        onClick: () => handleLearnMore(landmark)
      }
    });

    // Record notification
    notificationStateRef.current[landmark.id] = Date.now();
    saveNotificationState();
  }, [handleLearnMore, saveNotificationState]);

  // Monitor for newly entered proximity zones
  useEffect(() => {
    if (!proximitySettings?.is_enabled || !userLocation || nearbyLandmarks.length === 0) {
      return;
    }

    const currentNearbyIds = new Set(nearbyLandmarks.map(nl => nl.landmark.id));
    const previousNearbyIds = previousNearbyLandmarksRef.current;

    // Find newly entered landmarks (in current but not in previous)
    const newlyEnteredIds = Array.from(currentNearbyIds).filter(id => !previousNearbyIds.has(id));

    console.log(`🎯 Proximity check: ${currentNearbyIds.size} nearby, ${newlyEnteredIds.length} newly entered`);

    // Show notifications for newly entered landmarks
    for (const landmarkId of newlyEnteredIds) {
      if (canNotify(landmarkId)) {
        const nearbyLandmark = nearbyLandmarks.find(nl => nl.landmark.id === landmarkId);
        if (nearbyLandmark) {
          showProximityToast(nearbyLandmark.landmark, nearbyLandmark.distance);
        }
      } else {
        console.log(`🔕 Skipping notification for ${landmarkId} - still in cooldown`);
      }
    }

    // Update previous nearby landmarks
    previousNearbyLandmarksRef.current = currentNearbyIds;
  }, [nearbyLandmarks, proximitySettings?.is_enabled, userLocation, canNotify, showProximityToast]);

  // Cleanup expired notifications from state
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      let hasChanges = false;

      for (const [landmarkId, timestamp] of Object.entries(notificationStateRef.current)) {
        if (now - timestamp > NOTIFICATION_COOLDOWN * 2) { // Keep for 2x cooldown period
          delete notificationStateRef.current[landmarkId];
          hasChanges = true;
        }
      }

      if (hasChanges) {
        saveNotificationState();
      }
    }, 60000); // Check every minute

    return () => clearInterval(cleanupInterval);
  }, [saveNotificationState]);

  return {
    nearbyLandmarks,
    notificationState: notificationStateRef.current,
    isEnabled: proximitySettings?.is_enabled || false
  };
};
