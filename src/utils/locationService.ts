import { Capacitor } from '@capacitor/core';
import { Geolocation as CapacitorGeolocation } from '@capacitor/geolocation';

const isNative = Capacitor.isNativePlatform();

export interface LocationServicePosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp: number;
}

export interface LocationServicePermissionStatus {
  location: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';
}

/**
 * Platform-agnostic location service that uses Capacitor on mobile and native web APIs on web
 */
export const LocationService = {
  /**
   * Check if running on native platform
   */
  isNative: () => isNative,

  /**
   * Request location permissions
   * On web: Returns granted (web handles permissions automatically)
   * On mobile: Uses Capacitor's permission system
   */
  async requestPermissions(): Promise<LocationServicePermissionStatus> {
    if (isNative) {
      try {
        const result = await CapacitorGeolocation.requestPermissions();
        return { location: result.location };
      } catch (error) {
        console.error('Error requesting location permissions:', error);
        return { location: 'denied' };
      }
    }
    
    // Web version - permissions are handled automatically by browser
    return { location: 'granted' };
  },

  /**
   * Check current permission status
   */
  async checkPermissions(): Promise<LocationServicePermissionStatus> {
    if (isNative) {
      try {
        const result = await CapacitorGeolocation.checkPermissions();
        return { location: result.location };
      } catch (error) {
        console.error('Error checking location permissions:', error);
        return { location: 'denied' };
      }
    }

    // Web version - check if geolocation is available
    if ('geolocation' in navigator) {
      return { location: 'granted' };
    }
    return { location: 'denied' };
  },

  /**
   * Get current position
   * On web: Uses navigator.geolocation (existing behavior)
   * On mobile: Uses Capacitor's geolocation
   */
  async getCurrentPosition(options?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }): Promise<LocationServicePosition> {
    if (isNative) {
      try {
        const position = await CapacitorGeolocation.getCurrentPosition({
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 10000,
          maximumAge: options?.maximumAge ?? 60000,
        });
        
        return {
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          },
          timestamp: position.timestamp,
        };
      } catch (error) {
        throw new Error(`Failed to get location: ${error}`);
      }
    }

    // Web version - use existing navigator.geolocation behavior
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
            },
            timestamp: position.timestamp,
          });
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 10000,
          maximumAge: options?.maximumAge ?? 60000,
        }
      );
    });
  },

  /**
   * Watch position changes
   * Returns a watch ID that can be used to clear the watch
   */
  watchPosition(
    callback: (position: LocationServicePosition) => void,
    errorCallback?: (error: Error) => void,
    options?: {
      enableHighAccuracy?: boolean;
      timeout?: number;
      maximumAge?: number;
    }
  ): string {
    if (isNative) {
      // For Capacitor, we'll use periodic getCurrentPosition calls
      // since watchPosition is less reliable on native platforms
      const watchId = `capacitor_watch_${Date.now()}`;
      const interval = setInterval(async () => {
        try {
          const position = await this.getCurrentPosition(options);
          callback(position);
        } catch (error) {
          if (errorCallback) {
            errorCallback(error as Error);
          }
        }
      }, 5000); // Update every 5 seconds

      // Store the interval for cleanup
      (globalThis as any).__locationWatchers = (globalThis as any).__locationWatchers || {};
      (globalThis as any).__locationWatchers[watchId] = interval;
      
      return watchId;
    }

    // Web version - use native watchPosition
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        callback({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          },
          timestamp: position.timestamp,
        });
      },
      (error) => {
        if (errorCallback) {
          errorCallback(new Error(`Geolocation error: ${error.message}`));
        }
      },
      {
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: options?.timeout ?? 10000,
        maximumAge: options?.maximumAge ?? 60000,
      }
    );

    return watchId.toString();
  },

  /**
   * Clear position watch
   */
  clearWatch(watchId: string): void {
    if (isNative) {
      const watchers = (globalThis as any).__locationWatchers;
      if (watchers && watchers[watchId]) {
        clearInterval(watchers[watchId]);
        delete watchers[watchId];
      }
      return;
    }

    // Web version
    navigator.geolocation.clearWatch(parseInt(watchId));
  },
};