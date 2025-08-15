import { useState, useEffect, useRef, useCallback } from 'react';
import { UserLocation } from '@/types/proximityAlerts';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { useEnhancedStreetViewMulti } from '@/hooks/useEnhancedStreetViewMulti';
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
  currentPollRound: number;
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

  // Get nearby landmarks using outer_distance for enhanced Street View pre-loading
  const nearbyLandmarks = useNearbyLandmarks({
    userLocation,
    notificationDistance: proximitySettings?.outer_distance || 250
  });

  // Add enhanced Street View multi-viewpoint pre-loading
  const { preloadForProximity } = useEnhancedStreetViewMulti();
  const lastPreloadLocationRef = useRef<UserLocation | null>(null);
  const PRELOAD_DISTANCE_THRESHOLD = 200; // meters - trigger preload when moving this distance

  // Monitor page visibility for background/foreground detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isInBackground = document.hidden;
      setLocationState(prev => ({ ...prev, isInBackground }));
      
    if (!isInBackground && locationState.isTracking) {
        // When coming back to foreground, trigger immediate location update
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

    // Only update state if location change is significant or we're moving
    if (isSignificant || movementState.isMoving) {
      setCurrentUserLocation(newLocation);
      setUserLocation(newLocation);
      lastSignificantLocationRef.current = newLocation;
      
    }

    // Trigger enhanced Street View multi-viewpoint pre-loading for nearby landmarks when location changes significantly
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
      // Convert TourLandmark to Landmark format for preloadForProximity
      const landmarksToPreload = nearbyLandmarks.map(nearbyLandmark => ({
        id: nearbyLandmark.landmark.id || nearbyLandmark.landmark.placeId,
        name: nearbyLandmark.landmark.name,
        coordinates: nearbyLandmark.landmark.coordinates,
        description: nearbyLandmark.landmark.description,
        rating: nearbyLandmark.landmark.rating,
        photos: nearbyLandmark.landmark.photos,
        types: nearbyLandmark.landmark.types,
        placeId: nearbyLandmark.landmark.placeId,
        formattedAddress: nearbyLandmark.landmark.formattedAddress
      }));
      
      preloadForProximity(landmarksToPreload, {
        latitude: newLocation.latitude,
        longitude: newLocation.longitude
      }).catch(error => {
        console.warn('⚠️ Enhanced Street View multi-viewpoint pre-loading failed:', error);
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
      scheduleNextPoll(finalInterval);
    }
  }, [setUserLocation, nearbyLandmarks.length, locationState.isInBackground, locationState.pollInterval, preloadForProximity, nearbyLandmarks, proximitySettings?.outer_distance]);

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
      
      
      return {
        ...prev,
        error: errorMessage,
        consecutiveFailures,
        pollInterval: adaptiveInterval
      };
    });
  }, []);

  const requestCurrentLocation = useCallback(async (): Promise<UserLocation | null> => {
    if (!navigator.geolocation) {
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
          handleLocationUpdate(position);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          });
        },
        (error) => {
          handleLocationError(error);
          resolve(null);
        },
        options
      );
    });
  }, [handleLocationUpdate, handleLocationError, locationState.movementState, nearbyLandmarks.length]);

  const forceLocationUpdate = useCallback(async (): Promise<void> => {
    await requestCurrentLocation();
  }, [requestCurrentLocation]);

  const scheduleNextPoll = useCallback((interval?: number) => {
    if (pollIntervalRef.current) {
      clearTimeout(pollIntervalRef.current);
    }

    const pollInterval = interval || locationState.pollInterval;
    pollIntervalRef.current = setTimeout(requestLocationUpdate, pollInterval);
  }, [locationState.pollInterval]);

  const requestLocationUpdate = useCallback(() => {
    const options = getOptimalLocationOptions(
      locationState.movementState,
      nearbyLandmarks.length,
      locationState.consecutiveFailures
    );
    
    navigator.geolocation.getCurrentPosition(
      handleLocationUpdate,
      handleLocationError,
      options
    );

    // Schedule next poll
    scheduleNextPoll();
  }, [handleLocationUpdate, handleLocationError, locationState, nearbyLandmarks.length, scheduleNextPoll]);

  const startTracking = useCallback(async (): Promise<void> => {
    if (!navigator.geolocation) {
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
  }, [requestCurrentLocation, scheduleNextPoll]);

  const stopTracking = useCallback(() => {
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
  }, []);

  // Auto-start tracking when proximity settings exist
  useEffect(() => {
    if (proximitySettings && !locationState.isTracking) {
      startTracking();
    } else if (!proximitySettings && locationState.isTracking) {
      stopTracking();
    }
  }, [proximitySettings, locationState.isTracking, startTracking, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    locationState,
    userLocation,
    currentPollRound: pollCountRef.current,
    startTracking,
    stopTracking,
    requestCurrentLocation,
    forceLocationUpdate,
  };
};
