import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocationTracking } from './useLocationTracking';
import mapboxgl from 'mapbox-gl';

export type LocationButtonMode = 'off' | 'centered' | 'tracking';

export const useLocationButton = (map: mapboxgl.Map | null) => {
  const [mode, setMode] = useState<LocationButtonMode>('off');
  const { userLocation, startTracking, stopTracking, locationState } = useLocationTracking();
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const toggleMode = useCallback(() => {
    if (!map) return;

    switch (mode) {
      case 'off':
        // Activate with centering
        setMode('centered');
        startTracking();
        break;
      case 'centered':
        // Keep tracking but don't center
        setMode('tracking');
        break;
      case 'tracking':
        // Turn off completely
        setMode('off');
        stopTracking();
        // Remove marker
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
        break;
    }
  }, [mode, map, startTracking, stopTracking]);

  // Update map when location changes
  const updateMapLocation = useCallback(() => {
    if (!map || !userLocation || mode === 'off') return;

    // Create or update the blue dot marker
    if (!markerRef.current) {
      const el = document.createElement('div');
      el.className = 'location-marker';
      el.style.cssText = `
        width: 20px;
        height: 20px;
        background: #4285F4;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
      `;

      markerRef.current = new mapboxgl.Marker(el)
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([userLocation.longitude, userLocation.latitude]);
    }

    // Center map if in centered mode
    if (mode === 'centered') {
      map.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: Math.max(map.getZoom(), 15),
        speed: 1.2,
        curve: 1.42
      });
    }
  }, [map, userLocation, mode]);

  // Call updateMapLocation when location or mode changes
  useEffect(() => {
    updateMapLocation();
  }, [updateMapLocation]);

  // Clean up marker when mode changes to off or component unmounts
  useEffect(() => {
    if (mode === 'off' && markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [mode]);

  return {
    mode,
    toggleMode,
    location: userLocation,
    isTracking: locationState.isTracking
  };
};
