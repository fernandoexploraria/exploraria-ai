
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

interface CardState {
  [placeId: string]: {
    shown: boolean;
    timestamp: number;
  };
}

// NEW: Initialization state interface
interface InitializationState {
  isInitializing: boolean;
  initializationStartTime: number | null;
  hasCompletedFirstCheck: boolean;
  initialNearbyLandmarks: Set<string>;
}

const NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes in milliseconds
const CARD_COOLDOWN = 10 * 60 * 1000; // 10 minutes in milliseconds for cards
const STORAGE_KEY = 'proximity_notifications_state';
const PREP_ZONE_STORAGE_KEY = 'prep_zone_state';
const CARD_STORAGE_KEY = 'proximity_cards_state';

// NEW: Initialization constants
const INITIALIZATION_GRACE_PERIOD = 15000; // 15 seconds grace period
const INITIALIZATION_STORAGE_KEY = 'proximity_initialization_state';

export const useProximityNotifications = () => {
  const { proximitySettings } = useProximityAlerts();
  const { userLocation } = useLocationTracking();
  const { speak } = useTTSContext();
  const { preloadStreetView, getCachedData } = useStreetView();
  const notificationStateRef = useRef<NotificationState>({});
  const prepZoneStateRef = useRef<PrepZoneState>({});
  const cardStateRef = useRef<CardState>({});
  const previousNearbyLandmarksRef = useRef<Set<string>>(new Set());
  const previousCardZoneLandmarksRef = useRef<Set<string>>(new Set());

  // NEW: Initialization state management
  const initializationStateRef = useRef<InitializationState>({
    isInitializing: false,
    initializationStartTime: null,
    hasCompletedFirstCheck: false,
    initialNearbyLandmarks: new Set()
  });

  // State for active proximity cards - use placeId as key
  const [activeCards, setActiveCards] = useState<{[placeId: string]: TourLandmark}>({});

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

  // Get landmarks within card zone (card_distance) - only if settings are ready
  const cardZoneLandmarks = useNearbyLandmarks({
    userLocation,
    notificationDistance: isProximitySettingsReady ? proximitySettings.card_distance : 75
  });

  // NEW: Reset initialization state when proximity is enabled/disabled
  const resetInitializationState = useCallback(() => {
    console.log('🔄 Resetting proximity initialization state');
    
    initializationStateRef.current = {
      isInitializing: false,
      initializationStartTime: null,
      hasCompletedFirstCheck: false,
      initialNearbyLandmarks: new Set()
    };
    
    // Reset tracking refs
    previousNearbyLandmarksRef.current = new Set();
    previousCardZoneLandmarksRef.current = new Set();
    
    // Clear notification cooldowns to give fresh start
    notificationStateRef.current = {};
    prepZoneStateRef.current = {};
    cardStateRef.current = {};
    
    // Clear localStorage state
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PREP_ZONE_STORAGE_KEY);
      localStorage.removeItem(CARD_STORAGE_KEY);
      localStorage.removeItem(INITIALIZATION_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear initialization state:', error);
    }
    
    console.log('✅ Proximity initialization state reset complete');
  }, []);

  // NEW: Start initialization period
  const startInitializationPeriod = useCallback(() => {
    console.log('🚀 Starting proximity initialization grace period');
    
    initializationStateRef.current = {
      isInitializing: true,
      initializationStartTime: Date.now(),
      hasCompletedFirstCheck: false,
      initialNearbyLandmarks: new Set()
    };
    
    // Save to localStorage
    try {
      localStorage.setItem(INITIALIZATION_STORAGE_KEY, JSON.stringify(initializationStateRef.current));
    } catch (error) {
      console.error('Failed to save initialization state:', error);
    }
    
    // Set timeout to end initialization period
    setTimeout(() => {
      console.log('⏰ Initialization grace period ended');
      initializationStateRef.current.isInitializing = false;
      
      try {
        localStorage.setItem(INITIALIZATION_STORAGE_KEY, JSON.stringify(initializationStateRef.current));
      } catch (error) {
        console.error('Failed to update initialization state:', error);
      }
    }, INITIALIZATION_GRACE_PERIOD);
  }, []);

  // NEW: Check if we should skip notifications during initialization
  const shouldSkipNotificationDuringInit = useCallback((placeId: string): boolean => {
    const initState = initializationStateRef.current;
    
    if (!initState.isInitializing) {
      return false; // Not initializing, don't skip
    }
    
    // If this landmark was present during initial check, skip it
    if (initState.initialNearbyLandmarks.has(placeId)) {
      console.log(`🔕 Skipping notification for ${placeId} during initialization (was already nearby)`);
      return true;
    }
    
    return false; // New landmark during initialization, allow notification
  }, []);

  // Monitor proximity settings changes to handle enable/disable
  useEffect(() => {
    if (!proximitySettings) return;
    
    if (proximitySettings.is_enabled) {
      // If proximity just got enabled, start initialization period
      if (!initializationStateRef.current.isInitializing && !initializationStateRef.current.hasCompletedFirstCheck) {
        resetInitializationState();
        startInitializationPeriod();
      }
    } else {
      // If proximity got disabled, reset state
      resetInitializationState();
      setActiveCards({}); // Clear active cards
    }
  }, [proximitySettings?.is_enabled, resetInitializationState, startInitializationPeriod]);

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

      const savedCardState = localStorage.getItem(CARD_STORAGE_KEY);
      if (savedCardState) {
        cardStateRef.current = JSON.parse(savedCardState);
      }

      // NEW: Load initialization state
      const savedInitState = localStorage.getItem(INITIALIZATION_STORAGE_KEY);
      if (savedInitState) {
        const parsedInitState = JSON.parse(savedInitState);
        // Only restore if initialization was recent (within grace period)
        if (parsedInitState.initializationStartTime && 
            Date.now() - parsedInitState.initializationStartTime < INITIALIZATION_GRACE_PERIOD * 2) {
          initializationStateRef.current = parsedInitState;
          console.log('🔄 Restored initialization state from localStorage');
        }
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
      localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(cardStateRef.current));
      localStorage.setItem(INITIALIZATION_STORAGE_KEY, JSON.stringify(initializationStateRef.current));
    } catch (error) {
      console.error('Failed to save notification state:', error);
    }
  }, []);

  // Check if notification cooldown has passed
  const canNotify = useCallback((placeId: string): boolean => {
    const lastNotification = notificationStateRef.current[placeId];
    if (!lastNotification) return true;
    
    const timeSinceLastNotification = Date.now() - lastNotification;
    return timeSinceLastNotification >= NOTIFICATION_COOLDOWN;
  }, []);

  // Check if card cooldown has passed
  const canShowCard = useCallback((placeId: string): boolean => {
    const lastCard = cardStateRef.current[placeId];
    if (!lastCard) return true;
    
    const timeSinceLastCard = Date.now() - lastCard.timestamp;
    return timeSinceLastCard >= CARD_COOLDOWN;
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

  // Function to show route to service from proximity card
  const showRouteToService = useCallback(async (service: any) => {
    if (!userLocation) {
      console.log('No user location available for service route');
      return;
    }

    try {
      console.log(`🏪 Getting route to ${service.name}`);
      
      const { data, error } = await supabase.functions.invoke('mapbox-directions', {
        body: {
          origin: [userLocation.longitude, userLocation.latitude],
          destination: [service.geometry.location.lng, service.geometry.location.lat],
          profile: 'walking'
        }
      });

      if (error) {
        console.error('Error getting service route:', error);
        return;
      }

      if (data?.routes && data.routes.length > 0) {
        const route = data.routes[0];
        console.log(`📍 Service route found: ${Math.round(route.distance)}m, ${Math.round(route.duration / 60)}min`);
        
        // Call global function to show route on map
        if ((window as any).showRouteOnMap) {
          (window as any).showRouteOnMap(route, { name: service.name, coordinates: [service.geometry.location.lng, service.geometry.location.lat] });
        }
      }
      
    } catch (error) {
      console.error('Failed to get service route:', error);
    }
  }, [userLocation]);

  // Handle prep zone entry and Street View pre-loading
  const handlePrepZoneEntry = useCallback(async (landmark: TourLandmark) => {
    const placeId = landmark.placeId;
    const prepState = prepZoneStateRef.current[placeId];

    // Check if we've already handled this landmark's prep zone
    if (prepState?.entered && prepState?.streetViewPreloaded) {
      return;
    }

    console.log(`🎯 Entered prep zone for ${landmark.name} - starting Street View pre-load`);

    // Update prep zone state
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
  }, [preloadStreetView, saveNotificationState]);

  // Handle card zone entry
  const showProximityCard = useCallback((landmark: TourLandmark) => {
    const placeId = landmark.placeId;
    
    if (!canShowCard(placeId)) {
      console.log(`🏪 Card for ${landmark.name} still in cooldown`);
      return;
    }

    console.log(`🏪 Showing proximity card for ${landmark.name}`);

    // Update card state
    cardStateRef.current[placeId] = {
      shown: true,
      timestamp: Date.now()
    };

    // Add to active cards
    setActiveCards(prev => ({
      ...prev,
      [placeId]: landmark
    }));

    saveNotificationState();
  }, [canShowCard, saveNotificationState]);

  // Function to close a proximity card
  const closeProximityCard = useCallback((placeId: string) => {
    console.log(`🏪 Closing proximity card for landmark ${placeId}`);
    
    setActiveCards(prev => {
      const updated = { ...prev };
      delete updated[placeId];
      return updated;
    });
  }, []);

  // Show proximity toast notification with sound, TTS, and Street View
  const showProximityToast = useCallback(async (landmark: TourLandmark, distance: number) => {
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
    const streetViewData = getCachedData(landmark.id || landmark.placeId);
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
    notificationStateRef.current[landmark.placeId] = Date.now();
    saveNotificationState();
  }, [saveNotificationState, showRouteToLandmark, playNotificationSound, speak, getCachedData]);

  // Monitor prep zone entries - only when settings are ready
  useEffect(() => {
    if (!isProximitySettingsReady || !proximitySettings.is_enabled || !userLocation || prepZoneLandmarks.length === 0) {
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
        console.log(`🚪 Exited prep zone for landmark ${placeId}`);
        delete prepZoneStateRef.current[placeId];
        saveNotificationState();
      }
    });
  }, [prepZoneLandmarks, isProximitySettingsReady, proximitySettings?.is_enabled, userLocation, handlePrepZoneEntry, saveNotificationState]);

  // Monitor card zone entries - only when settings are ready
  useEffect(() => {
    if (!isProximitySettingsReady || !proximitySettings.is_enabled || !userLocation || cardZoneLandmarks.length === 0) {
      return;
    }

    const currentCardZoneIds = new Set(cardZoneLandmarks.map(nl => nl.landmark.placeId));
    const previousCardZoneIds = previousCardZoneLandmarksRef.current;

    // Find newly entered card zone landmarks
    const newlyEnteredCardIds = Array.from(currentCardZoneIds).filter(id => !previousCardZoneIds.has(id));

    console.log(`🏪 Card zone check: ${currentCardZoneIds.size} in zone, ${newlyEnteredCardIds.length} newly entered`);

    // Show card for newly entered landmarks (one at a time, closest first)
    if (newlyEnteredCardIds.length > 0) {
      const closestNewCardLandmark = cardZoneLandmarks.find(nl => 
        newlyEnteredCardIds.includes(nl.landmark.placeId)
      );

      if (closestNewCardLandmark && canShowCard(closestNewCardLandmark.landmark.placeId)) {
        showProximityCard(closestNewCardLandmark.landmark);
      }
    }

    // Hide cards for landmarks that are no longer in card zone
    const exitedCardIds = Array.from(previousCardZoneIds).filter(id => !currentCardZoneIds.has(id));
    exitedCardIds.forEach(placeId => {
      if (activeCards[placeId]) {
        console.log(`🏪 Exiting card zone for ${placeId}, hiding card`);
        closeProximityCard(placeId);
      }
    });

    // Update previous card zone landmarks
    previousCardZoneLandmarksRef.current = currentCardZoneIds;
  }, [cardZoneLandmarks, isProximitySettingsReady, proximitySettings?.is_enabled, userLocation, canShowCard, showProximityCard, activeCards, closeProximityCard]);

  // Monitor for newly entered proximity zones with initialization grace period - only when settings are ready
  useEffect(() => {
    if (!isProximitySettingsReady || !proximitySettings.is_enabled || !userLocation || nearbyLandmarks.length === 0) {
      return;
    }

    const currentNearbyIds = new Set(nearbyLandmarks.map(nl => nl.landmark.placeId));
    const previousNearbyIds = previousNearbyLandmarksRef.current;

    // NEW: Handle initialization period
    if (initializationStateRef.current.isInitializing && !initializationStateRef.current.hasCompletedFirstCheck) {
      console.log(`🔄 First proximity check during initialization: ${currentNearbyIds.size} landmarks nearby`);
      
      // Record initial nearby landmarks
      initializationStateRef.current.initialNearbyLandmarks = new Set(currentNearbyIds);
      initializationStateRef.current.hasCompletedFirstCheck = true;
      
      // Set previous to current to avoid triggering notifications
      previousNearbyLandmarksRef.current = currentNearbyIds;
      
      console.log(`📝 Recorded ${currentNearbyIds.size} initial nearby landmarks during grace period`);
      saveNotificationState();
      return;
    }

    // Find newly entered landmarks (in current but not in previous)
    const newlyEnteredIds = Array.from(currentNearbyIds).filter(id => !previousNearbyIds.has(id));

    console.log(`🎯 Proximity check: ${currentNearbyIds.size} nearby, ${newlyEnteredIds.length} newly entered`);

    // Show notification for ONLY the closest newly entered landmark that can be notified
    if (newlyEnteredIds.length > 0) {
      // Find the first (closest) newly entered landmark that can be notified
      // nearbyLandmarks is already sorted by distance (closest first)
      const closestNewLandmark = nearbyLandmarks.find(nl => 
        newlyEnteredIds.includes(nl.landmark.placeId) && 
        canNotify(nl.landmark.placeId) &&
        !shouldSkipNotificationDuringInit(nl.landmark.placeId)
      );

      if (closestNewLandmark) {
        showProximityToast(closestNewLandmark.landmark, closestNewLandmark.distance);
      } else {
        console.log(`🔕 No notifications shown - all newly entered landmarks still in cooldown or skipped during initialization`);
      }
    }

    // Update previous nearby landmarks
    previousNearbyLandmarksRef.current = currentNearbyIds;
  }, [nearbyLandmarks, isProximitySettingsReady, proximitySettings?.is_enabled, userLocation, canNotify, showProximityToast, shouldSkipNotificationDuringInit, saveNotificationState]);

  // Cleanup expired notifications from state
  useEffect(() => {
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

      // Clean up card state (keep for 2x cooldown period)
      for (const [placeId, state] of Object.entries(cardStateRef.current)) {
        if (now - state.timestamp > CARD_COOLDOWN * 2) {
          delete cardStateRef.current[placeId];
          hasChanges = true;
        }
      }

      // NEW: Clean up old initialization state
      const initState = initializationStateRef.current;
      if (initState.initializationStartTime && 
          now - initState.initializationStartTime > INITIALIZATION_GRACE_PERIOD * 3) {
        initializationStateRef.current = {
          isInitializing: false,
          initializationStartTime: null,
          hasCompletedFirstCheck: false,
          initialNearbyLandmarks: new Set()
        };
        hasChanges = true;
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
    cardZoneLandmarks,
    activeCards,
    notificationState: notificationStateRef.current,
    prepZoneState: prepZoneStateRef.current,
    cardState: cardStateRef.current,
    // NEW: Expose initialization state for debugging
    initializationState: initializationStateRef.current,
    isEnabled: proximitySettings?.is_enabled || false,
    closeProximityCard,
    showRouteToService
  };
};
