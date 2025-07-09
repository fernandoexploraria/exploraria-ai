import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { useTTSContext } from '@/contexts/TTSContext';
import { useStreetView } from '@/hooks/useStreetView';
import { TourLandmark } from '@/data/tourLandmarks';
import { supabase } from '@/integrations/supabase/client';

interface NotificationState {
  [placeId: string]: number; // timestamp of last notification
}

interface PrepZoneState {
  [placeId: string]: {
    entered: boolean;
    streetViewPreloaded: boolean;
    timestamp: number;
  };
}


const NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes in milliseconds

const STORAGE_KEY = 'proximity_notifications_state';
const PREP_ZONE_STORAGE_KEY = 'prep_zone_state';


// Global singleton state to prevent multiple instances
let globalProximityManager: {
  isActive: boolean;
  instanceId: string | null;
} = {
  isActive: false,
  instanceId: null
};

export const useProximityNotifications = () => {
  const { proximitySettings } = useProximityAlerts();
  const { userLocation, currentPollRound } = useLocationTracking();
  const { speak } = useTTSContext();
  const { preloadStreetView, getCachedData } = useStreetView();
  const notificationStateRef = useRef<NotificationState>({});
  const prepZoneStateRef = useRef<PrepZoneState>({});
  const previousNearbyLandmarksRef = useRef<Set<string>>(new Set());

  // Generate unique instance ID and check for singleton
  const instanceIdRef = useRef<string>(`proximity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [isActiveInstance, setIsActiveInstance] = useState(false);


  // Singleton management - only one instance can be active
  useEffect(() => {
    const instanceId = instanceIdRef.current;
    
    if (!globalProximityManager.isActive) {
      // Claim the singleton
      globalProximityManager.isActive = true;
      globalProximityManager.instanceId = instanceId;
      setIsActiveInstance(true);
      console.log(`🎯 Proximity notifications instance ${instanceId} activated as singleton`);
    } else if (globalProximityManager.instanceId === instanceId) {
      // This instance already owns the singleton
      setIsActiveInstance(true);
      console.log(`🎯 Proximity notifications instance ${instanceId} confirmed as active singleton`);
    } else {
      // Another instance is already active
      setIsActiveInstance(false);
      console.log(`🚫 Proximity notifications instance ${instanceId} blocked - singleton already active (${globalProximityManager.instanceId})`);
    }

    // Cleanup on unmount
    return () => {
      if (globalProximityManager.instanceId === instanceId) {
        globalProximityManager.isActive = false;
        globalProximityManager.instanceId = null;
        console.log(`🎯 Proximity notifications instance ${instanceId} deactivated singleton`);
      }
    };
  }, []);

  // Check if proximity settings are loaded with valid distance values
  const isProximitySettingsReady = proximitySettings && 
    typeof proximitySettings.notification_distance === 'number' && 
    typeof proximitySettings.outer_distance === 'number';

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
    if (!isActiveInstance) return;
    
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
  }, [isActiveInstance]);

  // Save notification state to localStorage
  const saveNotificationState = useCallback(() => {
    if (!isActiveInstance) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notificationStateRef.current));
      localStorage.setItem(PREP_ZONE_STORAGE_KEY, JSON.stringify(prepZoneStateRef.current));
    } catch (error) {
      console.error('Failed to save notification state:', error);
    }
  }, [isActiveInstance]);


  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!isActiveInstance) return;
    
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
  }, [isActiveInstance]);

  // Function to show route to landmark
  const showRouteToLandmark = useCallback(async (landmark: TourLandmark) => {
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


  // Handle prep zone entry and Street View pre-loading - FIXED: Apply cooldown-first pattern
  const handlePrepZoneEntry = useCallback(async (landmark: TourLandmark) => {
    if (!isActiveInstance) return;
    
    const placeId = landmark.placeId;
    const prepState = prepZoneStateRef.current[placeId];

    // Check if we've already handled this landmark's prep zone
    if (prepState?.entered && prepState?.streetViewPreloaded) {
      return;
    }

    console.log(`🎯 [${instanceIdRef.current}] Entered prep zone for ${landmark.name} - starting Street View pre-load`);

    // FIXED: Set prep zone state IMMEDIATELY after check passes to prevent race conditions
    prepZoneStateRef.current[placeId] = {
      entered: true,
      streetViewPreloaded: false,
      timestamp: Date.now()
    };

    // Start Street View pre-loading in the background - convert to Landmark format
    try {
      const landmarkForPreload = {
        id: landmark.id || landmark.placeId,
        name: landmark.name,
        coordinates: landmark.coordinates,
        description: landmark.description,
        rating: landmark.rating,
        photos: landmark.photos,
        types: landmark.types,
        placeId: landmark.placeId,
        formattedAddress: landmark.formattedAddress
      };
      
      await preloadStreetView(landmarkForPreload);
      
      // Update state to indicate Street View is preloaded
      prepZoneStateRef.current[placeId] = {
        ...prepZoneStateRef.current[placeId],
        streetViewPreloaded: true
      };

      console.log(`✅ Street View pre-loaded for ${landmark.name}`);
      saveNotificationState();
    } catch (error) {
      console.error(`❌ Failed to pre-load Street View for ${landmark.name}:`, error);
    }
  }, [preloadStreetView, saveNotificationState, isActiveInstance]);


  // Show proximity toast notification with sound, TTS, and Street View
  const showProximityToast = useCallback(async (landmark: TourLandmark, distance: number) => {
    if (!isActiveInstance) {
      console.log(`🚫 [${instanceIdRef.current}] Toast blocked - not active instance`);
      return;
    }
    
    const placeId = landmark.placeId;
    const timestamp = new Date().toLocaleTimeString();
    
    // Check cooldown at the very beginning
    const lastNotification = notificationStateRef.current[placeId];
    if (lastNotification) {
      const timeSinceLastNotification = Date.now() - lastNotification;
      if (timeSinceLastNotification < NOTIFICATION_COOLDOWN) {
        console.log(`🔕 [${instanceIdRef.current}] Toast notification for ${landmark.name} still in cooldown (${Math.round((NOTIFICATION_COOLDOWN - timeSinceLastNotification) / 1000)}s remaining) - Round ${currentPollRound} at ${timestamp}`);
        return;
      }
    }

    // Set cooldown immediately after check passes
    notificationStateRef.current[placeId] = Date.now();
    saveNotificationState();

    const formattedDistance = distance >= 1000 
      ? `${(distance / 1000).toFixed(1)} km` 
      : `${Math.round(distance)} m`;

    console.log(`🔔 [${instanceIdRef.current}] Showing proximity notification for ${landmark.name} at ${formattedDistance} - Round ${currentPollRound} at ${timestamp}`);

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
    const streetViewData = getCachedData(landmark.id || landmark.placeId);
    const hasStreetView = !!streetViewData;

    // Show visual toast with optional Street View enhancement and debug info
    toast(`🗺️ ${landmark.name}`, {
      description: `You're ${formattedDistance} away${hasStreetView ? ' • Street View ready' : ''} • Round ${currentPollRound} at ${timestamp}`,
      duration: 8000,
      action: {
        label: 'Get Me There',
        onClick: () => {
          console.log(`User clicked "Get Me There" for ${landmark.name} from Round ${currentPollRound}`);
          showRouteToLandmark(landmark);
        }
      }
    });
  }, [saveNotificationState, showRouteToLandmark, playNotificationSound, speak, getCachedData, currentPollRound, isActiveInstance]);

  // Monitor prep zone entries - only when settings are ready and this is the active instance
  useEffect(() => {
    if (!isActiveInstance || !isProximitySettingsReady || !userLocation || prepZoneLandmarks.length === 0) {
      return;
    }

    // Handle newly entered prep zones
    prepZoneLandmarks.forEach(({ landmark }) => {
      const placeId = landmark.placeId;
      const prepState = prepZoneStateRef.current[placeId];
      
      if (!prepState?.entered) {
        handlePrepZoneEntry(landmark);
      }
    });

    // Clean up prep zone state for landmarks that are no longer nearby
    const currentPrepZoneIds = new Set(prepZoneLandmarks.map(nl => nl.landmark.placeId));
    Object.keys(prepZoneStateRef.current).forEach(placeId => {
      if (!currentPrepZoneIds.has(placeId)) {
        console.log(`🚪 [${instanceIdRef.current}] Exited prep zone for landmark ${placeId}`);
        delete prepZoneStateRef.current[placeId];
        saveNotificationState();
      }
    });
  }, [prepZoneLandmarks, isProximitySettingsReady, userLocation, handlePrepZoneEntry, saveNotificationState, isActiveInstance]);


  // Monitor for newly entered proximity zones - only when settings are ready and this is the active instance
  useEffect(() => {
    if (!isActiveInstance || !isProximitySettingsReady || !proximitySettings || !userLocation || nearbyLandmarks.length === 0) {
      return;
    }

    const currentNearbyIds = new Set(nearbyLandmarks.map(nl => nl.landmark.placeId));
    const previousNearbyIds = previousNearbyLandmarksRef.current;

    // Find newly entered landmarks (in current but not in previous)
    const newlyEnteredIds = Array.from(currentNearbyIds).filter(id => !previousNearbyIds.has(id));

    console.log(`🎯 [${instanceIdRef.current}] Proximity check: ${currentNearbyIds.size} nearby, ${newlyEnteredIds.length} newly entered - Round ${currentPollRound}`);

    // Show notification for ONLY the closest newly entered landmark
    // Cooldown is now handled inside showProximityToast
    if (newlyEnteredIds.length > 0) {
      // Find the first (closest) newly entered landmark
      // nearbyLandmarks is already sorted by distance (closest first)
      const closestNewLandmark = nearbyLandmarks.find(nl => 
        newlyEnteredIds.includes(nl.landmark.placeId)
      );

      if (closestNewLandmark) {
        showProximityToast(closestNewLandmark.landmark, closestNewLandmark.distance);
      }
    }

    // Update previous nearby landmarks
    previousNearbyLandmarksRef.current = currentNearbyIds;
  }, [nearbyLandmarks, isProximitySettingsReady, proximitySettings, userLocation, showProximityToast, currentPollRound, isActiveInstance]);

  // Cleanup expired notifications from state
  useEffect(() => {
    if (!isActiveInstance) return;
    
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      let hasChanges = false;

      // Clean up notification state
      for (const [placeId, timestamp] of Object.entries(notificationStateRef.current)) {
        if (now - timestamp > NOTIFICATION_COOLDOWN * 2) { // Keep for 2x cooldown period
          delete notificationStateRef.current[placeId];
          hasChanges = true;
        }
      }

      // Clean up prep zone state (keep for 1 hour)
      for (const [placeId, state] of Object.entries(prepZoneStateRef.current)) {
        if (now - state.timestamp > 60 * 60 * 1000) { // 1 hour
          delete prepZoneStateRef.current[placeId];
          hasChanges = true;
        }
      }


      if (hasChanges) {
        saveNotificationState();
      }
    }, 60000); // Check every minute

    return () => clearInterval(cleanupInterval);
  }, [saveNotificationState, isActiveInstance]);

  return {
    nearbyLandmarks,
    prepZoneLandmarks,
    notificationState: notificationStateRef.current,
    prepZoneState: prepZoneStateRef.current,
    isEnabled: true, // Always enabled now
    isActiveInstance // Expose this for debugging
  };
};
