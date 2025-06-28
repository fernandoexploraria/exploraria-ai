
import { useState, useEffect, useRef, useCallback } from 'react';
import { UserLocation } from '@/types/proximityAlerts';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useBasicLocationTracking } from '@/hooks/useBasicLocationTracking';
import { useBasicNearbyLandmarks } from '@/hooks/useBasicNearbyLandmarks';
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

interface EnhancedLocationState {
  isEnhancedMode: boolean;
  movementState: MovementState;
  consecutiveFailures: number;
  isInBackground: boolean;
  adaptiveInterval: number;
}

interface LocationTrackingHook {
  locationState: any; // Keep compatible with existing interface
  userLocation: UserLocation | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  requestCurrentLocation: () => Promise<UserLocation | null>;
  forceLocationUpdate: () => Promise<void>;
}

const ENHANCED_POLLING_INTERVAL = 15000; // 15 seconds for enhanced mode
const MAX_LOCATION_HISTORY = 10;
const LOCATION_CHANGE_THRESHOLD = 20; // meters

export const useLocationTracking = (): LocationTrackingHook => {
  // Use basic location tracking as foundation
  const basicLocationTracking = useBasicLocationTracking();
  const { proximitySettings, setUserLocation } = useProximityAlerts();
  
  const [enhancedState, setEnhancedState] = useState<EnhancedLocationState>({
    isEnhancedMode: false,
    movementState: {
      isMoving: false,
      lastMovementTime: Date.now(),
      stationaryDuration: 0,
      averageSpeed: 0
    },
    consecutiveFailures: 0,
    isInBackground: false,
    adaptiveInterval: ENHANCED_POLLING_INTERVAL
  });

  const locationHistoryRef = useRef<LocationHistory[]>([]);
  const lastSignificantLocationRef = useRef<UserLocation | null>(null);
  const enhancedPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get basic nearby landmarks (always available)
  const basicNearbyLandmarks = useBasicNearbyLandmarks({
    userLocation: basicLocationTracking.userLocation,
    searchRadius: 1000
  });

  // Enhanced Street View pre-loading
  const { preloadForProximity } = useEnhancedStreetViewMulti();
  const lastPreloadLocationRef = useRef<UserLocation | null>(null);
  const PRELOAD_DISTANCE_THRESHOLD = 200;

  // Monitor page visibility for background/foreground detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isInBackground = document.hidden;
      setEnhancedState(prev => ({ ...prev, isInBackground }));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Enhanced location processing when proximity is enabled
  const processEnhancedLocation = useCallback((location: UserLocation) => {
    if (!enhancedState.isEnhancedMode) return;

    const newLocationHistory: LocationHistory = {
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: location.timestamp,
      accuracy: location.accuracy
    };

    // Check if this is a significant location change
    const lastSignificant = lastSignificantLocationRef.current;
    const isSignificant = !lastSignificant || 
      isSignificantLocationChange(lastSignificant, newLocationHistory, LOCATION_CHANGE_THRESHOLD);

    if (isSignificant) {
      // Update location history
      locationHistoryRef.current.push(newLocationHistory);
      if (locationHistoryRef.current.length > MAX_LOCATION_HISTORY) {
        locationHistoryRef.current.shift();
      }

      // Detect movement
      const movementState = detectMovement(locationHistoryRef.current.slice(0, -1), newLocationHistory);
      
      setEnhancedState(prev => ({
        ...prev,
        movementState,
        consecutiveFailures: 0
      }));

      lastSignificantLocationRef.current = location;

      // Enhanced Street View pre-loading
      const shouldPreloadStreetView = () => {
        if (!lastPreloadLocationRef.current) return true;
        
        const distanceFromLastPreload = calculateDistance(
          lastPreloadLocationRef.current.latitude,
          lastPreloadLocationRef.current.longitude,
          location.latitude,
          location.longitude
        );
        
        return distanceFromLastPreload >= PRELOAD_DISTANCE_THRESHOLD;
      };

      if (basicNearbyLandmarks.length > 0 && shouldPreloadStreetView()) {
        console.log(`🔄 Enhanced Street View pre-loading for ${basicNearbyLandmarks.length} nearby landmarks`);
        
        const landmarksToPreload = basicNearbyLandmarks.map(nearbyLandmark => nearbyLandmark.landmark);
        
        preloadForProximity(landmarksToPreload, {
          latitude: location.latitude,
          longitude: location.longitude
        }).catch(error => {
          console.warn('⚠️ Enhanced Street View pre-loading failed:', error);
        });
        
        lastPreloadLocationRef.current = location;
      }
    }
  }, [enhancedState.isEnhancedMode, basicNearbyLandmarks, preloadForProximity]);

  // Sync basic location to proximity alerts when available
  useEffect(() => {
    if (basicLocationTracking.userLocation && setUserLocation) {
      setUserLocation(basicLocationTracking.userLocation);
      processEnhancedLocation(basicLocationTracking.userLocation);
    }
  }, [basicLocationTracking.userLocation, setUserLocation, processEnhancedLocation]);

  // Enable enhanced mode when proximity settings are available and enabled
  useEffect(() => {
    const shouldEnableEnhanced = proximitySettings?.is_enabled === true;
    
    if (shouldEnableEnhanced !== enhancedState.isEnhancedMode) {
      console.log(`🔄 ${shouldEnableEnhanced ? 'Enabling' : 'Disabling'} enhanced location mode`);
      setEnhancedState(prev => ({
        ...prev,
        isEnhancedMode: shouldEnableEnhanced
      }));

      if (shouldEnableEnhanced) {
        // Reset enhanced state when enabling
        locationHistoryRef.current = [];
        lastSignificantLocationRef.current = null;
      }
    }
  }, [proximitySettings?.is_enabled, enhancedState.isEnhancedMode]);

  // Create compatible interface
  const compatibleLocationState = {
    isTracking: basicLocationTracking.locationState.isTracking,
    error: basicLocationTracking.locationState.error,
    lastUpdate: basicLocationTracking.locationState.lastUpdate,
    pollInterval: enhancedState.adaptiveInterval,
    movementState: enhancedState.movementState,
    consecutiveFailures: enhancedState.consecutiveFailures,
    isInBackground: enhancedState.isInBackground
  };

  // Force location update wrapper that returns Promise<void>
  const forceLocationUpdate = async (): Promise<void> => {
    await basicLocationTracking.requestCurrentLocation();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (enhancedPollIntervalRef.current) {
        clearTimeout(enhancedPollIntervalRef.current);
      }
    };
  }, []);

  return {
    locationState: compatibleLocationState,
    userLocation: basicLocationTracking.userLocation,
    startTracking: basicLocationTracking.startTracking,
    stopTracking: basicLocationTracking.stopTracking,
    requestCurrentLocation: basicLocationTracking.requestCurrentLocation,
    forceLocationUpdate,
  };
};
