
import { useState, useEffect, useRef, useCallback } from 'react';
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance } from '@/utils/proximityUtils';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useToast } from '@/hooks/use-toast';

interface LocationTrackingState {
  isTracking: boolean;
  isPermissionGranted: boolean | null;
  error: string | null;
  lastUpdate: Date | null;
  movementDetected: boolean;
}

interface LocationTrackingHook {
  locationState: LocationTrackingState;
  userLocation: UserLocation | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  requestCurrentLocation: () => Promise<UserLocation | null>;
  hasLocationPermission: () => Promise<boolean>;
}

// Polling intervals in milliseconds
const POLLING_INTERVALS = {
  DEFAULT: 30000,        // 30 seconds
  NEAR_LANDMARKS: 10000, // 10 seconds
  FAR_FROM_LANDMARKS: 120000, // 2 minutes
  BACKGROUND: 300000,    // 5 minutes
};

const MOVEMENT_THRESHOLD = 10; // meters
const NEAR_LANDMARK_MULTIPLIER = 2; // 2x the alert distance
const FAR_LANDMARK_THRESHOLD = 5000; // 5km

export const useLocationTracking = (): LocationTrackingHook => {
  const { toast } = useToast();
  const { proximitySettings, proximityAlerts, setUserLocation } = useProximityAlerts();
  
  const [locationState, setLocationState] = useState<LocationTrackingState>({
    isTracking: false,
    isPermissionGranted: null,
    error: null,
    lastUpdate: null,
    movementDetected: false,
  });
  
  const [userLocation, setCurrentUserLocation] = useState<UserLocation | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<UserLocation | null>(null);
  const isPageVisibleRef = useRef<boolean>(true);

  // Check if user has moved significantly
  const detectMovement = useCallback((newLocation: UserLocation, lastLocation: UserLocation | null): boolean => {
    if (!lastLocation) return true;
    
    const distance = calculateDistance(
      lastLocation.latitude,
      lastLocation.longitude,
      newLocation.latitude,
      newLocation.longitude
    );
    
    return distance > MOVEMENT_THRESHOLD;
  }, []);

  // Calculate optimal polling interval based on proximity to landmarks
  const calculatePollingInterval = useCallback((location: UserLocation): number => {
    if (!proximitySettings?.is_enabled) return POLLING_INTERVALS.DEFAULT;
    if (!isPageVisibleRef.current) return POLLING_INTERVALS.BACKGROUND;

    // Find nearest landmark
    let nearestDistance = Infinity;
    
    proximityAlerts.forEach(alert => {
      if (!alert.is_enabled) return;
      
      // For now, we'll use a placeholder coordinate since we need landmark coordinates
      // This would be enhanced to get actual landmark coordinates
      const mockLandmarkCoords = { lat: 0, lng: 0 }; // TODO: Get from landmarks data
      
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        mockLandmarkCoords.lat,
        mockLandmarkCoords.lng
      );
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
      }
    });

    // Determine interval based on proximity
    if (nearestDistance < (proximitySettings.default_distance * NEAR_LANDMARK_MULTIPLIER)) {
      return POLLING_INTERVALS.NEAR_LANDMARKS;
    } else if (nearestDistance > FAR_LANDMARK_THRESHOLD) {
      return POLLING_INTERVALS.FAR_FROM_LANDMARKS;
    }
    
    return POLLING_INTERVALS.DEFAULT;
  }, [proximitySettings, proximityAlerts]);

  // Handle location update
  const handleLocationUpdate = useCallback((position: GeolocationPosition) => {
    const newLocation: UserLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: Date.now(),
    };

    const movementDetected = detectMovement(newLocation, lastLocationRef.current);
    
    setCurrentUserLocation(newLocation);
    setUserLocation(newLocation);
    lastLocationRef.current = newLocation;
    
    setLocationState(prev => ({
      ...prev,
      lastUpdate: new Date(),
      movementDetected,
      error: null,
    }));

    console.log('Location updated:', newLocation);
  }, [detectMovement, setUserLocation]);

  // Handle location error
  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Location access failed';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied';
        setLocationState(prev => ({ ...prev, isPermissionGranted: false }));
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out';
        break;
    }
    
    setLocationState(prev => ({
      ...prev,
      error: errorMessage,
    }));

    console.error('Location error:', errorMessage, error);
  }, []);

  // Check permission status
  const hasLocationPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) return false;
    
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        return permission.state === 'granted';
      }
      
      // Fallback: try to get position to check permission
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { timeout: 5000 }
        );
      });
    } catch (error) {
      console.error('Error checking location permission:', error);
      return false;
    }
  }, []);

  // Request current location (one-time)
  const requestCurrentLocation = useCallback(async (): Promise<UserLocation | null> => {
    if (!navigator.geolocation) {
      toast({
        title: "Location Not Supported",
        description: "Your browser doesn't support location services.",
        variant: "destructive",
      });
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          };
          
          handleLocationUpdate(position);
          resolve(location);
        },
        (error) => {
          handleLocationError(error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, [handleLocationUpdate, handleLocationError, toast]);

  // Start continuous tracking
  const startTracking = useCallback(async (): Promise<void> => {
    if (!navigator.geolocation) {
      toast({
        title: "Location Not Supported",
        description: "Your browser doesn't support location services.",
        variant: "destructive",
      });
      return;
    }

    const hasPermission = await hasLocationPermission();
    if (!hasPermission) {
      toast({
        title: "Location Permission Required",
        description: "Please allow location access to enable proximity alerts.",
        variant: "destructive",
      });
      return;
    }

    setLocationState(prev => ({
      ...prev,
      isTracking: true,
      isPermissionGranted: true,
      error: null,
    }));

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleLocationUpdate,
      handleLocationError,
      {
        enableHighAccuracy: false, // Start with lower accuracy for battery
        timeout: 15000,
        maximumAge: 30000,
      }
    );

    console.log('Location tracking started');
  }, [hasLocationPermission, handleLocationUpdate, handleLocationError, toast]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    setLocationState(prev => ({
      ...prev,
      isTracking: false,
    }));

    console.log('Location tracking stopped');
  }, []);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
      console.log('Page visibility changed:', isPageVisibleRef.current ? 'visible' : 'hidden');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Auto-start tracking when proximity alerts are enabled
  useEffect(() => {
    if (proximitySettings?.is_enabled && !locationState.isTracking) {
      startTracking();
    } else if (!proximitySettings?.is_enabled && locationState.isTracking) {
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
    hasLocationPermission,
  };
};
