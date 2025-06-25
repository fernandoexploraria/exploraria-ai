
import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { useTTSContext } from '@/contexts/TTSContext';
import { useStreetView } from '@/hooks/useStreetView';
import { Landmark } from '@/data/landmarks';
import { supabase } from '@/integrations/supabase/client';

interface NotificationState {
  [landmarkId: string]: number; // timestamp of last notification
}

interface PrepZoneState {
  [landmarkId: string]: {
    entered: boolean;
    streetViewPreloaded: boolean;
    timestamp: number;
  };
}

const NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes in milliseconds
const STORAGE_KEY = 'proximity_notifications_state';
const PREP_ZONE_STORAGE_KEY = 'prep_zone_state';

export const useProximityNotifications = () => {
  const { proximitySettings } = useProximityAlerts();
  const { userLocation } = useLocationTracking();
  const { speak } = useTTSContext();
  const { preloadStreetView, getCachedData } = useStreetView();
  const notificationStateRef = useRef<NotificationState>({});
  const prepZoneStateRef = useRef<PrepZoneState>({});
  const previousNearbyLandmarksRef = useRef<Set<string>>(new Set());

  // Check if proximity settings are loaded with valid distance values
  const isProximitySettingsReady = proximitySettings && 
    typeof proximitySettings.notification_distance === 'number' && 
    typeof proximitySettings.outer_distance === 'number' && 
    typeof proximitySettings.card_distance === 'number';

  // Get nearby landmarks within notification distance - only if settings are ready
  const nearbyLandmarks = useNearbyLandmarks({
    userLocation,
    notificationDistance: isProximitySettingsReady ? proximitySettings.notification_distance : 100
  });

  // Get landmarks within prep zone (outer_distance) - only if settings are ready
  const prepZoneLandmarks = useNearbyLandmarks({
    userLocation,
    notificationDistance: isProximitySettingsReady ? proximitySettings.outer_distance : 250
  });

  // Load notification state from localStorage
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        notificationStateRef.current = JSON.parse(savedState);
      }

      const savedPrepState = localStorage.getItem(PREP_ZONE_STORAGE_KEY);
      if (savedPrepState) {
        prepZoneStateRef.current = JSON.parse(savedPrepState);
      }
    } catch (error) {
      console.error('Failed to load notification state:', error);
    }
  }, []);

  // Save notification state to localStorage
  const saveNotificationState = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notificationStateRef.current));
      localStorage.setItem(PREP_ZONE_STORAGE_KEY, JSON.stringify(prepZoneStateRef.current));
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

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      // Create a simple notification beep using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
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

  // Handle prep zone entry and Street View pre-loading
  const handlePrepZoneEntry = useCallback(async (landmark: Landmark) => {
    const landmarkId = landmark.id;
    const prepState = prepZoneStateRef.current[landmarkId];

    // Check if we've already handled this landmark's prep zone
    if (prepState?.entered && prepState?.streetViewPreloaded) {
      return;
    }

    console.log(`🎯 Entered prep zone for ${landmark.name} - starting Street View pre-load`);

    // Update prep zone state
    prepZoneStateRef.current[landmarkId] = {
      entered: true,
      streetViewPreloaded: false,
      timestamp: Date.now()
    };

    // Start Street View pre-loading in the background
    try {
      await preloadStreetView(landmark);
      
      // Update state to indicate Street View is preloaded
      prepZoneStateRef.current[landmarkId] = {
        ...prepZoneStateRef.current[landmarkId],
        streetViewPreloaded: true
      };

      console.log(`✅ Street View pre-loaded for ${landmark.name}`);
      saveNotificationState();
    } catch (error) {
      console.error(`❌ Failed to pre-load Street View for ${landmark.name}:`, error);
    }
  }, [preloadStreetView, saveNotificationState]);

  // Show proximity toast notification with sound, TTS, and Street View
  const showProximityToast = useCallback(async (landmark: Landmark, distance: number) => {
    const formattedDistance = distance >= 1000 
      ? `${(distance / 1000).toFixed(1)} km` 
      : `${Math.round(distance)} m`;

    console.log(`🔔 Showing proximity notification for ${landmark.name} at ${formattedDistance}`);

    // Play notification sound first
    playNotificationSound();

    // Speak landmark name with TTS (brief announcement)
    const ttsText = `Approaching ${landmark.name}`;
    try {
      await speak(ttsText, false);
    } catch (error) {
      console.log('TTS announcement failed:', error);
    }

    // Check if Street View is pre-loaded for enhanced toast
    const streetViewData = getCachedData(landmark.id);
    const hasStreetView = !!streetViewData;

    // Show visual toast with optional Street View enhancement
    toast(`🗺️ ${landmark.name}`, {
      description: `You're ${formattedDistance} away${hasStreetView ? ' • Street View ready' : ''} • ${landmark.description.substring(0, 100)}${landmark.description.length > 100 ? '...' : ''}`,
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
  }, [saveNotificationState, showRouteToLandmark, playNotificationSound, speak, getCachedData]);

  // Monitor prep zone entries - only when settings are ready
  useEffect(() => {
    if (!isProximitySettingsReady || !proximitySettings.is_enabled || !userLocation || prepZoneLandmarks.length === 0) {
      return;
    }

    // Handle newly entered prep zones
    prepZoneLandmarks.forEach(({ landmark }) => {
      const landmarkId = landmark.id;
      const prepState = prepZoneStateRef.current[landmarkId];
      
      if (!prepState?.entered) {
        handlePrepZoneEntry(landmark);
      }
    });

    // Clean up prep zone state for landmarks that are no longer nearby
    const currentPrepZoneIds = new Set(prepZoneLandmarks.map(nl => nl.landmark.id));
    Object.keys(prepZoneStateRef.current).forEach(landmarkId => {
      if (!currentPrepZoneIds.has(landmarkId)) {
        console.log(`🚪 Exited prep zone for landmark ${landmarkId}`);
        delete prepZoneStateRef.current[landmarkId];
        saveNotificationState();
      }
    });
  }, [prepZoneLandmarks, isProximitySettingsReady, proximitySettings?.is_enabled, userLocation, handlePrepZoneEntry, saveNotificationState]);

  // Monitor for newly entered proximity zones - only when settings are ready
  useEffect(() => {
    if (!isProximitySettingsReady || !proximitySettings.is_enabled || !userLocation || nearbyLandmarks.length === 0) {
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
  }, [nearbyLandmarks, isProximitySettingsReady, proximitySettings?.is_enabled, userLocation, canNotify, showProximityToast]);

  // Cleanup expired notifications from state
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      let hasChanges = false;

      // Clean up notification state
      for (const [landmarkId, timestamp] of Object.entries(notificationStateRef.current)) {
        if (now - timestamp > NOTIFICATION_COOLDOWN * 2) { // Keep for 2x cooldown period
          delete notificationStateRef.current[landmarkId];
          hasChanges = true;
        }
      }

      // Clean up prep zone state (keep for 1 hour)
      for (const [landmarkId, state] of Object.entries(prepZoneStateRef.current)) {
        if (now - state.timestamp > 60 * 60 * 1000) { // 1 hour
          delete prepZoneStateRef.current[landmarkId];
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
    prepZoneLandmarks,
    notificationState: notificationStateRef.current,
    prepZoneState: prepZoneStateRef.current,
    isEnabled: proximitySettings?.is_enabled || false
  };
};
