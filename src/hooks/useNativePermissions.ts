import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface NativePermissionState {
  location: 'granted' | 'denied' | 'prompt' | 'unavailable';
  orientation: 'granted' | 'denied' | 'prompt' | 'unavailable';
  isLoading: boolean;
  hasCheckedInitially: boolean;
}

interface NativePermissionsHook {
  permissionState: NativePermissionState;
  requestLocationPermission: () => Promise<boolean>;
  requestOrientationPermission: () => Promise<boolean>;
  requestAllPermissions: () => Promise<{ location: boolean; orientation: boolean }>;
  checkPermissions: () => Promise<void>;
  isNativeApp: boolean;
}

export const useNativePermissions = (): NativePermissionsHook => {
  const [permissionState, setPermissionState] = useState<NativePermissionState>({
    location: 'prompt',
    orientation: 'prompt',
    isLoading: false,
    hasCheckedInitially: false,
  });

  const isNativeApp = Capacitor.isNativePlatform();

  const checkPermissions = useCallback(async () => {
    if (!isNativeApp) {
      setPermissionState(prev => ({
        ...prev,
        location: 'unavailable',
        orientation: 'unavailable',
        hasCheckedInitially: true,
      }));
      return;
    }

    setPermissionState(prev => ({ ...prev, isLoading: true }));

    try {
      // Check location permission
      let locationStatus: 'granted' | 'denied' | 'prompt' | 'unavailable' = 'prompt';
      try {
        const locationPermission = await Geolocation.checkPermissions();
        locationStatus = locationPermission.location === 'granted' ? 'granted' :
                        locationPermission.location === 'denied' ? 'denied' : 'prompt';
      } catch (error) {
        console.log('Location permission check failed:', error);
        locationStatus = 'unavailable';
      }

      // Check device motion permission (orientation)
      let orientationStatus: 'granted' | 'denied' | 'prompt' | 'unavailable' = 'prompt';
      try {
        // For iOS 13+, we need to request permission for device motion
        if (Capacitor.getPlatform() === 'ios') {
          // Check if DeviceOrientationEvent is available and requires permission
          if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
            // iOS 13+ requires explicit permission
            orientationStatus = 'prompt';
          } else {
            // Older iOS or permission already granted
            orientationStatus = 'granted';
          }
        } else {
          // Android typically doesn't require explicit permission for device motion
          orientationStatus = 'granted';
        }
      } catch (error) {
        console.log('Orientation permission check failed:', error);
        // If we can't check, assume it needs permission
        orientationStatus = 'prompt';
      }

      setPermissionState(prev => ({
        ...prev,
        location: locationStatus,
        orientation: orientationStatus,
        isLoading: false,
        hasCheckedInitially: true,
      }));
    } catch (error) {
      console.error('Error checking native permissions:', error);
      setPermissionState(prev => ({
        ...prev,
        location: 'unavailable',
        orientation: 'unavailable',
        isLoading: false,
        hasCheckedInitially: true,
      }));
    }
  }, [isNativeApp]);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (!isNativeApp) return false;

    try {
      setPermissionState(prev => ({ ...prev, isLoading: true }));
      
      const permission = await Geolocation.requestPermissions();
      const granted = permission.location === 'granted';
      
      setPermissionState(prev => ({
        ...prev,
        location: granted ? 'granted' : 'denied',
        isLoading: false,
      }));

      return granted;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setPermissionState(prev => ({
        ...prev,
        location: 'denied',
        isLoading: false,
      }));
      return false;
    }
  }, [isNativeApp]);

  const requestOrientationPermission = useCallback(async (): Promise<boolean> => {
    if (!isNativeApp) return false;

    try {
      setPermissionState(prev => ({ ...prev, isLoading: true }));

      if (Capacitor.getPlatform() === 'ios') {
        // For iOS 13+, we need to request device motion permission
        try {
          if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
            const permission = await (DeviceOrientationEvent as any).requestPermission();
            const granted = permission === 'granted';
            
            setPermissionState(prev => ({
              ...prev,
              orientation: granted ? 'granted' : 'denied',
              isLoading: false,
            }));
            return granted;
          } else {
            // Older iOS or permission not required
            setPermissionState(prev => ({
              ...prev,
              orientation: 'granted',
              isLoading: false,
            }));
            return true;
          }
        } catch (error) {
          console.log('Device motion permission denied or unavailable:', error);
          setPermissionState(prev => ({
            ...prev,
            orientation: 'denied',
            isLoading: false,
          }));
          return false;
        }
      } else {
        // Android typically doesn't require explicit permission
        setPermissionState(prev => ({
          ...prev,
          orientation: 'granted',
          isLoading: false,
        }));
        return true;
      }
    } catch (error) {
      console.error('Error requesting orientation permission:', error);
      setPermissionState(prev => ({
        ...prev,
        orientation: 'denied',
        isLoading: false,
      }));
      return false;
    }
  }, [isNativeApp]);

  const requestAllPermissions = useCallback(async () => {
    const results = {
      location: false,
      orientation: false,
    };

    // Request location first
    results.location = await requestLocationPermission();
    
    // Request orientation regardless of location result
    results.orientation = await requestOrientationPermission();

    return results;
  }, [requestLocationPermission, requestOrientationPermission]);

  // Check permissions on mount for native apps
  useEffect(() => {
    if (isNativeApp) {
      checkPermissions();
    }
  }, [checkPermissions, isNativeApp]);

  return {
    permissionState,
    requestLocationPermission,
    requestOrientationPermission,
    requestAllPermissions,
    checkPermissions,
    isNativeApp,
  };
};