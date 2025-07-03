
import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Landmark } from '@/data/landmarks';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { ProximitySettings } from '@/types/proximityAlerts';
import { debounce, throttle } from '@/utils/debounceUtils';
import { useMapboxToken } from '@/hooks/useMapboxToken';

interface MapProps {
  landmarks: Landmark[];
  onLandmarkClick?: (landmark: Landmark) => void;
  userCoordinate?: [number, number] | null;
  plannedLandmarks?: Landmark[];
}

// NEW: Debounce delays for different operations
const PROXIMITY_UPDATE_DEBOUNCE = 1000; // 1 second debounce for proximity updates
const SETTINGS_UPDATE_THROTTLE = 500; // 0.5 second throttle for settings updates

const Map = ({ landmarks, onLandmarkClick, userCoordinate, plannedLandmarks }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const routeSourceRef = useRef<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  // Get the Mapbox token dynamically
  const mapboxToken = useMapboxToken();
  
  const { updateProximityEnabled } = useProximityAlerts();

  // NEW: Debounced version of proximity updates
  const debouncedUpdateProximityEnabled = useCallback(
    debounce((enabled: boolean) => {
      console.log('🌍 Debounced GeolocateControl: Enabling proximity (user initiated location)', enabled);
      if (updateProximityEnabled) {
        updateProximityEnabled(enabled).catch(error => {
          console.error('❌ Failed to update proximity enabled status from map:', error);
        });
      }
    }, PROXIMITY_UPDATE_DEBOUNCE),
    [updateProximityEnabled]
  );

  // NEW: Throttled settings change handler to prevent rapid-fire updates
  const throttledSettingsChangeHandler = useCallback(
    throttle((settings: ProximitySettings | null) => {
      if (!map.current) return;

      const geolocateControl = (map.current as any)._geolocateControl;
      if (!geolocateControl) return;

      console.log('🔄 Throttled proximity settings change:', settings);

      const isCurrentlyTracking = geolocateControl._watchState === 'ACTIVE_LOCK' || geolocateControl._watchState === 'ACTIVE_ERROR';
      const isTransitioning = geolocateControl._watchState === 'WAITING_ACTIVE';
      const shouldBeTracking = Boolean(settings?.is_enabled);

      console.log('🔄 GeolocateControl sync check:', {
        isCurrentlyTracking,
        isTransitioning,
        shouldBeTracking,
        watchState: geolocateControl._watchState
      });

      if (shouldBeTracking && !isCurrentlyTracking && !isTransitioning) {
        console.log('🔄 Syncing GeolocateControl: Starting tracking (proximity enabled externally)');
        geolocateControl.trigger();
      } else if (!shouldBeTracking && isCurrentlyTracking) {
        console.log('🔄 Syncing GeolocateControl: Stopping tracking (proximity disabled externally)');
        // Note: MapboxGL doesn't provide a direct way to stop tracking programmatically
      }
    }, SETTINGS_UPDATE_THROTTLE),
    []
  );

  // Initialize map - only when token is available
  useEffect(() => {
    if (!mapContainer.current || map.current || !mapboxToken) return;

    console.log('🗺️ Initializing Mapbox map with token');

    // Set the access token
    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-0.1276, 51.5074], // London center
      zoom: 12,
      attributionControl: false
    });

    map.current.addControl(new mapboxgl.AttributionControl({
      compact: true
    }), 'bottom-right');

    map.current.on('load', () => {
      console.log('🗺️ Map loaded successfully');
      setMapLoaded(true);
    });

    map.current.on('error', (e) => {
      console.error('🗺️ Map error:', e);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken]); // Depend on mapboxToken

  // Add GeolocateControl with proximity integration
  useEffect(() => {
    if (!map.current || !updateProximityEnabled) return;

    // Track the last location event time to prevent rapid-fire updates
    let lastLocationEventTime = 0;
    let isUpdatingFromProximitySettings = false;

    // NEW: Track if we've already enabled proximity for this session
    let hasTriggeredProximityEnable = false;

    // Create the GeolocateControl
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      },
      trackUserLocation: true,
      showUserHeading: true,
      fitBoundsOptions: {
        padding: { top: 50, right: 50, bottom: 50, left: 50 },
        maxZoom: 16
      }
    });

    // Add the control to the map and store reference for later access
    map.current.addControl(geolocateControl, 'top-right');
    (map.current as any)._geolocateControl = geolocateControl;

    // Helper function to check recent location events
    const isRecentLocationEvent = (threshold = 200) => {
      const now = Date.now();
      const timeSinceLastEvent = now - lastLocationEventTime;
      return timeSinceLastEvent < threshold;
    };

    // NEW: Debounced geolocate handler to prevent rapid-fire updates
    const debouncedGeolocateHandler = debounce((e: any) => {
      const now = Date.now();
      const coordinates = [e.coords.longitude, e.coords.latitude];
      lastLocationEventTime = now;

      console.log('🌍 Debounced GeolocateControl: Location found', {
        coordinates,
        state: geolocateControl._watchState,
        userInitiated: !isRecentLocationEvent(500)
      });

      // Only enable proximity on first successful location or user-initiated tracking
      if (!hasTriggeredProximityEnable && geolocateControl._watchState === 'ACTIVE_LOCK') {
        console.log('🌍 GeolocateControl: First successful location lock - enabling proximity');
        hasTriggeredProximityEnable = true;
        debouncedUpdateProximityEnabled(true);
      }
    }, 500);

    // Listen for geolocate events with debouncing
    geolocateControl.on('geolocate', debouncedGeolocateHandler);

    geolocateControl.on('trackuserlocationstart', () => {
      console.log('🌍 GeolocateControl: Started tracking user location (ACTIVE state)');
      
      // Only enable if not already done
      if (!hasTriggeredProximityEnable) {
        console.log('🌍 GeolocateControl: Enabling proximity (tracking started)');
        hasTriggeredProximityEnable = true;
        debouncedUpdateProximityEnabled(true);
      }
    });

    geolocateControl.on('trackuserlocationend', () => {
      console.log('🌍 GeolocateControl: Stopped tracking user location');
      hasTriggeredProximityEnable = false; // Reset for next session
      debouncedUpdateProximityEnabled(false);
    });

    geolocateControl.on('error', (e) => {
      console.error('🌍 GeolocateControl error:', e.message);
      hasTriggeredProximityEnable = false; // Reset on error
    });

    // Listen for proximity settings changes and sync with GeolocateControl (throttled)
    const handleProximitySettingsChange = (settings: ProximitySettings | null) => {
      if (isUpdatingFromProximitySettings) return;

      const now = Date.now();
      const timeSinceLastLocationEvent = now - lastLocationEventTime;
      const isRecentLocationEvent = timeSinceLastLocationEvent < 200;

      if (isRecentLocationEvent) {
        console.log('🔄 Skipping GeolocateControl sync - recent location event detected (likely triggered by this control)');
        return;
      }

      // Use throttled handler to prevent rapid-fire updates
      throttledSettingsChangeHandler(settings);
    };

    // Subscribe to proximity settings changes using the global state
    const globalProximityState = (window as any).globalProximityState;
    if (globalProximityState?.subscribers) {
      globalProximityState.subscribers.add(handleProximitySettingsChange);
    }

    return () => {
      if (map.current && geolocateControl) {
        map.current.removeControl(geolocateControl);
        delete (map.current as any)._geolocateControl;
      }
      
      // Unsubscribe from proximity settings changes
      const globalProximityState = (window as any).globalProximityState;
      if (globalProximityState?.subscribers) {
        globalProximityState.subscribers.delete(handleProximitySettingsChange);
      }
    };
  }, [updateProximityEnabled, debouncedUpdateProximityEnabled, throttledSettingsChangeHandler]);

  // Add navigation controls
  useEffect(() => {
    if (!map.current) return;

    const nav = new mapboxgl.NavigationControl();
    map.current.addControl(nav, 'top-left');

    return () => {
      if (map.current) {
        map.current.removeControl(nav);
      }
    };
  }, []);

  // Update landmarks
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    console.log('🗺️ Updating landmarks on map:', landmarks.length);

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    landmarks.forEach((landmark) => {
      const isPlanned = plannedLandmarks?.some(pl => pl.id === landmark.id);
      
      // Create marker element
      const el = document.createElement('div');
      el.className = `marker ${isPlanned ? 'planned' : ''}`;
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = isPlanned ? '#10b981' : '#3b82f6';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';

      const marker = new mapboxgl.Marker(el)
        .setLngLat(landmark.coordinates)
        .addTo(map.current!);

      // Add click handler
      el.addEventListener('click', () => {
        if (onLandmarkClick) {
          onLandmarkClick(landmark);
        }
      });

      markersRef.current.push(marker);
    });
  }, [landmarks, mapLoaded, onLandmarkClick, plannedLandmarks]);

  // Update user location
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (userCoordinate) {
      console.log('🗺️ Updating user location on map:', userCoordinate);

      // Remove existing user marker
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
      }

      // Create user marker
      const el = document.createElement('div');
      el.className = 'user-marker';
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#ef4444';
      el.style.border = '3px solid white';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';

      userMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat(userCoordinate)
        .addTo(map.current);
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [userCoordinate, mapLoaded]);

  // Global function to show route on map
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    (window as any).showRouteOnMap = (route: any, destination: any) => {
      if (!map.current) return;

      console.log('🗺️ Showing route on map to:', destination.name);

      // Remove existing route
      if (routeSourceRef.current && map.current.getSource(routeSourceRef.current)) {
        map.current.removeLayer(`route-${routeSourceRef.current}`);
        map.current.removeSource(routeSourceRef.current);
      }

      // Add new route
      const routeId = `route-${Date.now()}`;
      routeSourceRef.current = routeId;

      map.current.addSource(routeId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: route.geometry
        }
      });

      map.current.addLayer({
        id: `route-${routeId}`,
        type: 'line',
        source: routeId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 4,
          'line-opacity': 0.8
        }
      });

      // Fit map to route
      const coordinates = route.geometry.coordinates;
      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach((coord: [number, number]) => bounds.extend(coord));
      
      map.current.fitBounds(bounds, {
        padding: { top: 50, right: 50, bottom: 50, left: 50 },
        maxZoom: 16
      });
    };

    return () => {
      delete (window as any).showRouteOnMap;
    };
  }, [mapLoaded]);

  // Show loading state while token is being fetched
  if (!mapboxToken) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100" style={{ minHeight: '400px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  );
};

export default Map;
