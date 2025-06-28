
import { useState, useEffect, useRef, useCallback } from 'react';
import { UserLocation } from '@/types/proximityAlerts';

interface BasicLocationState {
  isTracking: boolean;
  error: string | null;
  lastUpdate: Date | null;
  hasPermission: boolean | null;
}

interface BasicLocationTrackingHook {
  locationState: BasicLocationState;
  userLocation: UserLocation | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  requestCurrentLocation: () => Promise<UserLocation | null>;
}

const BASIC_POLLING_INTERVAL = 30000; // 30 seconds

export const useBasicLocationTracking = (): BasicLocationTrackingHook => {
  const [locationState, setLocationState] = useState<BasicLocationState>({
    isTracking: false,
    error: null,
    lastUpdate: null,
    hasPermission: null
  });
  
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle location update
  const handleLocationUpdate = useCallback((position: GeolocationPosition) => {
    const newLocation: UserLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: Date.now(),
    };

    console.log('📍 Basic location updated:', {
      lat: newLocation.latitude.toFixed(6),
      lng: newLocation.longitude.toFixed(6),
      accuracy: newLocation.accuracy ? `${Math.round(newLocation.accuracy)}m` : 'unknown'
    });

    setUserLocation(newLocation);
    setLocationState(prev => ({
      ...prev,
      lastUpdate: new Date(),
      error: null,
      hasPermission: true
    }));
  }, []);

  // Handle location error
  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Location access failed';
    let hasPermission = locationState.hasPermission;
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied';
        hasPermission = false;
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out';
        break;
    }
    
    console.error('❌ Basic location error:', errorMessage);
    
    setLocationState(prev => ({
      ...prev,
      error: errorMessage,
      hasPermission
    }));
  }, [locationState.hasPermission]);

  // Request current location (one-time)
  const requestCurrentLocation = useCallback(async (): Promise<UserLocation | null> => {
    console.log('📱 Requesting basic location...');
    
    if (!navigator.geolocation) {
      console.error('❌ Geolocation not supported');
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ Basic location obtained');
          handleLocationUpdate(position);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          });
        },
        (error) => {
          console.error('❌ Failed to get basic location:', error);
          handleLocationError(error);
          resolve(null);
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000
        }
      );
    });
  }, [handleLocationUpdate, handleLocationError]);

  // Location polling function
  const requestLocationUpdate = useCallback(() => {
    console.log('🔄 Basic location poll');
    
    navigator.geolocation.getCurrentPosition(
      handleLocationUpdate,
      handleLocationError,
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 30000
      }
    );

    // Schedule next poll
    if (pollIntervalRef.current) {
      clearTimeout(pollIntervalRef.current);
    }
    pollIntervalRef.current = setTimeout(requestLocationUpdate, BASIC_POLLING_INTERVAL);
  }, [handleLocationUpdate, handleLocationError]);

  // Start basic tracking
  const startTracking = useCallback(async (): Promise<void> => {
    console.log('🚀 Starting basic location tracking...');
    
    if (!navigator.geolocation) {
      console.error('❌ Geolocation not supported');
      return;
    }

    // Get initial location
    try {
      await requestCurrentLocation();
    } catch (error) {
      console.error('❌ Initial basic location request failed:', error);
      return;
    }

    setLocationState(prev => ({
      ...prev,
      isTracking: true,
      error: null
    }));

    // Start polling
    pollIntervalRef.current = setTimeout(requestLocationUpdate, BASIC_POLLING_INTERVAL);

    console.log('✅ Basic location tracking started');
  }, [requestCurrentLocation, requestLocationUpdate]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    console.log('🛑 Stopping basic location tracking...');
    
    if (pollIntervalRef.current !== null) {
      clearTimeout(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    setLocationState(prev => ({
      ...prev,
      isTracking: false
    }));

    console.log('✅ Basic location tracking stopped');
  }, []);

  // Auto-start tracking on mount
  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, [startTracking, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
      }
    };
  }, []);

  return {
    locationState,
    userLocation,
    startTracking,
    stopTracking,
    requestCurrentLocation,
  };
};
