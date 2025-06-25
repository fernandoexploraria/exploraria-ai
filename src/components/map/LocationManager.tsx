
import React, { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';

interface LocationManagerProps {
  map: mapboxgl.Map | null;
  user: any;
}

const LocationManager: React.FC<LocationManagerProps> = ({ map, user }) => {
  const geolocateControl = useRef<mapboxgl.GeolocateControl | null>(null);
  const isUpdatingFromProximitySettings = useRef<boolean>(false);
  const userInitiatedLocationRequest = useRef<boolean>(false);
  const lastLocationEventTime = useRef<number>(0);
  
  const { updateProximityEnabled, proximitySettings } = useProximityAlerts();

  useEffect(() => {
    if (!map || !user) return;

    console.log('🗺️ [LocationManager] Setting up location control');
    
    const geoControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 600000
      },
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: true,
      fitBoundsOptions: {
        maxZoom: 16
      }
    });
    
    geolocateControl.current = geoControl;
    
    // Monitor button clicks to detect user-initiated requests
    const controlElement = geoControl._container;
    if (controlElement) {
      controlElement.addEventListener('click', () => {
        userInitiatedLocationRequest.current = true;
        lastLocationEventTime.current = Date.now();
        console.log('🌍 [LocationManager] User-initiated location request');
      });
    }
    
    // Add comprehensive event listeners
    geoControl.on('geolocate', (e) => {
      console.log('🌍 [LocationManager] Location found', [e.coords.longitude, e.coords.latitude]);
      lastLocationEventTime.current = Date.now();
      
      if (!isUpdatingFromProximitySettings.current) {
        console.log('🌍 [LocationManager] Enabling proximity (user initiated location)');
        updateProximityEnabled(true);
      }
    });
    
    geoControl.on('trackuserlocationstart', () => {
      console.log('🌍 [LocationManager] Started tracking user location');
      lastLocationEventTime.current = Date.now();
      
      if (!isUpdatingFromProximitySettings.current) {
        console.log('🌍 [LocationManager] Enabling proximity (tracking started)');
        updateProximityEnabled(true);
      }
    });
    
    geoControl.on('trackuserlocationend', () => {
      console.log('🌍 [LocationManager] Stopped tracking user location');
      if (!isUpdatingFromProximitySettings.current) {
        console.log('🌍 [LocationManager] Disabling proximity (tracking ended)');
        updateProximityEnabled(false);
      }
    });
    
    geoControl.on('error', (e) => {
      console.error('🌍 [LocationManager] Error occurred', e);
      userInitiatedLocationRequest.current = false;
      if (!isUpdatingFromProximitySettings.current) {
        console.log('🌍 [LocationManager] Disabling proximity (error occurred)');
        updateProximityEnabled(false);
      }
    });

    return () => {
      geolocateControl.current = null;
    };
  }, [map, user, updateProximityEnabled]);

  // Effect to handle proximity settings changes
  useEffect(() => {
    if (!geolocateControl.current || !proximitySettings) {
      return;
    }

    console.log('🔄 [LocationManager] Proximity settings changed:', proximitySettings);
    
    const timeSinceLastLocationEvent = Date.now() - lastLocationEventTime.current;
    const isRecentLocationEvent = timeSinceLastLocationEvent < 2000;
    
    if (userInitiatedLocationRequest.current && isRecentLocationEvent) {
      console.log('🔄 [LocationManager] Skipping proximity sync - recent user-initiated request');
      setTimeout(() => {
        userInitiatedLocationRequest.current = false;
      }, 3000);
      return;
    }
    
    isUpdatingFromProximitySettings.current = true;
    
    try {
      const currentWatchState = (geolocateControl.current as any)._watchState;
      const isCurrentlyTracking = currentWatchState === 'ACTIVE_LOCK';
      const shouldBeTracking = proximitySettings.is_enabled;
      
      setTimeout(() => {
        try {
          const finalWatchState = (geolocateControl.current as any)._watchState;
          const finalIsTracking = finalWatchState === 'ACTIVE_LOCK';
          
          if (shouldBeTracking && !finalIsTracking) {
            console.log('🔄 [LocationManager] Starting tracking (proximity enabled)');
            geolocateControl.current?.trigger();
          } else if (!shouldBeTracking && finalIsTracking) {
            console.log('🔄 [LocationManager] Stopping tracking (proximity disabled)');
            geolocateControl.current?.trigger();
          }
        } catch (error) {
          console.error('🔄 [LocationManager] Error during delayed sync:', error);
        } finally {
          isUpdatingFromProximitySettings.current = false;
        }
      }, isRecentLocationEvent ? 1000 : 200);
      
    } catch (error) {
      console.error('🔄 [LocationManager] Error syncing proximity settings:', error);
      isUpdatingFromProximitySettings.current = false;
    }
  }, [proximitySettings?.is_enabled]);

  return null;
};

export default LocationManager;
