
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { TOUR_LANDMARKS, setMapMarkersRef } from '@/data/tourLandmarks';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { useEnhancedPhotos } from '@/hooks/useEnhancedPhotos';
import { useDebugWindow } from '@/hooks/useDebugWindow';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';
import { toast } from "sonner";

interface MapProps {
  destinationCoordinates?: [number, number];
  destinationName?: string;
}

const Map: React.FC<MapProps> = ({ destinationCoordinates, destinationName }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const photoPopupsRef = useRef<{ [key: string]: mapboxgl.Popup }>({});
  const [lastTourLandmarksLength, setLastTourLandmarksLength] = useState(0);
  const [hasFlownToDestination, setHasFlownToDestination] = useState(false);
  
  const mapboxToken = useMapboxToken();
  const { 
    userLocation: currentLocation, 
    startTracking, 
    stopTracking, 
    locationState 
  } = useLocationTracking();
  
  const locationError = locationState?.error;
  const isTracking = locationState?.isTracking;
  
  const { 
    proximityAlerts, 
    proximitySettings,
    userLocation,
    combinedLandmarks,
    updateProximityEnabled,
    updateDistanceSetting
  } = useProximityAlerts();
  
  const nearbyLandmarks = useNearbyLandmarks({ 
    userLocation: currentLocation,
    notificationDistance: proximitySettings?.notification_distance || 100
  });
  
  const { fetchPhotos } = useEnhancedPhotos();
  const { isVisible: showDebugWindow, toggle: toggleDebugWindow } = useDebugWindow();
  const { isOnline } = useNetworkStatus();
  const { connectionHealth } = useConnectionMonitor();

  // Simple distance calculation function
  const distanceToLandmark = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    const initialCenter = destinationCoordinates || [0, 20];
    const initialZoom = destinationCoordinates ? 12 : 1.5;
    
    console.log('🗺️ Initializing map with:', { 
      center: initialCenter, 
      zoom: initialZoom,
      hasDestination: !!destinationCoordinates 
    });

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: initialCenter,
      zoom: initialZoom,
      pitch: destinationCoordinates ? 0 : 45,
      projection: destinationCoordinates ? 'mercator' : 'globe',
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-left');
    map.current.addControl(new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    }), 'top-left');

    map.current.on('style.load', () => {
      map.current!.setFog({
        range: [0.8, 8],
        color: '#d8e2ef',
        'horizon-blend': 0.3,
        'star-intensity': 0.6
      });
    });

    // Atmosphere styling
    map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    map.current.addSource('mapbox-dem', {
      'type': 'raster-dem',
      'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
      'tileSize': 512,
      'maxzoom': 14
    });

    // Set markers ref for tour landmarks
    setMapMarkersRef(markersRef, photoPopupsRef);

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, destinationCoordinates]);

  // Fly to destination when coordinates are provided
  useEffect(() => {
    if (!map.current || !destinationCoordinates || hasFlownToDestination) return;

    console.log('🗺️ Flying to destination:', destinationCoordinates, destinationName);
    
    map.current.flyTo({
      center: destinationCoordinates,
      zoom: 12,
      pitch: 0,
      duration: 2000,
      essential: true
    });

    setHasFlownToDestination(true);
    
    if (destinationName) {
      toast.success(`Flying to ${destinationName}...`);
    }
  }, [destinationCoordinates, destinationName, hasFlownToDestination]);

  // Reset fly state when destination changes
  useEffect(() => {
    setHasFlownToDestination(false);
  }, [destinationCoordinates]);

  // Enhanced tour landmarks effect with better state management
  useEffect(() => {
    if (!map.current) return;

    const currentLength = TOUR_LANDMARKS.length;
    
    // Only process if there's a change in tour landmarks
    if (currentLength === lastTourLandmarksLength) return;
    
    console.log('🎯 Tour landmarks changed:', {
      previous: lastTourLandmarksLength,
      current: currentLength,
      landmarks: TOUR_LANDMARKS.map(l => l.name)
    });

    // Clear existing tour markers
    Object.keys(markersRef.current).forEach(markerId => {
      if (markerId.startsWith('tour-landmark-')) {
        console.log('Removing existing tour marker:', markerId);
        markersRef.current[markerId].remove();
        delete markersRef.current[markerId];
      }
    });

    // Add new tour markers if any
    if (currentLength > 0) {
      console.log('Adding tour markers:', currentLength);
      
      TOUR_LANDMARKS.forEach((landmark, index) => {
        const markerId = `tour-landmark-${index}`;
        
        // Create marker element
        const markerElement = document.createElement('div');
        markerElement.className = 'tour-marker';
        markerElement.style.cssText = `
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #22c55e;
          border: 3px solid white;
          cursor: pointer;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
        `;
        markerElement.textContent = (index + 1).toString();

        // Create and add marker
        const marker = new mapboxgl.Marker(markerElement)
          .setLngLat(landmark.coordinates)
          .addTo(map.current!);

        markersRef.current[markerId] = marker;

        // Add click handler for popup
        markerElement.addEventListener('click', () => {
          const popup = new mapboxgl.Popup({ offset: 25 })
            .setLngLat(landmark.coordinates)
            .setHTML(`
              <div class="p-2">
                <h3 class="font-bold text-sm">${landmark.name}</h3>
                <p class="text-xs text-gray-600 mt-1">${landmark.description}</p>
              </div>
            `)
            .addTo(map.current!);
        });
      });

      // Fit bounds to show all landmarks after a short delay (only if we have multiple landmarks)
      if (currentLength > 1) {
        setTimeout(() => {
          const bounds = new mapboxgl.LngLatBounds();
          TOUR_LANDMARKS.forEach(landmark => {
            bounds.extend(landmark.coordinates);
          });
          
          map.current?.fitBounds(bounds, {
            padding: 50,
            maxZoom: 15,
            duration: 1500
          });
          
          console.log('🎯 Fitted bounds to show all tour landmarks');
        }, 1000);
      } else if (currentLength === 1) {
        // For single landmark, just fly to it
        setTimeout(() => {
          map.current?.flyTo({
            center: TOUR_LANDMARKS[0].coordinates,
            zoom: 15,
            duration: 1500
          });
          
          console.log('🎯 Flew to single tour landmark');
        }, 1000);
      }
    }

    setLastTourLandmarksLength(currentLength);
  }, [TOUR_LANDMARKS.length, lastTourLandmarksLength]);

  // Top landmarks effect
  useEffect(() => {
    if (!map.current) return;

    TOP_LANDMARKS.forEach(landmark => {
      new mapboxgl.Marker({ color: 'red' })
        .setLngLat(landmark.coordinates)
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<h3>${landmark.name}</h3><p>${landmark.description}</p>`)
        )
        .addTo(map.current);
    });
  }, []);

  // Location tracking effect
  useEffect(() => {
    if (!isTracking) return;

    if (currentLocation) {
      // console.log('📍 Current location:', currentLocation.longitude, currentLocation.latitude);
    } else if (locationError) {
      console.error('🚨 Location error:', locationError);
      toast.error("Location Error: " + locationError);
    }
  }, [currentLocation, locationError, isTracking]);

  // Proximity alerts effect
  useEffect(() => {
    if (!currentLocation) return;

    TOP_LANDMARKS.forEach(landmark => {
      const distance = distanceToLandmark(
        currentLocation.latitude,
        currentLocation.longitude,
        landmark.coordinates[1],
        landmark.coordinates[0]
      );
      
      if (distance !== null) {
        // For now, just log proximity - the actual alert system is handled by useProximityAlerts
        if (distance < 1000) { // Within 1km
          console.log(`📍 Near ${landmark.name}: ${Math.round(distance)}m`);
        }
      }
    });
  }, [currentLocation, distanceToLandmark]);

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0 rounded-lg" />
      {showDebugWindow && (
        <div className="absolute top-2 left-2 bg-white bg-opacity-90 rounded-lg shadow-md p-4 z-50">
          <h3 className="text-lg font-semibold mb-2">Debug Window</h3>
          <button onClick={toggleDebugWindow} className="bg-red-500 text-white rounded px-3 py-1 text-sm hover:bg-red-700">
            Close Debug
          </button>
          <div className="mt-2 text-sm">
            <p>Is Online: {isOnline ? 'Yes' : 'No'}</p>
            <p>Connection: {connectionHealth?.isHealthy ? 'Good' : 'Issues'}</p>
            {currentLocation && (
              <>
                <p>Latitude: {currentLocation.latitude}</p>
                <p>Longitude: {currentLocation.longitude}</p>
              </>
            )}
            <p>Location Tracking: {isTracking ? 'On' : 'Off'}</p>
            {locationError && <p>Location Error: {locationError}</p>}
            <button onClick={isTracking ? stopTracking : startTracking} className="bg-blue-500 text-white rounded px-3 py-1 text-sm hover:bg-blue-700 mt-2">
              {isTracking ? 'Stop Tracking' : 'Start Tracking'}
            </button>
          </div>
        </div>
      )}
      {!showDebugWindow && (
        <button onClick={toggleDebugWindow} className="absolute top-2 left-2 bg-gray-800 text-white rounded px-3 py-1 text-sm hover:bg-gray-600 z-50">
          Show Debug
        </button>
      )}
      {!isOnline && (
        <div className="absolute bottom-2 left-2 bg-red-500 text-white rounded px-3 py-1 text-sm z-50">
          Offline Mode
        </div>
      )}
      {connectionHealth && !connectionHealth.isHealthy && (
        <div className="absolute bottom-2 right-2 bg-yellow-500 text-gray-800 rounded px-3 py-1 text-sm z-50">
          Connection Issues
        </div>
      )}
    </div>
  );
};

export default Map;
