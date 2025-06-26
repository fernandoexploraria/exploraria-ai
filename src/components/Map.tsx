import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { setMapMarkersRef } from '@/data/tourLandmarks';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { TOUR_LANDMARKS } from '@/data/tourLandmarks';
import { useLandmarkSourceToggle } from '@/hooks/useLandmarkSourceToggle';

interface MapProps {
  onLocationSelect?: (coordinates: [number, number]) => void;
  showTourLandmarks?: boolean;
  showTopLandmarks?: boolean;
}

const Map: React.FC<MapProps> = ({ 
  onLocationSelect, 
  showTourLandmarks = true,
  showTopLandmarks = true 
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const photoPopupsRef = useRef<{ [key: string]: mapboxgl.Popup }>({});
  const { mapboxToken } = useMapboxToken();
  const { startLocationTracking, isLocationTracking } = useLocationTracking();
  const { proximityEnabled } = useProximityAlerts();
  const { showLandmarks } = useLandmarkSourceToggle();

  // Stable reference to prevent infinite loops - only recreate when landmarks actually change
  const stableTourLandmarks = useMemo(() => {
    console.log('🗺️ Tour landmarks memo recalculating:', TOUR_LANDMARKS.length);
    return TOUR_LANDMARKS.filter(landmark => {
      const [lng, lat] = landmark.coordinates;
      const isValid = lng !== 0 || lat !== 0;
      if (!isValid) {
        console.warn('🚫 Filtering out invalid coordinates for:', landmark.name, landmark.coordinates);
      }
      return isValid;
    }).map(landmark => ({
      id: `tour-landmark-${landmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: landmark.name,
      coordinates: landmark.coordinates,
      description: landmark.description,
      type: 'tour' as const
    }));
  }, [TOUR_LANDMARKS.length, TOUR_LANDMARKS.map(l => `${l.name}-${l.coordinates[0]}-${l.coordinates[1]}`).join(',')]);

  const stableTopLandmarks = useMemo(() => {
    return TOP_LANDMARKS.map(landmark => ({
      id: `top-${landmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: landmark.name,
      coordinates: landmark.coordinates,
      description: landmark.description,
      type: 'top' as const
    }));
  }, []);

  // Combine landmarks with stable references to prevent infinite loops
  const allLandmarksWithTop = useMemo(() => {
    const landmarks = [];
    
    if (showTourLandmarks && showLandmarks.tour) {
      landmarks.push(...stableTourLandmarks);
    }
    
    if (showTopLandmarks && showLandmarks.top) {
      landmarks.push(...stableTopLandmarks);
    }
    
    console.log('🗺️ Combined landmarks:', {
      tour: stableTourLandmarks.length,
      top: stableTopLandmarks.length,
      total: landmarks.length
    });
    
    return landmarks;
  }, [showTourLandmarks, showTopLandmarks, showLandmarks.tour, showLandmarks.top, stableTourLandmarks, stableTopLandmarks]);

  // Set up marker references for other components
  useEffect(() => {
    setMapMarkersRef(markersRef, photoPopupsRef);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    console.log('🗺️ [Map] Initializing map...');
    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      projection: 'globe',
      zoom: 1.5,
      center: [30, 15],
      pitch: 45,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Add geolocate control for location tracking
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });

    map.current.addControl(geolocateControl, 'top-right');

    // Add atmosphere and fog effects
    map.current.on('style.load', () => {
      console.log('🗺️ [Map] Map style loaded, adding fog...');
      map.current?.setFog({
        color: 'rgb(255, 255, 255)',
        'high-color': 'rgb(200, 200, 225)',
        'horizon-blend': 0.2,
      });
    });

    // Set up global map functions for external use
    console.log('Setting up global map functions');
    (window as any).flyToLocation = (coordinates: [number, number]) => {
      console.log('🗺️ Flying to coordinates:', coordinates);
      if (map.current) {
        map.current.flyTo({
          center: coordinates,
          zoom: 14,
          duration: 2000
        });
      }
    };

    return () => {
      console.log('Cleaning up global map functions');
      delete (window as any).flyToLocation;
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Handle markers - use stable reference to prevent infinite loops
  useEffect(() => {
    if (!map.current || !allLandmarksWithTop.length) return;

    console.log('🗺️ [Map] Updating markers for', allLandmarksWithTop.length, 'landmarks');

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // Add new markers
    allLandmarksWithTop.forEach(landmark => {
      const [lng, lat] = landmark.coordinates;
      
      // Skip invalid coordinates
      if (lng === 0 && lat === 0) {
        console.warn('🚫 Skipping landmark with invalid coordinates:', landmark.name);
        return;
      }

      console.log('🗺️ Adding marker for:', landmark.name, 'at', [lng, lat]);

      // Create marker element
      const markerElement = document.createElement('div');
      markerElement.className = `w-8 h-8 rounded-full border-2 border-white shadow-lg cursor-pointer transform transition-transform hover:scale-110 ${
        landmark.type === 'tour' ? 'bg-green-500' : 'bg-blue-500'
      }`;

      // Add pulsing animation for tour landmarks
      if (landmark.type === 'tour') {
        markerElement.classList.add('animate-pulse');
      }

      // Create and add marker
      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat([lng, lat])
        .addTo(map.current!);

      // Add click handler
      markerElement.addEventListener('click', () => {
        console.log('🗺️ Marker clicked:', landmark.name);
        if (onLocationSelect) {
          onLocationSelect([lng, lat]);
        }
        
        // Fly to the landmark
        map.current?.flyTo({
          center: [lng, lat],
          zoom: 15,
          duration: 1500
        });
      });

      markersRef.current[landmark.id] = marker;
    });

  }, [allLandmarksWithTop, onLocationSelect]);

  // Handle planned landmarks changes and fly-to animation
  useEffect(() => {
    if (!map.current || !stableTourLandmarks.length) return;

    console.log('🗺️ New planned landmarks detected, flying to show tour');
    
    // Calculate bounds for all tour landmarks
    const bounds = new mapboxgl.LngLatBounds();
    let validLandmarks = 0;
    
    stableTourLandmarks.forEach(landmark => {
      const [lng, lat] = landmark.coordinates;
      if (lng !== 0 || lat !== 0) {
        bounds.extend([lng, lat]);
        validLandmarks++;
      }
    });

    if (validLandmarks > 0) {
      console.log('🗺️ Flying to bounds of', validLandmarks, 'valid landmarks');
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 12,
        duration: 2000
      });
    } else {
      console.warn('🚫 No valid landmarks to fly to');
    }
  }, [stableTourLandmarks.length > 0 ? stableTourLandmarks[0]?.name : '']); // Only trigger when first landmark changes

  // Start location tracking if proximity is enabled
  useEffect(() => {
    if (proximityEnabled && !isLocationTracking) {
      console.log('🗺️ [Map] Starting location tracking for proximity alerts');
      startLocationTracking();
    }
  }, [proximityEnabled, isLocationTracking, startLocationTracking]);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="absolute inset-0 rounded-lg shadow-lg" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent to-background/10 rounded-lg" />
    </div>
  );
};

export default Map;
