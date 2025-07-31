import { useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export type LocationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

interface UseNativeLocationPermissionReturn {
  permissionStatus: LocationPermissionStatus;
  isLoading: boolean;
  error: string | null;
  checkPermissionStatus: () => Promise<LocationPermissionStatus>;
  requestPermission: () => Promise<boolean>;
  getCurrentPosition: () => Promise<any | null>;
  isNativeApp: boolean;
}

export const useNativeLocationPermission = (): UseNativeLocationPermissionReturn => {
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>('unknown');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNativeApp = Capacitor.isNativePlatform();

  const checkPermissionStatus = useCallback(async (): Promise<LocationPermissionStatus> => {
    if (!isNativeApp) {
      // For web, we can't check permission status directly
      return 'prompt';
    }

    try {
      const permissions = await Geolocation.checkPermissions();
      const status = permissions.location as LocationPermissionStatus;
      setPermissionStatus(status);
      setError(null);
      return status;
    } catch (err) {
      console.error('Error checking location permissions:', err);
      setError('Failed to check permission status');
      return 'unknown';
    }
  }, [isNativeApp]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNativeApp) {
      // For web, we'll attempt to get position directly
      try {
        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
            enableHighAccuracy: false,
            maximumAge: 300000
          });
        });
        setPermissionStatus('granted');
        return true;
      } catch (err) {
        setPermissionStatus('denied');
        return false;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 Requesting location permissions...');
      const permissions = await Geolocation.requestPermissions();
      const status = permissions.location as LocationPermissionStatus;
      
      console.log('📍 Permission status:', status);
      setPermissionStatus(status);
      
      const granted = status === 'granted';
      if (!granted) {
        setError('Location permission was denied');
      }
      
      return granted;
    } catch (err) {
      console.error('Error requesting location permissions:', err);
      setError('Failed to request location permission');
      setPermissionStatus('denied');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isNativeApp]);

  const getCurrentPosition = useCallback(async (): Promise<any | null> => {
    if (!isNativeApp) {
      // For web, use browser geolocation
      try {
        return await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 15000,
            enableHighAccuracy: true,
            maximumAge: 60000
          });
        });
      } catch (err) {
        console.error('Web geolocation error:', err);
        setError('Failed to get current position');
        return null;
      }
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('📍 Getting current position...');
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });
      
      console.log('✅ Position obtained:', position.coords);
      return position;
    } catch (err) {
      console.error('Error getting current position:', err);
      setError('Failed to get current position');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isNativeApp]);

  return {
    permissionStatus,
    isLoading,
    error,
    checkPermissionStatus,
    requestPermission,
    getCurrentPosition,
    isNativeApp,
  };
};