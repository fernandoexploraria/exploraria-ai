
import { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from '@/utils/proximityUtils';

export interface PermissionState {
  state: 'granted' | 'denied' | 'prompt' | 'unknown';
  isMonitoring: boolean;
  lastChecked: Date | null;
  hasPermissionAPI: boolean;
}

interface PermissionMonitorHook {
  permissionState: PermissionState;
  checkPermission: () => Promise<'granted' | 'denied' | 'prompt' | 'unknown'>;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  requestPermission: () => Promise<boolean>;
}

const PERMISSION_CHECK_INTERVAL = 30000; // 30 seconds
const PERMISSION_CACHE_DURATION = 10000; // 10 seconds

export const usePermissionMonitor = (): PermissionMonitorHook => {
  const [permissionState, setPermissionState] = useState<PermissionState>({
    state: 'prompt',
    isMonitoring: false,
    lastChecked: null,
    hasPermissionAPI: 'permissions' in navigator,
  });

  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cacheRef = useRef<{ state: string; timestamp: number } | null>(null);
  const retryCountRef = useRef<number>(0);

  const checkPermission = useCallback(async (): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> => {
    // Check cache first
    const now = Date.now();
    if (cacheRef.current && (now - cacheRef.current.timestamp) < PERMISSION_CACHE_DURATION) {
      console.log('Using cached permission state:', cacheRef.current.state);
      return cacheRef.current.state as 'granted' | 'denied' | 'prompt' | 'unknown';
    }

    if (!navigator.geolocation) {
      console.log('Geolocation not supported, setting to denied');
      const result = 'denied';
      cacheRef.current = { state: result, timestamp: now };
      return result;
    }

    try {
      if ('permissions' in navigator) {
        console.log('Checking permission via Permissions API...');
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        const result = permission.state as 'granted' | 'denied' | 'prompt';
        console.log('Permission API result:', result);
        cacheRef.current = { state: result, timestamp: now };
        retryCountRef.current = 0;
        return result;
      }
      
      // Fallback: try to get position with optimized settings for permission check
      console.log('Using geolocation fallback to check permission...');
      return new Promise((resolve) => {
        const timeoutDuration = 8000; // Shorter timeout for permission checks
        
        navigator.geolocation.getCurrentPosition(
          () => {
            console.log('Geolocation permission granted via fallback');
            const result = 'granted';
            cacheRef.current = { state: result, timestamp: now };
            retryCountRef.current = 0;
            resolve(result);
          },
          (error) => {
            console.log('Geolocation error in permission check:', error.message, 'Code:', error.code);
            let result: 'granted' | 'denied' | 'prompt' | 'unknown';
            
            if (error.code === error.PERMISSION_DENIED) {
              result = 'denied';
            } else if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
              retryCountRef.current++;
              result = retryCountRef.current > 2 ? 'unknown' : 'prompt';
              console.log(`Setting to ${result} after ${retryCountRef.current} retries for error code ${error.code}`);
            } else {
              result = retryCountRef.current > 2 ? 'unknown' : 'prompt';
              retryCountRef.current++;
            }
            
            cacheRef.current = { state: result, timestamp: now };
            resolve(result);
          },
          { 
            timeout: timeoutDuration,
            enableHighAccuracy: false, // Don't require high accuracy for permission check
            maximumAge: 300000 // Allow 5-minute old location for permission check
          }
        );
      });
    } catch (error) {
      console.error('Error checking permission:', error);
      retryCountRef.current++;
      const result = retryCountRef.current > 2 ? 'unknown' : 'prompt';
      cacheRef.current = { state: result, timestamp: now };
      return result;
    }
  }, []);

  const updatePermissionState = useCallback(async () => {
    const state = await checkPermission();
    setPermissionState(prev => ({
      ...prev,
      state,
      lastChecked: new Date(),
    }));
  }, [checkPermission]);

  const debouncedUpdatePermissionState = useCallback(
    debounce(updatePermissionState, 1000),
    [updatePermissionState]
  );

  const startMonitoring = useCallback(() => {
    if (monitorIntervalRef.current) return;

    console.log('Starting permission monitoring');
    setPermissionState(prev => ({ ...prev, isMonitoring: true }));
    
    // Initial check
    updatePermissionState();
    
    // Set up periodic checks
    monitorIntervalRef.current = setInterval(() => {
      debouncedUpdatePermissionState();
    }, PERMISSION_CHECK_INTERVAL);
  }, [updatePermissionState, debouncedUpdatePermissionState]);

  const stopMonitoring = useCallback(() => {
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }

    setPermissionState(prev => ({ ...prev, isMonitoring: false }));
    console.log('Stopped permission monitoring');
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser');
      return false;
    }

    try {
      console.log('Requesting location permission...');
      
      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          console.log('Permission request timed out');
          resolve(false);
        }, 15000);

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            console.log('Permission granted successfully');
            
            // Clear cache to force fresh check
            cacheRef.current = null;
            retryCountRef.current = 0;
            updatePermissionState();
            
            resolve(true);
          },
          (error) => {
            clearTimeout(timeoutId);
            console.log('Permission request failed:', error.message);
            
            // Clear cache to force fresh check
            cacheRef.current = null;
            updatePermissionState();
            
            resolve(error.code !== error.PERMISSION_DENIED);
          },
          { 
            timeout: 12000,
            enableHighAccuracy: false, // Don't require high accuracy for permission request
            maximumAge: 300000 // Allow 5-minute old location for permission request
          }
        );
      });
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  }, [updatePermissionState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    permissionState,
    checkPermission,
    startMonitoring,
    stopMonitoring,
    requestPermission,
  };
};
