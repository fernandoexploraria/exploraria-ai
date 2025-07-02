
import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { calculateDistance } from '@/utils/proximityUtils';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useProximityNotifications } from '@/hooks/useProximityNotifications';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useLandmarkPhotos } from '@/hooks/useLandmarkPhotos';
import { usePhotoPreloading } from '@/hooks/usePhotoPreloading';
import { useEnhancedLandmarkPhotos } from '@/hooks/useEnhancedLandmarkPhotos';
import { supabase } from '@/integrations/supabase/client';

interface MapProps {
  landmarks: Landmark[];
  onLandmarkClick: (landmark: Landmark) => void;
  userLocation: UserLocation | null;
  followUser?: boolean;
  proximitySettings: {
    enabled: boolean;
    distance: number;
  };
  onLocationUpdate: (location: UserLocation) => void;
  selectedLandmark?: Landmark | null;
  plannedLandmarks?: Landmark[];
}

const Map: React.FC<MapProps> = ({ 
  landmarks, 
  onLandmarkClick, 
  userLocation, 
  followUser = true, 
  proximitySettings,
  onLocationUpdate,
  selectedLandmark,
  plannedLandmarks = []
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const [mapZoom, setMapZoom] = useState(16);

  // Add photo preloading hook
  const photoPreloading = usePhotoPreloading(
    userLocation,
    landmarks,
    {
      preloadDistance: 750, // Slightly larger than proximity alerts
      maxConcurrentPreloads: 2, // Conservative to avoid overwhelming
      prioritySize: 'medium',
      enableNetworkAware: true
    }
  );

  const { userLocation: trackedLocation } = useLocationTracking({
    onLocationUpdate,
    onError: (error) => {
      console.error('Location tracking error:', error);
    }
  });

  const proximityAlerts = useProximityAlerts({
    userLocation,
    landmarks,
    distanceThreshold: proximitySettings.distance
  });

  const proximityNotifications = useProximityNotifications();

  useEffect(() => {
    if (proximitySettings.enabled && proximityAlerts.proximityAlerts.length > 0) {
      // Handle proximity notifications here if needed
      console.log('Proximity alerts:', proximityAlerts.proximityAlerts);
    }
  }, [proximityAlerts.proximityAlerts, proximitySettings.enabled]);

  const mapContainerStyle = {
    width: '100%',
    height: '100%',
  };

  const onLoad = useCallback((mapInstance: mapboxgl.Map) => {
    map.current = mapInstance;
  }, []);

  const onUnmount = useCallback(() => {
    map.current = null;
  }, []);

  const handleMarkerClick = (landmark: Landmark) => {
    onLandmarkClick(landmark);
  };

  // Enhanced photo fetching with preload awareness
  const fetchLandmarkPhotos = useCallback(async (landmark: Landmark) => {
    if (!landmark.placeId) {
      console.log(`⚠️ No place_id available for ${landmark.name}, using fallback strategies`);
      
      // Strategy 1: Try coordinate-based search
      try {
        const { data: nearbyPlaces } = await supabase.functions.invoke('google-places-nearby', {
          body: {
            location: {
              lat: landmark.coordinates[1],
              lng: landmark.coordinates[0]
            },
            radius: 50,
            type: 'tourist_attraction',
            keyword: landmark.name
          }
        });

        if (nearbyPlaces?.results?.[0]?.place_id) {
          const tempLandmark = { ...landmark, placeId: nearbyPlaces.results[0].place_id };
          return await fetchEnhancedPhotos(tempLandmark);
        }
      } catch (error) {
        console.log(`Strategy 1 failed for ${landmark.name}:`, error);
      }

      // Strategy 2: Try text search
      try {
        const { data: searchResults } = await supabase.functions.invoke('google-places-search', {
          body: {
            query: `${landmark.name} landmark`,
            location: {
              lat: landmark.coordinates[1],
              lng: landmark.coordinates[0]
            },
            radius: 1000
          }
        });

        if (searchResults?.results?.[0]?.place_id) {
          const tempLandmark = { ...landmark, placeId: searchResults.results[0].place_id };
          return await fetchEnhancedPhotos(tempLandmark);
        }
      } catch (error) {
        console.log(`Strategy 2 failed for ${landmark.name}:`, error);
      }

      // Strategy 3: Final fallback - return empty result
      console.log(`All strategies failed for ${landmark.name}`);
      return {
        photos: [],
        bestPhoto: null,
        totalPhotos: 0,
        sourceUsed: 'none' as const,
        qualityDistribution: { high: 0, medium: 0, low: 0 }
      };
    }

    // Normal flow with place_id - check if preloaded first
    return await fetchEnhancedPhotos(landmark);
  }, []);

  // Enhanced photo fetching function that uses preloading
  const fetchEnhancedPhotos = useCallback(async (landmark: Landmark) => {
    try {
      // Check if photo is preloaded first
      const isPreloaded = photoPreloading.isPhotoPreloaded(landmark, 'medium');
      
      if (isPreloaded && process.env.NODE_ENV === 'development') {
        console.log(`⚡ Using preloaded photo for: ${landmark.name}`);
      }

      // Use the enhanced landmark photos hook for better performance
      const result = await useLandmarkPhotos().fetchLandmarkPhotos(landmark, {
        maxWidth: 800,
        quality: 'medium'
      });

      return result;
    } catch (error) {
      console.error(`Photo fetch failed for ${landmark.name}:`, error);
      return {
        photos: [],
        bestPhoto: null,
        totalPhotos: 0,
        sourceUsed: 'none' as const,
        qualityDistribution: { high: 0, medium: 0, low: 0 }
      };
    }
  }, [photoPreloading]);

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainer.current) return;

    // Get Mapbox token from environment
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!mapboxToken) {
      console.error('Mapbox token not found');
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: userLocation ? [userLocation.longitude, userLocation.latitude] : [0, 0],
      zoom: mapZoom
    });

    map.current = mapInstance;

    mapInstance.on('load', () => {
      onLoad(mapInstance);
    });

    return () => {
      mapInstance.remove();
      onUnmount();
    };
  }, []);

  // Update map center when user location changes
  useEffect(() => {
    if (userLocation && map.current && followUser) {
      map.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: mapZoom
      });
    }
  }, [userLocation, followUser, mapZoom]);

  // Add markers for landmarks
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // Add user location marker
    if (userLocation) {
      const userMarker = new mapboxgl.Marker({ color: 'blue' })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map.current);
      
      markersRef.current['user'] = userMarker;
    }

    // Add landmark markers
    landmarks.forEach(landmark => {
      const marker = new mapboxgl.Marker({ color: 'red' })
        .setLngLat([landmark.coordinates[0], landmark.coordinates[1]])
        .addTo(map.current!);

      marker.getElement().addEventListener('click', () => {
        handleMarkerClick(landmark);
      });

      markersRef.current[landmark.id] = marker;
    });

    // Add planned landmarks markers
    plannedLandmarks.forEach(landmark => {
      const marker = new mapboxgl.Marker({ color: 'green' })
        .setLngLat([landmark.coordinates[0], landmark.coordinates[1]])
        .addTo(map.current!);

      marker.getElement().addEventListener('click', () => {
        handleMarkerClick(landmark);
      });

      markersRef.current[`planned-${landmark.id}`] = marker;
    });

  }, [landmarks, plannedLandmarks, userLocation]);

  return (
    <>
      <div ref={mapContainer} className="w-full h-full" />

      {/* Add development info about preloading stats */}
      {process.env.NODE_ENV === 'development' && (() => {
        const stats = photoPreloading.getPreloadingStats();
        if (stats.totalPreloaded > 0) {
          console.log('📊 Photo Preloading Stats:', stats);
        }
        return null;
      })()}
    </>
  );
};

export default Map;
