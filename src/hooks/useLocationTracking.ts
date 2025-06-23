
import { useState, useEffect, useRef, useCallback } from 'react';
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance, debounce } from '@/utils/proximityUtils';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { usePermissionMonitor } from '@/hooks/usePermissionMonitor';
import { useToast } from '@/hooks/use-toast';

interface LocationTrackingState {
  isTracking: boolean;
  isPermissionGranted: boolean | null;
  error: string | null;
  lastUpdate: Date | null;
  movementDetected: boolean;
  isStartingUp: boolean; // New state to track automatic startup
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
  const { permissionState, checkPermission } = usePermissionMonitor();
  
  const [locationState, setLocationState] = useState<LocationTrackingState>({
    isTracking: false,
    isPermissionGranted: null,
    error: null,
    lastUpdate: null,
    movementDetected: false,
    isStartingUp: false,
  });
  
  const [userLocation, setCurrentUserLocation] = useState<UserLocation | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastLocationRef = useRef<UserLocation | null>(null);
  const isPageVisibleRef = useRef<boolean>(true);
  const lastToastRef = useRef<number>(0);
  const autoStartAttemptedRef = useRef<boolean>(false);

  // DEBUG LOGGING: Log current state every time it changes
  useEffect(() => {
    console.log('🔍 [LOCATION DEBUG] State changed:', {
      isTracking: locationState.isTracking,
      isStartingUp: locationState.isStartingUp,
      userLocation: userLocation ? `lat: ${userLocation.latitude.toFixed(4)}, lng: ${userLocation.longitude.toFixed(4)}, acc: ${userLocation.accuracy}m` : null,
      permissionState: permissionState.state,
      proximityEnabled: proximitySettings?.is_enabled,
      watchId: watchIdRef.current,
      error: locationState.error
    });
  }, [locationState, userLocation, permissionState.state, proximitySettings?.is_enabled]);

  // Automatic startup logic - monitor proximity settings and permission state
  useEffect(() => {
    const shouldAutoStart = proximitySettings?.is_enabled && 
                           permissionState.state === 'granted' && 
                           !locationState.isTracking &&
                           !autoStartAttemptedRef.current;

    console.log('🚀 [AUTO-START DEBUG] Checking auto-start conditions:', {
      proximityEnabled: proximitySettings?.is_enabled,
      permissionGranted: permissionState.state === 'granted',
      notTracking: !locationState.isTracking,
      notAttempted: !autoStartAttemptedRef.current,
      shouldAutoStart
    });

    if (shouldAutoStart) {
      console.log('🚀 [AUTO-START] Starting location tracking: proximity enabled + permission granted + not tracking');
      autoStartAttemptedRef.current = true;
      
      setLocationState(prev => ({ ...prev, isStartingUp: true }));
      
      startTrackingWithPermission()
        .then(() => {
          console.log('✅ [AUTO-START] Auto-start successful');
          setLocationState(prev => ({ ...prev, isStartingUp: false }));
        })
        .catch((error) => {
          console.error('❌ [AUTO-START] Auto-start failed:', error);
          setLocationState(prev => ({ ...prev, isStartingUp: false }));
        });
    }

    // Reset auto-start flag when proximity is disabled or permission changes
    if (!proximitySettings?.is_enabled || permissionState.state !== 'granted') {
      if (autoStartAttemptedRef.current) {
        console.log('🔄 [AUTO-START] Resetting auto-start flag');
        autoStartAttemptedRef.current = false;
      }
    }
  }, [proximitySettings?.is_enabled, permissionState.state, locationState.isTracking]);

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

  // Monitor permission state changes and stop tracking if permission is revoked
  useEffect(() => {
    if (permissionState.state === 'denied' && locationState.isTracking) {
      console.log('🚫 [PERMISSION] Permission was revoked, stopping location tracking');
      stopTracking();
      
      debouncedToast(
        "Location Permission Lost",
        "Proximity alerts have been paused because location permission was revoked. Please re-enable location access.",
        "destructive"
      );
    }
  }, [permissionState.state, locationState.isTracking, debouncedToast]);

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

  // Handle location update
  const handleLocationUpdate = useCallback((position: GeolocationPosition) => {
    const newLocation: UserLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: Date.now(),
    };

    console.log('📍 [LOCATION UPDATE] Received new location:', {
      lat: newLocation.latitude.toFixed(6),
      lng: newLocation.longitude.toFixed(6),
      accuracy: newLocation.accuracy ? `${Math.round(newLocation.accuracy)}m` : 'unknown',
      timestamp: new Date(newLocation.timestamp).toLocaleTimeString()
    });

    const movementDetected = detectMovement(newLocation, lastLocationRef.current);
    
    setCurrentUserLocation(newLocation);
    setUserLocation(newLocation);
    lastLocationRef.current = newLocation;
    
    setLocationState(prev => ({
      ...prev,
      lastUpdate: new Date(),
      movementDetected,
      error: null,
      isPermissionGranted: true,
    }));

    console.log('✅ [LOCATION UPDATE] Location state updated successfully');
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
    
    console.error('❌ [LOCATION ERROR]', {
      code: error.code,
      message: errorMessage,
      originalMessage: error.message
    });
    
    setLocationState(prev => ({
      ...prev,
      error: errorMessage,
    }));
  }, []);

  // Check permission status with permission monitor
  const hasLocationPermission = useCallback(async (): Promise<boolean> => {
    const state = await checkPermission();
    console.log('🔐 [PERMISSION CHECK] Result:', state);
    return state === 'granted';
  }, [checkPermission]);

  // Request current location (one-time)
  const requestCurrentLocation = useCallback(async (): Promise<UserLocation | null> => {
    console.log('📱 [REQUEST LOCATION] Requesting current location...');
    
    if (!navigator.geolocation) {
      console.error('❌ [REQUEST LOCATION] Geolocation not supported');
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
          console.log('✅ [REQUEST LOCATION] Success');
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
          console.error('❌ [REQUEST LOCATION] Failed:', error);
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
    console.log('🔥 [START TRACKING] Starting with permission granted...');
    
    if (!navigator.geolocation) {
      console.error('❌ [START TRACKING] Geolocation not supported');
      debouncedToast(
        "Location Not Supported",
        "Your browser doesn't support location services.",
        "destructive"
      );
      return;
    }

    console.log('🔥 [START TRACKING] Setting isTracking to true...');

    setLocationState(prev => ({
      ...prev,
      isTracking: true,
      isPermissionGranted: true,
      error: null,
    }));

    // Start watching position
    console.log('👀 [START TRACKING] Starting watchPosition...');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        console.log('📍 [WATCH POSITION] Callback triggered');
        handleLocationUpdate(position);
      },
      (error) => {
        console.error('❌ [WATCH POSITION] Error callback triggered:', error);
        handleLocationError(error);
      },
      {
        enableHighAccuracy: false, // Start with lower accuracy for battery
        timeout: 15000,
        maximumAge: 30000,
      }
    );

    console.log('✅ [START TRACKING] Location tracking started with watchId:', watchIdRef.current);
  }, [handleLocationUpdate, handleLocationError, debouncedToast]);

  // Start continuous tracking (with permission check)
  const startTracking = useCallback(async (): Promise<void> => {
    console.log('🚀 [START TRACKING] Starting with permission check...');
    
    if (!navigator.geolocation) {
      console.error('❌ [START TRACKING] Geolocation not supported');
      debouncedToast(
        "Location Not Supported",
        "Your browser doesn't support location services.",
        "destructive"
      );
      return;
    }

    const hasPermission = await hasLocationPermission();
    if (!hasPermission) {
      console.log('❌ [START TRACKING] Location permission not granted, cannot start tracking');
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
    console.log('🛑 [STOP TRACKING] Stopping location tracking...');
    
    if (watchIdRef.current !== null) {
      console.log('🛑 [STOP TRACKING] Clearing watchPosition with id:', watchIdRef.current);
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setLocationState(prev => ({
      ...prev,
      isTracking: false,
    }));

    // Reset auto-start flag when manually stopping
    autoStartAttemptedRef.current = false;

    console.log('✅ [STOP TRACKING] Location tracking stopped');
  }, []);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
      console.log('👁️ [VISIBILITY] Page visibility changed:', isPageVisibleRef.current ? 'visible' : 'hidden');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Stop tracking when proximity is explicitly disabled (RACE CONDITION FIX)
  useEffect(() => {
    // Only stop tracking if proximity is explicitly disabled (false), not undefined/null
    const isExplicitlyDisabled = proximitySettings?.is_enabled === false;
    
    console.log('🔄 [PROXIMITY CHECK] Checking proximity state:', {
      isEnabled: proximitySettings?.is_enabled,
      isExplicitlyDisabled,
      isTracking: locationState.isTracking,
      settingsLoaded: proximitySettings !== null && proximitySettings !== undefined
    });
    
    if (isExplicitlyDisabled && locationState.isTracking) {
      console.log('🔄 [PROXIMITY] Proximity explicitly disabled, stopping tracking');
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
