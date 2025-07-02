import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import { Landmark } from '@/data/landmarks';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { usePendingDestination } from '@/hooks/usePendingDestination';
import { useMarkerLoadingState } from '@/hooks/useMarkerLoadingState';
import { useEnhancedLandmarkPhotos } from '@/hooks/useEnhancedLandmarkPhotos';
import { useDemoMode } from '@/hooks/useDemoMode';
import FloatingProximityCard from './FloatingProximityCard';
import { createMarkerElement } from '@/utils/locationUtils';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Layers } from 'lucide-react';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface MapProps {
  landmarks: Landmark[];
  selectedLandmark: Landmark | null;
  onLandmarkClick: (landmark: Landmark) => void;
  onMapReady?: () => void;
  smartTourLandmarks?: Landmark[];
  onTestProximityCard?: () => void;
}

interface LocationData {
  latitude: number;
  longitude: number;
}

const Map: React.FC<MapProps> = ({
  landmarks,
  selectedLandmark,
  onLandmarkClick,
  onMapReady,
  smartTourLandmarks = [],
  onTestProximityCard
}) => {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);
  const [nearbyLandmarks, setNearbyLandmarks] = useState<Landmark[]>([]);
  const [proximityCardLandmark, setProximityCardLandmark] = useState<Landmark | null>(null);
  const [proximityCardDistance, setProximityCardDistance] = useState<number | null>(null);
  const [showDebugMarkers, setShowDebugMarkers] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [markerLoading, setMarkerLoading] = useState<{ [key: string]: boolean }>({});

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const locationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { mapboxToken } = useMapboxToken();
  const {
    location: trackedLocation,
    error: locationError,
    startTracking,
    stopTracking,
  } = useLocationTracking();
  const { checkProximity } = useProximityAlerts();
  const { pendingDestination, setPendingDestination, clearPendingDestination } = usePendingDestination();
  const { setMarkerLoadingState } = useMarkerLoadingState(setMarkerLoading);
  const { fetchPhotosWithPlaceIdFallback } = useEnhancedLandmarkPhotos();
  const { isDemoMode } = useDemoMode();
  
  const fetchPhotosWithHook = useCallback(async (landmark: Landmark) => {
    console.log(`🖼️ Map: Fetching photos for ${landmark.name} with enhanced system`);
    
    try {
      const result = await fetchPhotosWithPlaceIdFallback(landmark, {
        quality: 'medium',
        maxWidth: 800,
        preferredSource: 'database'
      });

      console.log(`📸 Map: Photo fetch result for ${landmark.name}:`, {
        photoCount: result.totalPhotos,
        source: result.sourceUsed,
        hasBestPhoto: !!result.bestPhoto
      });

      return result.photos;
    } catch (error) {
      console.error(`❌ Map: Photo fetch failed for ${landmark.name}:`, error);
      return [];
    }
  }, [fetchPhotosWithPlaceIdFallback]);

  // Initialize map
  useEffect(() => {
    if (!mapboxToken || map) return;

    mapboxgl.accessToken = mapboxToken;

    const initializeMap = () => {
      if (!mapContainerRef.current) {
        console.error('Map container not found!');
        return;
      }

      const newMap = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [-99.15, 19.4],
        zoom: 10,
      });

      newMap.on('load', () => {
        console.log('🗺️ Map loaded');
        setIsMapLoaded(true);
        setMap(newMap);
        if (onMapReady) {
          onMapReady();
        }
      });

      newMap.on('click', (event) => {
        console.log('🖱️ Map clicked', event);
      });
    };

    initializeMap();

    return () => {
      map?.remove();
    };
  }, [mapboxToken, map, onMapReady]);

  // Start location tracking
  useEffect(() => {
    startTracking();

    return () => {
      stopTracking();
    };
  }, [startTracking, stopTracking]);

  // Update user location
  useEffect(() => {
    if (trackedLocation) {
      setUserLocation({
        latitude: trackedLocation.latitude,
        longitude: trackedLocation.longitude,
      });
    }
  }, [trackedLocation]);

  // Fly to selected landmark
  useEffect(() => {
    if (selectedLandmark && map) {
      map.flyTo({
        center: selectedLandmark.coordinates,
        zoom: 15,
        duration: 2000,
      });
    }
  }, [selectedLandmark, map]);

  // Update nearby landmarks
  useEffect(() => {
    if (userLocation) {
      const { latitude, longitude } = userLocation;
      const nearby = landmarks.filter((landmark) => {
        const distance = calculateDistance(
          latitude,
          longitude,
          landmark.coordinates[1],
          landmark.coordinates[0]
        );
        return distance < 5;
      });
      setNearbyLandmarks(nearby);
    }
  }, [userLocation, landmarks]);

  // Proximity alerts
  useEffect(() => {
    if (userLocation && nearbyLandmarks.length > 0) {
      const { latitude, longitude } = userLocation;
      const { closestLandmark, distance } = checkProximity(
        latitude,
        longitude,
        nearbyLandmarks
      );

      if (closestLandmark && distance !== null) {
        setProximityCardLandmark(closestLandmark);
        setProximityCardDistance(distance);

        // Set a timeout to clear the proximity card after 10 seconds
        if (locationTimeoutRef.current) {
          clearTimeout(locationTimeoutRef.current);
        }
        locationTimeoutRef.current = setTimeout(() => {
          setProximityCardLandmark(null);
          setProximityCardDistance(null);
        }, 10000);
      }
    }
  }, [userLocation, nearbyLandmarks, checkProximity]);

  const createLandmarkPopup = useCallback((
    landmark: Landmark,
    photos: any[] = []
  ): mapboxgl.Popup => {
    console.log(`🗺️ Creating popup for ${landmark.name} with ${photos.length} photos`);
    
    const bestPhoto = photos.length > 0 ? photos[0] : null;
    const imageUrl = bestPhoto?.urls?.medium || bestPhoto?.urls?.large || bestPhoto?.urls?.thumb || '';
    
    const popupContent = `
      <div class="landmark-popup" style="min-width: 250px; max-width: 300px;">
        ${imageUrl ? `
          <div style="width: 100%; height: 150px; margin-bottom: 10px; border-radius: 8px; overflow: hidden;">
            <img 
              src="${imageUrl}" 
              alt="${landmark.name}"
              style="width: 100%; height: 100%; object-fit: cover;"
              onerror="this.style.display='none'"
            />
          </div>
        ` : ''}
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937;">
          ${landmark.name}
        </h3>
        ${landmark.description ? `
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; line-height: 1.4;">
            ${landmark.description}
          </p>
        ` : ''}
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <button 
            onclick="window.dispatchEvent(new CustomEvent('landmarkPopupClick', { detail: ${JSON.stringify(landmark).replace(/"/g, '&quot;')} }))"
            style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: 500;"
            onmouseover="this.style.background='#2563eb'"
            onmouseout="this.style.background='#3b82f6'"
          >
            View Details
          </button>
          ${photos.length > 0 ? `
            <span style="font-size: 12px; color: #9ca3af;">
              📸 ${photos.length} photo${photos.length !== 1 ? 's' : ''}
            </span>
          ` : ''}
        </div>
        ${bestPhoto?.photoSource ? `
          <div style="margin-top: 8px; font-size: 11px; color: #9ca3af;">
            Source: ${bestPhoto.photoSource.replace(/_/g, ' ')}
          </div>
        ` : ''}
      </div>
    `;

    return new mapboxgl.Popup({
      offset: 25,
      closeButton: true,
      closeOnClick: false,
      maxWidth: '300px'
    }).setHTML(popupContent);
  }, []);

  const addLandmarkMarkers = useCallback(async () => {
    if (!mapRef.current) return;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    // Add new markers
    for (const landmark of landmarks) {
      await addLandmarkMarker(landmark);
    }

    // Add smart tour markers
    for (const landmark of smartTourLandmarks) {
      await addLandmarkMarker(landmark, true);
    }
  }, [landmarks, smartTourLandmarks, addLandmarkMarker]);

  const addLandmarkMarker = useCallback(async (landmark: Landmark, isSmartTour = false) => {
    if (!mapRef.current) return;

    console.log(`📍 Adding marker for ${landmark.name} (SmartTour: ${isSmartTour})`);
    
    // Set loading state
    setMarkerLoadingState(landmark.id, true);
    
    try {
      // Fetch photos with enhanced system
      const photos = await fetchPhotosWithHook(landmark);
      
      console.log(`📸 Photos loaded for marker ${landmark.name}: ${photos.length} photos`);
      
      // Create popup with photos
      const popup = createLandmarkPopup(landmark, photos);
      
      // Create marker element
      const markerElement = createMarkerElement(isSmartTour, landmark.name);
      
      // Create marker
      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat(landmark.coordinates)
        .setPopup(popup)
        .addTo(mapRef.current);

      // Store marker reference
      markersRef.current.set(landmark.id, marker);
      
      console.log(`✅ Marker added successfully for ${landmark.name}`);
      
    } catch (error) {
      console.error(`❌ Failed to add marker for ${landmark.name}:`, error);
    } finally {
      // Clear loading state
      setMarkerLoadingState(landmark.id, false);
    }
  }, [fetchPhotosWithHook, createLandmarkPopup, setMarkerLoadingState]);

  useEffect(() => {
    if (map && isMapLoaded) {
      addLandmarkMarkers();
    }
  }, [map, landmarks, smartTourLandmarks, addLandmarkMarkers, isMapLoaded]);

  useEffect(() => {
    const handleLandmarkPopupClick = (event: any) => {
      const landmark = event.detail;
      console.log('📍 Landmark popup clicked', landmark);
      onLandmarkClick(landmark);
    };

    window.addEventListener('landmarkPopupClick', handleLandmarkPopupClick);

    return () => {
      window.removeEventListener('landmarkPopupClick', handleLandmarkPopupClick);
    };
  }, [onLandmarkClick]);

  const handleCloseProximityCard = () => {
    setProximityCardLandmark(null);
    setProximityCardDistance(null);
  };

  const handleViewProximityDetails = (landmark: Landmark) => {
    onLandmarkClick(landmark);
    handleCloseProximityCard();
  };

  const toggleDebugMarkers = () => {
    setShowDebugMarkers(!showDebugMarkers);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
      ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  };

  const deg2rad = (deg: number): number => {
    return deg * (Math.PI / 180)
  };

  return (
    <div className="relative w-full h-full">
      <div 
        ref={mapContainerRef} 
        className="w-full h-full" 
        style={{ minHeight: '400px' }}
      />
      
      {/* Debug markers */}
      {showDebugMarkers && userLocation && (
        <div className="absolute top-40 left-4">
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2">Debug Markers</h3>
            <p>User Location: {userLocation.latitude}, {userLocation.longitude}</p>
            <p>Nearby Landmarks: {nearbyLandmarks.length}</p>
            {nearbyLandmarks.map((landmark) => (
              <div key={landmark.id} className="mb-2">
                <p>{landmark.name}</p>
                <p>Distance: {calculateDistance(
                  userLocation.latitude,
                  userLocation.longitude,
                  landmark.coordinates[1],
                  landmark.coordinates[0]
                ).toFixed(2)} km</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Map controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm shadow-lg"
          onClick={() => {
            if (mapRef.current && userLocation) {
              mapRef.current.flyTo({
                center: [userLocation.longitude, userLocation.latitude],
                zoom: 15,
                duration: 1000
              });
            }
          }}
        >
          <Navigation className="h-4 w-4" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm shadow-lg"
          onClick={() => {
            if (mapRef.current) {
              const currentStyle = mapRef.current.getStyle().name;
              const newStyle = currentStyle === 'Mapbox Streets' 
                ? 'mapbox://styles/mapbox/satellite-v9'
                : 'mapbox://styles/mapbox/streets-v11';
              mapRef.current.setStyle(newStyle);
            }
          }}
        >
          <Layers className="h-4 w-4" />
        </Button>
      </div>

      {/* Location error */}
      {locationError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white p-2 rounded shadow-md">
          Error: {locationError}
        </div>
      )}

      {/* Pending destination indicator */}
      {pendingDestination && (
        <div className="absolute top-4 left-4 bg-blue-500 text-white p-2 rounded shadow-md">
          Navigating to: {pendingDestination.name}
        </div>
      )}
      
      {/* Proximity card */}
      {proximityCardLandmark && (
        <FloatingProximityCard
          landmark={proximityCardLandmark}
          distance={proximityCardDistance}
          onClose={handleCloseProximityCard}
          onViewDetails={handleViewProximityDetails}
        />
      )}
    </div>
  );
};

export default Map;
