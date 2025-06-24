
import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { supabase } from '@/integrations/supabase/client';
import { Landmark } from '@/data/landmarks';

interface NotificationState {
  [landmarkId: string]: number; // timestamp of last notification
}

interface GooglePlacesDetails {
  name?: string;
  rating?: number;
  userRatingsTotal?: number;
  phoneNumber?: string;
  address?: string;
  website?: string;
  priceLevel?: number;
  openingHours?: string[];
  isOpenNow?: boolean;
  photos?: string[];
  placeId?: string;
}

const NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes in milliseconds
const STORAGE_KEY = 'proximity_notifications_state';

interface UseProximityNotificationsProps {
  onSelectLandmark?: (landmark: Landmark, googlePlacesDetails?: GooglePlacesDetails) => void;
}

export const useProximityNotifications = ({ onSelectLandmark }: UseProximityNotificationsProps = {}) => {
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

  // Fetch Google Places details for a landmark
  const fetchGooglePlacesDetails = useCallback(async (landmark: Landmark): Promise<GooglePlacesDetails | null> => {
    try {
      console.log(`🔍 Fetching Google Places details for ${landmark.name}`);
      
      const { data, error } = await supabase.functions.invoke('google-places-details', {
        body: {
          landmarkName: landmark.name,
          coordinates: landmark.coordinates
        }
      });

      if (error) {
        console.error('Error fetching Google Places details:', error);
        return null;
      }

      if (data?.data) {
        console.log(`✅ Retrieved Google Places details for ${landmark.name}:`, data.data);
        return data.data;
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch Google Places details:', error);
      return null;
    }
  }, []);

  // Handle Learn More action with Google Places integration
  const handleLearnMore = useCallback(async (landmark: Landmark) => {
    console.log(`📍 Learn More clicked for ${landmark.name}`);
    
    try {
      // Fetch Google Places details
      const googlePlacesDetails = await fetchGooglePlacesDetails(landmark);
      
      // Select the landmark on the map with enriched data
      if (onSelectLandmark) {
        onSelectLandmark(landmark, googlePlacesDetails);
      }
      
      // Log interaction for analytics
      console.log(`🎯 Landmark selected from proximity notification: ${landmark.name}`);
      
    } catch (error) {
      console.error('Error in Learn More handler:', error);
      // Fallback to basic landmark selection
      if (onSelectLandmark) {
        onSelectLandmark(landmark);
      }
    }
  }, [onSelectLandmark, fetchGooglePlacesDetails]);

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
  }, [saveNotificationState, handleLearnMore]);

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
    isEnabled: proximitySettings?.is_enabled || false,
    fetchGooglePlacesDetails
  };
};
