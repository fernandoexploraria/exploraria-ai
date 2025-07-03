
import { useEffect, useState, useCallback } from 'react';
import { UserLocation, LocationTrackingState } from '@/types/proximityAlerts';

const DEFAULT_COORDS = {
  latitude: 37.7749,
  longitude: -122.4194, // San Francisco
  accuracy: undefined,
  timestamp: Date.now()
};

// Geolocation configuration with longer timeout and better error handling
const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 30000, // Increased from 10 seconds to 30 seconds
  maximumAge: 60000 // 1 minute cache
};

const TRACKING_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 30000, // Increased timeout for tracking as well
  maximumAge: 30000 // 30 second cache for tracking
};

export const useLocationTracking = () => {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationState, setLocationState] = useState<LocationTrackingState>({
    isTracking: false,
    isPermissionGranted: null,
    error: null,
    lastUpdate: null,
    movementDetected: false,
    pollInterval: 5000, // Default 5 second interval
  });

  const handleGeolocationError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Location access failed';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable. Please check your device settings.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out. Please try again or check your connection.';
        break;
      default:
        errorMessage = `Location error: ${error.message}`;
    }
    
    console.warn('Geolocation error:', { code: error.code, message: error.message });
    return errorMessage;
  }, []);

  const requestLocationPermission = useCallback(async () => {
    if (!navigator.geolocation) {
      const errorMsg = 'Geolocation is not supported by this browser';
      setLocationState(prev => ({
        ...prev,
        error: errorMsg,
        isPermissionGranted: false
      }));
      return false;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, GEOLOCATION_OPTIONS);
      });

      const newLocation: UserLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now()
      };

      setUserLocation(newLocation);
      setLocationState(prev => ({
        ...prev,
        isPermissionGranted: true,
        isTracking: true,
        error: null,
        lastUpdate: new Date()
      }));

      console.log('✅ Location permission granted and location obtained:', {
        lat: newLocation.latitude.toFixed(6),
        lng: newLocation.longitude.toFixed(6),
        accuracy: newLocation.accuracy
      });

      return true;
    } catch (error) {
      const geolocationError = error as GeolocationPositionError;
      const errorMessage = handleGeolocationError(geolocationError);
      
      // Fallback to default location
      setUserLocation(DEFAULT_COORDS);
      setLocationState(prev => ({
        ...prev,
        isPermissionGranted: false,
        error: errorMessage,
        lastUpdate: new Date()
      }));
      
      console.log('📍 Using fallback location (San Francisco) due to:', errorMessage);
      return false;
    }
  }, [handleGeolocationError]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState(prev => ({
        ...prev,
        error: 'Geolocation not supported',
        isTracking: false
      }));
      return;
    }

    setLocationState(prev => ({ ...prev, isTracking: true }));
    
    // Start polling for location updates with retry logic
    const intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          };

          setUserLocation(newLocation);
          setLocationState(prev => ({
            ...prev,
            lastUpdate: new Date(),
            error: null
          }));
        },
        (error) => {
          const errorMessage = handleGeolocationError(error);
          console.warn('Location tracking error:', errorMessage);
          
          // Don't update state on every error to avoid excessive re-renders
          // Only update if this is a new type of error
          setLocationState(prev => {
            if (prev.error !== errorMessage) {
              return { ...prev, error: errorMessage };
            }
            return prev;
          });
        },
        TRACKING_OPTIONS
      );
    }, locationState.pollInterval);

    return () => clearInterval(intervalId);
  }, [locationState.pollInterval, handleGeolocationError]);

  const stopTracking = useCallback(() => {
    setLocationState(prev => ({ ...prev, isTracking: false }));
  }, []);

  // Auto-start tracking on mount with better error handling
  useEffect(() => {
    requestLocationPermission().catch((error) => {
      console.error('Failed to initialize location tracking:', error);
    });
  }, [requestLocationPermission]);

  return {
    userLocation,
    locationState,
    requestLocationPermission,
    startTracking,
    stopTracking,
    setUserLocation,
  };
};
