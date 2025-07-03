
import { useEffect, useState, useCallback } from 'react';
import { UserLocation, LocationTrackingState } from '@/types/proximityAlerts';

const DEFAULT_COORDS = {
  latitude: 37.7749,
  longitude: -122.4194, // San Francisco
  accuracy: undefined,
  timestamp: Date.now()
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

  const requestLocationPermission = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by this browser',
        isPermissionGranted: false
      }));
      return false;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
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

      return true;
    } catch (error) {
      console.error('Location permission denied or error:', error);
      
      // Fallback to default location
      setUserLocation(DEFAULT_COORDS);
      setLocationState(prev => ({
        ...prev,
        isPermissionGranted: false,
        error: 'Location access denied. Using default location.',
        lastUpdate: new Date()
      }));
      
      return false;
    }
  }, []);

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
    
    // Start polling for location updates
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
          console.error('Location tracking error:', error);
          setLocationState(prev => ({
            ...prev,
            error: error.message
          }));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );
    }, locationState.pollInterval);

    return () => clearInterval(intervalId);
  }, [locationState.pollInterval]);

  const stopTracking = useCallback(() => {
    setLocationState(prev => ({ ...prev, isTracking: false }));
  }, []);

  // Auto-start tracking on mount
  useEffect(() => {
    requestLocationPermission();
  }, [requestLocationPermission]);

  return {
    userLocation,
    locationState,
    requestLocationPermission,
    startTracking,
    stopTracking,
    setUserLocation // Add this function that was being called
  };
};
