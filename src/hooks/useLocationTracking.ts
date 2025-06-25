import { useState, useEffect, useRef, useCallback } from 'react';
import { UserLocation } from '@/types/proximityAlerts';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useCombinedLandmarks } from '@/hooks/useCombinedLandmarks';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { useStreetViewBatch } from '@/hooks/useStreetViewBatch';
import { 
  detectMovement, 
  calculateAdaptiveInterval, 
  getOptimalLocationOptions,
  isSignificantLocationChange,
  calculateDistance,
  MovementState,
  LocationHistory
} from '@/utils/locationUtils';

interface LocationTrackingState {
  isTracking: boolean;
  error: string | null;
  lastUpdate: Date | null;
  pollInterval: number;
  movementState: MovementState;
  consecutiveFailures: number;
  isInBackground: boolean;
}

interface LocationTrackingHook {
  locationState: LocationTrackingState;
  userLocation: UserLocation | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  requestCurrentLocation: () => Promise<UserLocation | null>;
  forceLocationUpdate: () => Promise<void>;
}

const BASE_POLLING_INTERVAL = 15000; // 15 seconds base interval
const MAX_LOCATION_HISTORY = 10;
const LOCATION_CHANGE_THRESHOLD = 20; // meters

export const useLocationTracking = (): LocationTrackingHook => {
  const { proximitySettings, setUserLocation } = useProximityAlerts();
  
  const [locationState, setLocationState] = useState<LocationTrackingState>({
    isTracking: false,
    error: null,
    lastUpdate: null,
    pollInterval: BASE_POLLING_INTERVAL,
    movementState: {
      isMoving: false,
      lastMovementTime: Date.now(),
      stationaryDuration: 0,
      averageSpeed: 0
    },
    consecutiveFailures: 0,
    isInBackground: false
  });
  
  const [userLocation, setCurrentUserLocation] = useState<UserLocation | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef<number>(0);
  const locationHistoryRef = useRef<LocationHistory[]>([]);
  const lastSignificantLocationRef = useRef<UserLocation | null>(null);

  // Get combined landmarks and nearby landmarks
  const combinedLandmarks = useCombinedLandmarks();
  const nearbyLandmarks = useNearbyLandmarks({
    userLocation,
    landmarks: combinedLandmarks,
    toastDistance: proximitySettings?.toast_distance || 100
  });

  // Add Street View batch pre-loading
  const { batchPreloadStreetView } = useStreetViewBatch();
  const lastPreloadLocationRef = useRef<UserLocation | null>(null);
  const PRELOAD_DISTANCE_THRESHOLD = 200; // meters - trigger preload when moving this distance

  // Monitor page visibility for background/foreground detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isInBackground = document.hidden;
      setLocationState(prev => ({ ...prev, isInBackground }));
      
      if (!isInBackground && locationState.isTracking) {
        // When coming back to foreground, trigger immediate location update
        console.log('📱 App back in foreground, requesting immediate location update');
        requestLocationUpdate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [locationState.isTracking]);

  // Handle location update with movement detection and filtering
  const handleLocationUpdate = useCallback((position: GeolocationPosition) => {
    const newLocation: UserLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: Date.now(),
    };

    const newLocationHistory: LocationHistory = {
      latitude: newLocation.latitude,
      longitude: newLocation.longitude,
      timestamp: newLocation.timestamp,
      accuracy: newLocation.accuracy
    };

    // Check if this is a significant location change
    const lastSignificant = lastSignificantLocationRef.current;
    const isSignificant = !lastSignificant || 
      isSignificantLocationChange(lastSignificant, newLocationHistory, LOCATION_CHANGE_THRESHOLD);

    // Update location history
    locationHistoryRef.current.push(newLocationHistory);
    if (locationHistoryRef.current.length > MAX_LOCATION_HISTORY) {
      locationHistoryRef.current.shift();
    }

    // Detect movement
    const movementState = detectMovement(locationHistoryRef.current.slice(0, -1), newLocationHistory);

    pollCountRef.current += 1;
    console.log(`📍 Location poll #${pollCountRef.current}:`, {
      lat: newLocation.latitude.toFixed(6),
      lng: newLocation.longitude.toFixed(6),
      accuracy: newLocation.accuracy ? `${Math.round(newLocation.accuracy)}m` : 'unknown',
      isMoving: movementState.isMoving,
      speed: `${movementState.averageSpeed.toFixed(1)} m/s`,
      significant: isSignificant,
      nearbyCount: nearbyLandmarks.length,
      time: new Date().toLocaleTimeString()
    });

    // Only update state if location change is significant or we're moving
    if (isSignificant || movementState.isMoving) {
      setCurrentUserLocation(newLocation);
      setUserLocation(newLocation);
      lastSignificantLocationRef.current = newLocation;
      
      console.log(`✅ Location updated (moved ${lastSignificant ? 
        Math.round(isSignificantLocationChange(lastSignificant, newLocationHistory, 0) ? 
          calculateDistance(lastSignificant.latitude, lastSignificant.longitude, newLocation.latitude, newLocation.longitude) : 0) : 0}m)`);
    } else {
      console.log(`🔄 Location unchanged (within ${LOCATION_CHANGE_THRESHOLD}m threshold)`);
    }

    // Trigger Street View pre-loading for nearby landmarks when location changes significantly
    const shouldPreloadStreetView = () => {
      if (!lastPreloadLocationRef.current) return true;
      
      const distanceFromLastPreload = calculateDistance(
        lastPreloadLocationRef.current.latitude,
        lastPreloadLocationRef.current.longitude,
        newLocation.latitude,
        newLocation.longitude
      );
      
      return distanceFromLastPreload >= PRELOAD_DISTANCE_THRESHOLD;
    };

    if (isSignificant && nearbyLandmarks.length > 0 && shouldPreloadStreetView()) {
      console.log(`🔄 Triggering Street View pre-loading for ${nearbyLandmarks.length} nearby landmarks`);
      
      // Extract landmarks from NearbyLandmark objects and pre-load Street View
      const landmarksToPreload = nearbyLandmarks.map(nearbyLandmark => nearbyLandmark.landmark);
      
      batchPreloadStreetView(landmarksToPreload).catch(error => {
        console.warn('⚠️ Street View pre-loading failed:', error);
      });
      
      lastPreloadLocationRef.current = newLocation;
    }

    // Calculate adaptive polling interval
    const adaptiveInterval = calculateAdaptiveInterval(
      movementState,
      nearbyLandmarks.length,
      BASE_POLLING_INTERVAL
    );

    // Increase interval if in background
    const finalInterval = locationState.isInBackground ? 
      Math.min(adaptiveInterval * 2, 60000) : adaptiveInterval;

    setLocationState(prev => ({
      ...prev,
      lastUpdate: new Date(),
      error: null,
      consecutiveFailures: 0,
      movementState,
      pollInterval: finalInterval
    }));

    // Update polling interval if it changed significantly
    if (Math.abs(finalInterval - locationState.pollInterval) > 2000) {
      console.log(`⏱️ Adapting poll interval: ${locationState.pollInterval}ms → ${finalInterval}ms`);
      scheduleNextPoll(finalInterval);
    }
  }, [setUserLocation, nearbyLandmarks.length, locationState.isInBackground, locationState.pollInterval, batchPreloadStreetView, nearbyLandmarks]);

  // Handle location error with exponential backoff
  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Location access failed';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out';
        break;
    }
    
    setLocationState(prev => {
      const consecutiveFailures = prev.consecutiveFailures + 1;
      const backoffMultiplier = Math.min(Math.pow(1.5, consecutiveFailures), 4);
      const adaptiveInterval = Math.min(prev.pollInterval * backoffMultiplier, 60000);
      
      console.error(`❌ Location poll #${pollCountRef.current + 1} error (${consecutiveFailures} consecutive):`, errorMessage);
      console.log(`⏱️ Backing off to ${adaptiveInterval}ms interval`);
      
      return {
        ...prev,
        error: errorMessage,
        consecutiveFailures,
        pollInterval: adaptiveInterval
      };
    });
  }, []);

  // Request current location (one-time)
  const requestCurrentLocation = useCallback(async (): Promise<UserLocation | null> => {
    console.log('📱 Requesting current location...');
    
    if (!navigator.geolocation) {
      console.error('❌ Geolocation not supported');
      return null;
    }

    return new Promise((resolve) => {
      const options = getOptimalLocationOptions(
        locationState.movementState,
        nearbyLandmarks.length,
        0 // No consecutive failures for manual request
      );

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ Current location obtained');
          handleLocationUpdate(position);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          });
        },
        (error) => {
          console.error('❌ Failed to get current location:', error);
          handleLocationError(error);
          resolve(null);
        },
        options
      );
    });
  }, [handleLocationUpdate, handleLocationError, locationState.movementState, nearbyLandmarks.length]);

  // Force immediate location update
  const forceLocationUpdate = useCallback(async (): Promise<void> => {
    console.log('🔄 Forcing location update...');
    await requestCurrentLocation();
  }, [requestCurrentLocation]);

  // Schedule next poll with current interval
  const scheduleNextPoll = useCallback((interval?: number) => {
    if (pollIntervalRef.current) {
      clearTimeout(pollIntervalRef.current);
    }

    const pollInterval = interval || locationState.pollInterval;
    pollIntervalRef.current = setTimeout(requestLocationUpdate, pollInterval);
  }, [locationState.pollInterval]);

  // Location polling function with adaptive settings
  const requestLocationUpdate = useCallback(() => {
    const pollNumber = pollCountRef.current + 1;
    console.log(`🔄 Starting adaptive location poll #${pollNumber} at ${new Date().toLocaleTimeString()}`);
    
    const options = getOptimalLocationOptions(
      locationState.movementState,
      nearbyLandmarks.length,
      locationState.consecutiveFailures
    );

    console.log(`⚙️ Using options:`, {
      enableHighAccuracy: options.enableHighAccuracy,
      timeout: `${options.timeout}ms`,
      maximumAge: `${options.maximumAge}ms`,
      interval: `${locationState.pollInterval}ms`
    });
    
    navigator.geolocation.getCurrentPosition(
      handleLocationUpdate,
      handleLocationError,
      options
    );

    // Schedule next poll
    scheduleNextPoll();
  }, [handleLocationUpdate, handleLocationError, locationState, nearbyLandmarks.length, scheduleNextPoll]);

  // Start optimized tracking
  const startTracking = useCallback(async (): Promise<void> => {
    console.log(`🚀 Starting optimized location tracking...`);
    
    if (!navigator.geolocation) {
      console.error('❌ Geolocation not supported');
      return;
    }

    // Reset tracking state
    pollCountRef.current = 0;
    locationHistoryRef.current = [];
    lastSignificantLocationRef.current = null;

    // Get initial location
    try {
      await requestCurrentLocation();
    } catch (error) {
      console.error('❌ Initial location request failed:', error);
      return;
    }

    setLocationState(prev => ({
      ...prev,
      isTracking: true,
      error: null,
      consecutiveFailures: 0
    }));

    // Start adaptive polling
    scheduleNextPoll(BASE_POLLING_INTERVAL);

    console.log(`✅ Optimized location tracking started`);
  }, [requestCurrentLocation, scheduleNextPoll]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    console.log('🛑 Stopping location tracking...');
    
    if (pollIntervalRef.current !== null) {
      clearTimeout(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Reset state
    pollCountRef.current = 0;
    locationHistoryRef.current = [];
    lastSignificantLocationRef.current = null;

    setLocationState(prev => ({
      ...prev,
      isTracking: false,
      consecutiveFailures: 0
    }));

    console.log('✅ Location tracking stopped');
  }, []);

  // Auto-start tracking when proximity is enabled
  useEffect(() => {
    if (proximitySettings?.is_enabled && !locationState.isTracking) {
      console.log('🔄 Auto-starting location tracking (proximity enabled)');
      startTracking();
    } else if (!proximitySettings?.is_enabled && locationState.isTracking) {
      console.log('🔄 Auto-stopping location tracking (proximity disabled)');
      stopTracking();
    }
  }, [proximitySettings?.is_enabled, locationState.isTracking, startTracking, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    locationState,
    userLocation,
    startTracking,
    stopTracking,
    requestCurrentLocation,
    forceLocationUpdate,
  };
};
