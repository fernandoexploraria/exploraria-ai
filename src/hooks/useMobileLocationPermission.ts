import { useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

const LOCATION_PERMISSION_KEY = 'location-permission-requested';

export const useMobileLocationPermission = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unknown'>('unknown');

  const isNative = Capacitor.isNativePlatform();

  const hasBeenRequested = () => {
    return localStorage.getItem(LOCATION_PERMISSION_KEY) === 'true';
  };

  const markAsRequested = () => {
    localStorage.setItem(LOCATION_PERMISSION_KEY, 'true');
  };

  const checkPermission = useCallback(async () => {
    if (!isNative) return 'unknown';
    
    try {
      const permissions = await Geolocation.checkPermissions();
      setPermissionStatus(permissions.location);
      return permissions.location;
    } catch (error) {
      console.error('Error checking location permission:', error);
      return 'unknown';
    }
  }, [isNative]);

  const requestPermission = useCallback(async () => {
    if (!isNative) return false;

    try {
      console.log('🔧 Requesting location permission...');
      const permissions = await Geolocation.requestPermissions();
      setPermissionStatus(permissions.location);
      markAsRequested();
      
      console.log('🔧 Location permission result:', permissions.location);
      return permissions.location === 'granted';
    } catch (error) {
      console.error('Error requesting location permission:', error);
      markAsRequested();
      return false;
    }
  }, [isNative]);

  const showPermissionDialog = useCallback(() => {
    if (!isNative || hasBeenRequested()) return;
    setIsDialogOpen(true);
  }, [isNative]);

  const handleAllowLocation = useCallback(async () => {
    setIsDialogOpen(false);
    await requestPermission();
  }, [requestPermission]);

  const handleNotNow = useCallback(() => {
    setIsDialogOpen(false);
    markAsRequested();
  }, []);

  return {
    isNative,
    isDialogOpen,
    permissionStatus,
    hasBeenRequested,
    showPermissionDialog,
    handleAllowLocation,
    handleNotNow,
    checkPermission,
    requestPermission,
  };
};