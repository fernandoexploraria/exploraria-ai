
import { useState, useEffect, useRef, useCallback } from 'react';
import { UserLocation } from '@/types/proximityAlerts';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';

interface LocationTrackingState {
  isTracking: boolean;
  error: string | null;
  lastUpdate: Date | null;
  pollInterval: number; // current polling interval in ms
}

interface LocationTrackingHook {
  locationState: LocationTrackingState;
  userLocation: UserLocation | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  requestCurrentLocation: () => Promise<UserLocation | null>;
}

export const useLocationTracking = (): LocationTrackingHook => {
  const { proximitySettings, setUserLocation } = useProximityAlerts();
  
  const [locationState, setLocationState] = useState<LocationTrackingState>({
    isTracking: false,
    error: null,
    lastUpdate: null,
    pollInterval: 5000, // 5 seconds for testing
  });
  
  const [userLocation, setCurrentUserLocation] = useState<UserLocation | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef<number>(0);

  // Handle location update
  const handleLocationUpdate = useCallback((position: GeolocationPosition) => {
    const newLocation: UserLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: Date.now(),
    };

    pollCountRef.current += 1;
    console.log(`📍 Location poll #${pollCountRef.current} updated:`, {
      lat: newLocation.latitude.toFixed(6),
      lng: newLocation.longitude.toFixed(6),
      accuracy: newLocation.accuracy ? `${Math.round(newLocation.accuracy)}m` : 'unknown',
      time: new Date().toLocaleTimeString()
    });

    setCurrentUserLocation(newLocation);
    setUserLocation(newLocation);
    
    setLocationState(prev => ({
      ...prev,
      lastUpdate: new Date(),
      error: null,
    }));
  }, [setUserLocation]);

  // Handle location error
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
    
    console.error(`❌ Location poll #${pollCountRef.current + 1} error:`, errorMessage);
    
    setLocationState(prev => ({
      ...prev,
      error: errorMessage,
    }));
  }, []);

  // Request current location (one-time)
  const requestCurrentLocation = useCallback(async (): Promise<UserLocation | null> => {
    console.log('📱 Requesting current location...');
    
    if (!navigator.geolocation) {
      console.error('❌ Geolocation not supported');
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ Current location obtained');
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
          console.error('❌ Failed to get current location:', error);
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
  }, [handleLocationUpdate, handleLocationError]);

  // Location polling function
  const pollLocation = useCallback(() => {
    const pollNumber = pollCountRef.current + 1;
    console.log(`🔄 Starting location poll #${pollNumber} at ${new Date().toLocaleTimeString()}`);
    
    navigator.geolocation.getCurrentPosition(
      handleLocationUpdate,
      handleLocationError,
      {
        enableHighAccuracy: false, // Faster response for testing
        timeout: 8000, // 8 second timeout
        maximumAge: 0, // Always get fresh location data
      }
    );
  }, [handleLocationUpdate, handleLocationError]);

  // Start continuous tracking with interval-based polling
  const startTracking = useCallback(async (): Promise<void> => {
    console.log(`🚀 Starting location tracking with ${locationState.pollInterval}ms polling interval...`);
    
    if (!navigator.geolocation) {
      console.error('❌ Geolocation not supported');
      return;
    }

    // Reset poll counter
    pollCountRef.current = 0;

    // Check permission first
    try {
      await requestCurrentLocation();
    } catch (error) {
      console.error('❌ Permission check failed:', error);
      return;
    }

    setLocationState(prev => ({
      ...prev,
      isTracking: true,
      error: null,
    }));

    // Start interval-based polling
    pollIntervalRef.current = setInterval(pollLocation, locationState.pollInterval);

    console.log(`✅ Location tracking started with ${locationState.pollInterval}ms interval`);
  }, [locationState.pollInterval, requestCurrentLocation, pollLocation]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    console.log('🛑 Stopping location tracking...');
    
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Reset poll counter
    pollCountRef.current = 0;

    setLocationState(prev => ({
      ...prev,
      isTracking: false,
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
  };
};
