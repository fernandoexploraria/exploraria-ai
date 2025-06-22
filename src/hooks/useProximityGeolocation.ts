
import { useState, useEffect, useRef, useCallback } from 'react';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface UseProximityGeolocationProps {
  enabled: boolean;
  onLocationUpdate: (location: LocationData) => void;
}

export const useProximityGeolocation = ({ enabled, onLocationUpdate }: UseProximityGeolocationProps) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [isTracking, setIsTracking] = useState(false);
  
  const watchId = useRef<number | null>(null);
  const lastLocation = useRef<LocationData | null>(null);
  const lastMovementTime = useRef<number>(Date.now());
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // Calculate if user is moving based on location changes
  const isUserMoving = useCallback((newLocation: LocationData) => {
    if (!lastLocation.current) return true;
    
    const distance = calculateDistance(
      lastLocation.current.latitude,
      lastLocation.current.longitude,
      newLocation.latitude,
      newLocation.longitude
    );
    
    // Consider moving if moved more than 10 meters
    const isMoving = distance > 10;
    if (isMoving) {
      lastMovementTime.current = Date.now();
    }
    
    return isMoving;
  }, []);

  // Calculate distance between two points in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Handle successful location update
  const handleLocationSuccess = useCallback((position: GeolocationPosition) => {
    const newLocation: LocationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: Date.now()
    };
    
    setLocation(newLocation);
    setError(null);
    onLocationUpdate(newLocation);
    
    // Update movement tracking
    isUserMoving(newLocation);
    lastLocation.current = newLocation;
  }, [onLocationUpdate, isUserMoving]);

  // Handle location error
  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    console.error('Location error:', error);
    setError(error.message);
    setIsTracking(false);
  }, []);

  // Check geolocation permissions
  const checkPermissions = useCallback(async () => {
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setPermissionStatus(result.state);
        return result.state === 'granted';
      } catch (error) {
        console.error('Permission check failed:', error);
        setPermissionStatus('unknown');
        return false;
      }
    }
    return true; // Assume granted if permissions API is not available
  }, []);

  // Start location tracking with adaptive polling
  const startTracking = useCallback(async () => {
    if (!enabled || !navigator.geolocation) return;

    const hasPermission = await checkPermissions();
    if (!hasPermission && permissionStatus === 'denied') {
      setError('Location permission denied');
      return;
    }

    setIsTracking(true);
    setError(null);

    // Use watchPosition for active tracking
    if ('watchPosition' in navigator.geolocation) {
      watchId.current = navigator.geolocation.watchPosition(
        handleLocationSuccess,
        handleLocationError,
        {
          enableHighAccuracy: false, // Save battery
          timeout: 15000,
          maximumAge: 30000 // Accept cached positions up to 30 seconds old
        }
      );
    } else {
      // Fallback to polling for older browsers
      const pollLocation = () => {
        navigator.geolocation.getCurrentPosition(
          handleLocationSuccess,
          handleLocationError,
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 30000
          }
        );
      };

      pollLocation(); // Get initial position
      
      // Adaptive polling based on movement
      const setupPolling = () => {
        if (pollInterval.current) clearInterval(pollInterval.current);
        
        const timeSinceLastMovement = Date.now() - lastMovementTime.current;
        const isRecentlyMoving = timeSinceLastMovement < 60000; // 1 minute
        
        // Poll more frequently if recently moving, less if stationary
        const interval = isRecentlyMoving ? 30000 : 60000; // 30s or 1min
        
        pollInterval.current = setInterval(() => {
          pollLocation();
          setupPolling(); // Readjust polling based on movement
        }, interval);
      };
      
      setupPolling();
    }
  }, [enabled, handleLocationSuccess, handleLocationError, checkPermissions, permissionStatus]);

  // Stop location tracking
  const stopTracking = useCallback(() => {
    setIsTracking(false);
    
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  }, []);

  // Effect to manage tracking state
  useEffect(() => {
    if (enabled) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, startTracking, stopTracking]);

  return {
    location,
    error,
    permissionStatus,
    isTracking,
    checkPermissions,
    calculateDistance
  };
};
