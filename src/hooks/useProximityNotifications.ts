import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { Landmark } from '@/data/landmarks';
import { supabase } from '@/integrations/supabase/client';

interface NotificationState {
  [landmarkId: string]: number; // timestamp of last notification
}

const NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes in milliseconds
const STORAGE_KEY = 'proximity_notifications_state';

export const useProximityNotifications = () => {
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

  // Function to show route to landmark
  const showRouteToLandmark = useCallback(async (landmark: Landmark) => {
    if (!userLocation) {
      console.log('No user location available for route');
      return;
    }

    try {
      console.log(`🗺️ Getting route to ${landmark.name}`);
      
      const { data, error } = await supabase.functions.invoke('mapbox-directions', {
        body: {
          origin: [userLocation.longitude, userLocation.latitude],
          destination: landmark.coordinates,
          profile: 'walking'
        }
      });

      if (error) {
        console.error('Error getting route:', error);
        return;
      }

      if (data?.routes && data.routes.length > 0) {
        const route = data.routes[0];
        console.log(`📍 Route found: ${Math.round(route.distance)}m, ${Math.round(route.duration / 60)}min`);
        
        // Call global function to show route on map
        if ((window as any).showRouteOnMap) {
          (window as any).showRouteOnMap(route, landmark);
        }
      }
      
    } catch (error) {
      console.error('Failed to get route:', error);
    }
  }, [userLocation]);

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
        label: 'Get Me There',
        onClick: () => {
          console.log(`User clicked "Get Me There" for ${landmark.name}`);
          showRouteToLandmark(landmark);
        }
      }
    });

    // Record notification
    notificationStateRef.current[landmark.id] = Date.now();
    saveNotificationState();
  }, [saveNotificationState, showRouteToLandmark]);

  // Monitor for newly entered proximity zones - MODIFIED TO SHOW ONLY ONE TOAST
  useEffect(() => {
    if (!proximitySettings?.is_enabled || !userLocation || nearbyLandmarks.length === 0) {
      return;
    }

    const currentNearbyIds = new Set(nearbyLandmarks.map(nl => nl.landmark.id));
    const previousNearbyIds = previousNearbyLandmarksRef.current;

    // Find newly entered landmarks (in current but not in previous)
    const newlyEnteredIds = Array.from(currentNearbyIds).filter(id => !previousNearbyIds.has(id));

    console.log(`🎯 Proximity check: ${currentNearbyIds.size} nearby, ${newlyEnteredIds.length} newly entered`);

    // Show notification for ONLY the closest newly entered landmark that can be notified
    if (newlyEnteredIds.length > 0) {
      // Find the first (closest) newly entered landmark that can be notified
      // nearbyLandmarks is already sorted by distance (closest first)
      const closestNewLandmark = nearbyLandmarks.find(nl => 
        newlyEnteredIds.includes(nl.landmark.id) && canNotify(nl.landmark.id)
      );

      if (closestNewLandmark) {
        showProximityToast(closestNewLandmark.landmark, closestNewLandmark.distance);
      } else {
        console.log(`🔕 No notifications shown - all newly entered landmarks still in cooldown`);
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
