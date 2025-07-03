
import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAuth } from '@/components/AuthProvider';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { GeolocateControl } from 'mapbox-gl';
import { Tour } from '@/types/tour';
import { calculateDistance } from '@/utils/locationUtils';
import { geolocateControlDebouncer } from '@/utils/geolocateControlDebouncer';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface MapProps {
  tours?: Tour[];
}

const Map: React.FC<MapProps> = ({ tours = [] }) => {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const geolocateControlRef = useRef<GeolocateControl | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const { proximitySettings } = useProximityAlerts();
  const { updateProximityEnabled: hookUpdateProximityEnabled } = useProximityAlerts();
  const { user } = useAuth();

  // Enhanced updateProximityEnabled with multi-source flag support
  const updateProximityEnabled = useCallback(async (enabled: boolean, source: string = 'Manual') => {
    // Set appropriate flags based on source
    if (source.includes('User') || source === 'Manual') {
      geolocateControlDebouncer.setUpdateFlag('isUpdatingFromUserAction', 2000);
    }
    
    console.log('🗺️ [Map] updateProximityEnabled called:', { 
      enabled, 
      source,
      activeFlags: geolocateControlDebouncer.getActiveFlags()
    });
    
    // Call the hook's updateProximityEnabled with source tracking
    await hookUpdateProximityEnabled(enabled, source);
  }, [hookUpdateProximityEnabled]);

  // Enhanced GeolocateControl event handlers with debouncing
  const handleGeolocateControlEvents = useCallback(() => {
    if (!geolocateControlRef.current || !mapRef.current) return;

    const control = geolocateControlRef.current;
    
    // Enhanced geolocate event (location found)
    const handleGeolocate = (e: any) => {
      console.log('🗺️ [Map] Geolocate event fired:', {
        accuracy: e.coords?.accuracy,
        timestamp: e.timestamp,
        controlState: (control as any)._watchState
      });
      
      geolocateControlDebouncer.debounceGeolocateEvent(
        'geolocate',
        true,
        async (enabled) => {
          console.log('🗺️ [Map] Executing geolocate proximity update:', enabled);
          await updateProximityEnabled(enabled, 'GeolocateControl-Geolocate');
        },
        (control as any)._watchState
      );
    };

    // Enhanced trackuserlocationstart event
    const handleTrackUserLocationStart = () => {
      console.log('🗺️ [Map] Track user location start:', {
        controlState: (control as any)._watchState,
        isSupported: (control as any)._supportsGeolocation
      });
      
      geolocateControlDebouncer.debounceGeolocateEvent(
        'trackuserlocationstart',
        true,
        async (enabled) => {
          console.log('🗺️ [Map] Executing trackstart proximity update:', enabled);
          await updateProximityEnabled(enabled, 'GeolocateControl-TrackStart');
        },
        (control as any)._watchState
      );
    };

    // Enhanced trackuserlocationend event
    const handleTrackUserLocationEnd = () => {
      console.log('🗺️ [Map] Track user location end:', {
        controlState: (control as any)._watchState,
        lastKnownPosition: (control as any)._lastKnownPosition
      });
      
      geolocateControlDebouncer.debounceGeolocateEvent(
        'trackuserlocationend',
        false,
        async (enabled) => {
          console.log('🗺️ [Map] Executing trackend proximity update:', enabled);
          await updateProximityEnabled(enabled, 'GeolocateControl-TrackEnd');
        },
        (control as any)._watchState
      );
    };

    // Enhanced error event handler
    const handleGeolocateError = (error: any) => {
      console.log('🗺️ [Map] Geolocate error:', {
        code: error.code,
        message: error.message,
        controlState: (control as any)._watchState
      });
      
      geolocateControlDebouncer.debounceGeolocateEvent(
        'error',
        false,
        async (enabled) => {
          console.log('🗺️ [Map] Executing error proximity update:', enabled);
          await updateProximityEnabled(enabled, 'GeolocateControl-Error');
        },
        (control as any)._watchState
      );
    };

    // Remove any existing listeners to prevent duplicates
    control.off('geolocate', handleGeolocate);
    control.off('trackuserlocationstart', handleTrackUserLocationStart);
    control.off('trackuserlocationend', handleTrackUserLocationEnd);
    control.off('error', handleGeolocateError);

    // Add enhanced event listeners
    control.on('geolocate', handleGeolocate);
    control.on('trackuserlocationstart', handleTrackUserLocationStart);
    control.on('trackuserlocationend', handleTrackUserLocationEnd);
    control.on('error', handleGeolocateError);

    console.log('🗺️ [Map] Enhanced GeolocateControl event handlers attached');

    // Cleanup function
    return () => {
      // Check if control still exists and hasn't been removed
      if (control && typeof (control as any).off === 'function') {
        try {
          control.off('geolocate', handleGeolocate);
          control.off('trackuserlocationstart', handleTrackUserLocationStart);
          control.off('trackuserlocationend', handleTrackUserLocationEnd);
          control.off('error', handleGeolocateError);
        } catch (error) {
          console.warn('🗺️ [Map] Error removing event listeners:', error);
        }
      }
    };
  }, [updateProximityEnabled]);

  // Enhanced proximity settings sync with conflict prevention
  useEffect(() => {
    if (!proximitySettings || !geolocateControlRef.current) return;
    
    // Skip sync if GeolocateControl is currently processing events
    if (geolocateControlDebouncer.hasActiveFlag('isUpdatingFromGeolocateControl')) {
      console.log('🗺️ [Map] Skipping proximity sync - GeolocateControl update in progress');
      return;
    }

    // Set flag to prevent feedback loops
    geolocateControlDebouncer.setUpdateFlag('isUpdatingFromProximitySettings', 1000);

    const control = geolocateControlRef.current;
    const isCurrentlyTracking = (control as any)._watchState === 'ACTIVE_LOCK' || (control as any)._watchState === 'ACTIVE_ERROR';
    
    console.log('🗺️ [Map] Syncing proximity settings with GeolocateControl:', {
      proximityEnabled: proximitySettings.is_enabled,
      currentlyTracking: isCurrentlyTracking,
      controlState: (control as any)._watchState,
      preventingFeedback: true
    });

    // Sync state with enhanced conflict detection
    if (proximitySettings.is_enabled && !isCurrentlyTracking) {
      console.log('🗺️ [Map] Triggering GeolocateControl (proximity enabled)');
      control.trigger();
    } else if (!proximitySettings.is_enabled && isCurrentlyTracking) {
      console.log('🗺️ [Map] Stopping GeolocateControl (proximity disabled)');
      
      // Use a small delay to prevent rapid state changes
      setTimeout(() => {
        if ((control as any)._watchState === 'ACTIVE_LOCK' || (control as any)._watchState === 'ACTIVE_ERROR') {
          control.trigger(); // This will stop tracking
        }
      }, 100);
    }
  }, [proximitySettings?.is_enabled]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-122.4194, 37.7749],
      zoom: 12,
    });

    mapRef.current = map;

    map.on('load', () => {
      setMapLoaded(true);
    });

    map.on('move', () => {
      setUserLocation([map.getCenter().lng, map.getCenter().lat]);
    });

    // Add navigation control
    const nav = new mapboxgl.NavigationControl({
      visualizePitch: true,
    });
    map.addControl(nav, 'top-left');

    // Add geolocate control (after map is loaded)
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: false, // Disable initial tracking
      showUserHeading: true,
      showAccuracyCircle: true,
      fitBoundsOptions: {
        maxZoom: 15,
      },
    });

    map.addControl(geolocateControl);
    geolocateControlRef.current = geolocateControl;

    // Trigger initial geolocation
    geolocateControl.trigger();

    return () => {
      map.remove();
    };
  }, []);

  // Attach GeolocateControl event handlers
  useEffect(() => {
    const cleanup = handleGeolocateControlEvents();
    return () => {
      cleanup?.();
    };
  }, [handleGeolocateControlEvents]);

  // Enhanced cleanup effect
  useEffect(() => {
    return () => {
      // Clean up GeolocateControl debouncer on unmount
      geolocateControlDebouncer.clearAllTimeouts();
      console.log('🗺️ [Map] Cleaned up GeolocateControl debouncer');
    };
  }, []);

  // Development debugging utilities
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      (window as any).geolocateDebug = {
        dumpInfo: () => geolocateControlDebouncer.dumpDebugInfo(),
        getHistory: (eventType?: string) => geolocateControlDebouncer.getEventHistory(eventType),
        getActiveFlags: () => geolocateControlDebouncer.getActiveFlags(),
        clearTimeouts: () => geolocateControlDebouncer.clearAllTimeouts()
      };
    }
  }, []);

  return (
    <div ref={mapContainerRef} className="map-container" style={{ height: '100vh', width: '100%' }}>
    </div>
  );
};

export default Map;
