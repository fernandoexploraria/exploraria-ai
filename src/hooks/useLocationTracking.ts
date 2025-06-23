
import { useState, useEffect, useRef, useCallback } from 'react';
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance, debounce } from '@/utils/proximityUtils';
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
  startTrackingWithPermission: () => Promise<void>;
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
  const permissionCacheRef = useRef<{ hasPermission: boolean; timestamp: number } | null>(null);
  const lastToastRef = useRef<number>(0);

  // Debounced toast to prevent spam
  const debouncedToast = useCallback(
    debounce((title: string, description: string, variant?: "default" | "destructive") => {
      const now = Date.now();
      if (now - lastToastRef.current > 5000) { // Only show toast every 5 seconds
        toast({ title, description, variant });
        lastToastRef.current = now;
      }
    }, 1000),
    [toast]
  );

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
        // Clear permission cache on denial
        permissionCacheRef.current = null;
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

  // Check permission status with caching
  const hasLocationPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) return false;
    
    // Check cache first (valid for 30 seconds)
    const now = Date.now();
    if (permissionCacheRef.current && (now - permissionCacheRef.current.timestamp) < 30000) {
      console.log('Using cached permission status:', permissionCacheRef.current.hasPermission);
      return permissionCacheRef.current.hasPermission;
    }
    
    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        const hasPermission = permission.state === 'granted';
        
        // Cache the result
        permissionCacheRef.current = { hasPermission, timestamp: now };
        console.log('Permission check result:', hasPermission);
        
        return hasPermission;
      }
      
      // Fallback: try to get position to check permission
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            const hasPermission = true;
            permissionCacheRef.current = { hasPermission, timestamp: now };
            resolve(true);
          },
          () => {
            const hasPermission = false;
            permissionCacheRef.current = { hasPermission, timestamp: now };
            resolve(false);
          },
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
      debouncedToast(
        "Location Not Supported",
        "Your browser doesn't support location services.",
        "destructive"
      );
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
  }, [handleLocationUpdate, handleLocationError, debouncedToast]);

  // Start tracking with permission already granted (bypasses permission check)
  const startTrackingWithPermission = useCallback(async (): Promise<void> => {
    if (!navigator.geolocation) {
      debouncedToast(
        "Location Not Supported",
        "Your browser doesn't support location services.",
        "destructive"
      );
      return;
    }

    console.log('Starting location tracking with permission already granted');

    // Update permission cache to granted
    permissionCacheRef.current = { hasPermission: true, timestamp: Date.now() };

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

    console.log('Location tracking started with permission');
  }, [handleLocationUpdate, handleLocationError, debouncedToast]);

  // Start continuous tracking (with permission check)
  const startTracking = useCallback(async (): Promise<void> => {
    if (!navigator.geolocation) {
      debouncedToast(
        "Location Not Supported",
        "Your browser doesn't support location services.",
        "destructive"
      );
      return;
    }

    const hasPermission = await hasLocationPermission();
    if (!hasPermission) {
      console.log('Location permission not granted, cannot start tracking');
      debouncedToast(
        "Location Permission Required",
        "Please allow location access to enable proximity alerts.",
        "destructive"
      );
      return;
    }

    // Use the permission-granted version
    await startTrackingWithPermission();
  }, [hasLocationPermission, startTrackingWithPermission, debouncedToast]);

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

  // Manual tracking control based on proximity settings (REMOVED AUTO-START)
  // This effect only responds to explicit user actions, not automatic starts
  useEffect(() => {
    if (!proximitySettings?.is_enabled && locationState.isTracking) {
      console.log('Proximity disabled, stopping tracking');
      stopTracking();
    }
  }, [proximitySettings?.is_enabled, locationState.isTracking, stopTracking]);

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
    startTrackingWithPermission,
    stopTracking,
    requestCurrentLocation,
    hasLocationPermission,
  };
};
