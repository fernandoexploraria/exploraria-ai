import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, Marker, useJsApiLoader, InfoWindow } from '@react-google-maps/api';
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
}

const Map: React.FC<MapProps> = ({ 
  landmarks, 
  onLandmarkClick, 
  userLocation, 
  followUser = true, 
  proximitySettings,
  onLocationUpdate 
}) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRefs = useRef<Record<string, google.maps.Marker>>({});
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
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

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
  });

  const { trackLocation } = useLocationTracking({
    onLocationUpdate,
    onError: (error) => {
      console.error('Location tracking error:', error);
    }
  });

  const { isNear } = useProximityAlerts({
    userLocation,
    landmarks,
    distanceThreshold: proximitySettings.distance
  });

  const { sendProximityNotification } = useProximityNotifications();

  useEffect(() => {
    if (proximitySettings.enabled && isNear && isNear.landmark) {
      sendProximityNotification(isNear.landmark);
    }
  }, [isNear, sendProximityNotification, proximitySettings.enabled]);

  useEffect(() => {
    trackLocation();
  }, [trackLocation]);

  const mapContainerStyle = {
    width: '100%',
    height: '100%',
  };

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const handleMarkerClick = (landmark: Landmark) => {
    setSelectedLandmark(landmark);
    onLandmarkClick(landmark);
  };

  useEffect(() => {
    if (userLocation && mapRef.current) {
      const newLatLng = new google.maps.LatLng(userLocation.latitude, userLocation.longitude);
      
      if (followUser) {
        mapRef.current.panTo(newLatLng);
        // mapRef.current.setZoom(mapZoom);
      }
    }
  }, [userLocation, followUser, mapZoom]);

  // Enhanced photo fetching with preload awareness
  const fetchLandmarkPhotos = useCallback(async (landmark: Landmark) => {
    if (!landmark.placeId && !landmark.place_id) {
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

  return (
    <>
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          onLoad={onLoad}
          onUnmount={onUnmount}
          zoom={mapZoom}
          center={userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : undefined}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          {userLocation && (
            <Marker
              position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: "blue",
                fillOpacity: 0.9,
                strokeWeight: 2,
                strokeColor: "white",
              }}
            />
          )}
          {landmarks.map((landmark) => (
            <Marker
              key={landmark.id}
              position={{ lat: landmark.coordinates[1], lng: landmark.coordinates[0] }}
              onClick={() => handleMarkerClick(landmark)}
              ref={(ref) => (markerRefs.current[landmark.id] = ref as google.maps.Marker)}
            />
          ))}
          {selectedLandmark && (
            <InfoWindow
              position={{ lat: selectedLandmark.coordinates[1], lng: selectedLandmark.coordinates[0] }}
              onCloseClick={() => setSelectedLandmark(null)}
            >
              <div style={{ maxWidth: '200px' }}>
                <h3>{selectedLandmark.name}</h3>
                <p>{selectedLandmark.description}</p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      ) : <div className="flex w-full h-full items-center justify-center">Loading Map...</div>}

      {/* Add development info about preloading stats */}
      {React.useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
          const stats = photoPreloading.getPreloadingStats();
          if (stats.totalPreloaded > 0) {
            console.log('📊 Photo Preloading Stats:', stats);
          }
        }
      }, [photoPreloading.stats])}
    </>
  );
};

export default Map;
