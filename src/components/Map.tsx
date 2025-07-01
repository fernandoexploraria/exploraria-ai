
import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Landmark } from '@/data/landmarks';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import FloatingProximityCard from './FloatingProximityCard';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useStreetView } from '@/hooks/useStreetView';
import StreetViewModal from './StreetViewModal';
import StreetViewThumbnailGrid from './StreetViewThumbnailGrid';
import { useEnhancedPhotos, PhotoData } from '@/hooks/useEnhancedPhotos';
import { useLandmarkPhotos } from '@/hooks/useLandmarkPhotos';
import PhotoCarousel from './photo-carousel/PhotoCarousel';
import EnhancedLandmarkInfo from './EnhancedLandmarkInfo';
import { toast } from 'sonner';

interface MapProps {
  landmarks: Landmark[];
  userLocation: [number, number] | null;
  showUserLocation?: boolean;
  onLandmarkSelect?: (landmark: Landmark) => void;
  smartTourLandmarks?: Landmark[];
  tourDetails: any;
}

interface ProximityAlert {
  landmark: Landmark;
  distance: number;
}

const PROXIMITY_THRESHOLD = 50; // meters
const DEFAULT_MAP_CENTER: [number, number] = [-122.4194, 37.7749]; // San Francisco

const Map: React.FC<MapProps> = ({ 
  landmarks, 
  userLocation, 
  showUserLocation = true, 
  onLandmarkSelect,
  smartTourLandmarks = [],
  tourDetails = null
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const landmarkMarkers = useRef<mapboxgl.Marker[]>([]);
  const selectedPopup = useRef<mapboxgl.Popup | null>(null);
  const enhancedPhotosCache = useRef<Map<string, PhotoData[]>>(new Map());
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);
  const [isStreetViewModalOpen, setIsStreetViewModalOpen] = useState(false);
  const [selectedLandmarkForStreetView, setSelectedLandmarkForStreetView] = useState<Landmark | null>(null);
  const [streetViewImages, setStreetViewImages] = useState<string[]>([]);
  const [isStreetViewGridOpen, setIsStreetViewGridOpen] = useState(false);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);

  const mapboxToken = useMapboxToken();
  const { startTracking, stopTracking, userLocation: currentLocation, error: locationError } = useLocationTracking();
  const proximityAlertsHook = useProximityAlerts();
  const { fetchStreetView } = useStreetView();

  const { fetchLandmarkPhotos: fetchLandmarkPhotosHook } = useLandmarkPhotos();

  // Enhanced fetchLandmarkPhotos with database-first approach and performance logging
  const fetchLandmarkPhotos = useCallback(async (landmark: Landmark): Promise<PhotoData[]> => {
    const startTime = performance.now();
    const landmarkKey = landmark.placeId || landmark.name;
    
    // Check cache first
    if (enhancedPhotosCache.current.has(landmarkKey)) {
      const cachedPhotos = enhancedPhotosCache.current.get(landmarkKey)!;
      console.log(`📸 Map: Using cached photos for ${landmark.name} (${cachedPhotos.length} photos)`);
      return cachedPhotos;
    }

    try {
      console.log(`🔍 Map: Fetching photos for landmark: ${landmark.name}`);
      
      // Use database-first approach via useLandmarkPhotos hook
      const result = await fetchLandmarkPhotosHook(landmark, {
        maxWidth: 800,
        quality: 'medium'
      });

      const { photos, sourceUsed, totalPhotos } = result;
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      // Performance logging
      console.log(`✅ Map: Photo fetch complete for ${landmark.name}:`, {
        source: sourceUsed,
        photoCount: totalPhotos,
        responseTimeMs: responseTime,
        qualityDistribution: result.qualityDistribution
      });

      // Performance metrics tracking
      if (sourceUsed.includes('database')) {
        console.log(`🎯 Map: Database hit! Avoided API call for ${landmark.name}`);
      } else {
        console.log(`🌐 Map: API fallback used for ${landmark.name}`);
      }

      // Cache the results
      enhancedPhotosCache.current.set(landmarkKey, photos);
      
      return photos;
    } catch (error) {
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);
      
      console.error(`❌ Map: Error fetching photos for ${landmark.name}:`, error);
      console.log(`⏱️ Map: Failed fetch took ${responseTime}ms`);
      
      // Return empty array on error to maintain compatibility
      return [];
    }
  }, [fetchLandmarkPhotosHook]);

  const createLandmarkPopup = useCallback(async (landmark: Landmark): Promise<mapboxgl.Popup> => {
    const photos = await fetchLandmarkPhotos(landmark);
    
    const popupContent = document.createElement('div');
    popupContent.className = 'popup-content';

    const title = document.createElement('h3');
    title.textContent = landmark.name;
    popupContent.appendChild(title);

    if (photos.length > 0) {
      const carouselContainer = document.createElement('div');
      carouselContainer.className = 'carousel-container';
      
      // Render the PhotoCarousel component to display the photos
      const carousel = React.createElement(PhotoCarousel, {
        photos: photos,
        initialIndex: 0,
        className: 'h-48 rounded-lg',
        showThumbnails: photos.length > 1,
        allowZoom: true
      });

      // Render the React component to a string
      const carouselHTML = renderReactComponentToString(carousel);
      carouselContainer.innerHTML = carouselHTML;
      popupContent.appendChild(carouselContainer);
    } else {
      const noPhotosMessage = document.createElement('p');
      noPhotosMessage.textContent = 'No photos available for this landmark.';
      popupContent.appendChild(noPhotosMessage);
    }

    const infoContainer = document.createElement('div');
    infoContainer.className = 'info-container';

    const enhancedInfo = React.createElement(EnhancedLandmarkInfo, {
      landmark: landmark,
      tourDetails: tourDetails,
      smartTourLandmarks: smartTourLandmarks
    });

    const enhancedInfoHTML = renderReactComponentToString(enhancedInfo);
    infoContainer.innerHTML = enhancedInfoHTML;
    popupContent.appendChild(infoContainer);

    const streetViewButton = document.createElement('button');
    streetViewButton.textContent = 'View Street View';
    streetViewButton.className = 'street-view-button';
    streetViewButton.onclick = () => {
      setSelectedLandmarkForStreetView(landmark);
      setIsStreetViewModalOpen(true);
    };
    popupContent.appendChild(streetViewButton);

    return new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      anchor: 'bottom',
      maxWidth: '320px'
    }).setDOMContent(popupContent);
  }, [fetchLandmarkPhotos, smartTourLandmarks, tourDetails]);

  const addLandmarkMarkers = useCallback(() => {
    if (!map.current) return;

    // Clear existing markers
    landmarkMarkers.current.forEach(marker => marker.remove());
    landmarkMarkers.current = [];

    landmarks.forEach(landmark => {
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.backgroundImage = `url(/icons/landmark-icons/location-pin-static.svg)`;
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.cursor = 'pointer';

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([landmark.coordinates[0], landmark.coordinates[1]])
        .addTo(map.current!);

      el.addEventListener('click', async () => {
        if (selectedPopup.current) {
          selectedPopup.current.remove();
        }
        const popup = await createLandmarkPopup(landmark);
        popup.setLngLat([landmark.coordinates[0], landmark.coordinates[1]]).addTo(map.current!);
        selectedPopup.current = popup;
        setSelectedLandmark(landmark);
        onLandmarkSelect?.(landmark);
      });

      landmarkMarkers.current.push(marker);
    });
  }, [landmarks, createLandmarkPopup, onLandmarkSelect]);

  const updateProximityAlerts = useCallback(() => {
    if (!currentLocation) return;

    // Create proximity alerts based on nearby landmarks
    const newAlerts: ProximityAlert[] = landmarks
      .filter(landmark => {
        const distance = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          landmark.coordinates[1],
          landmark.coordinates[0]
        );
        return distance <= PROXIMITY_THRESHOLD;
      })
      .map(landmark => ({
        landmark,
        distance: calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          landmark.coordinates[1],
          landmark.coordinates[0]
        )
      }));

    setProximityAlerts(newAlerts);

    newAlerts.forEach(alert => {
      toast(`You are near ${alert.landmark.name}!`, { duration: 3000 });
    });
  }, [landmarks, currentLocation]);

  // Helper function to calculate distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2 - lat1) * Math.PI/180;
    const Δλ = (lon2 - lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  useEffect(() => {
    if (mapboxToken) {
      mapboxgl.accessToken = mapboxToken;

      const newMap = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: DEFAULT_MAP_CENTER,
        zoom: 12
      });

      map.current = newMap;

      newMap.on('load', () => {
        setMapLoaded(true);
      });

      newMap.on('moveend', () => {
        if (currentLocation) {
          updateProximityAlerts();
        }
      });

      return () => {
        newMap.remove();
        map.current = null;
      };
    }
  }, [mapboxToken, currentLocation, updateProximityAlerts]);

  useEffect(() => {
    if (mapLoaded) {
      addLandmarkMarkers();
    }
  }, [mapLoaded, addLandmarkMarkers]);

  useEffect(() => {
    if (userLocation && map.current) {
      if (userMarker.current) {
        userMarker.current.setLngLat(userLocation);
      } else {
        const el = document.createElement('div');
        el.className = 'user-marker';
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#3B82F6';
        el.style.border = '2px solid white';

        userMarker.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(userLocation)
          .addTo(map.current);
      }

      map.current.flyTo({
        center: userLocation,
        zoom: 14,
        duration: 2000,
        essential: true
      });
    }
  }, [userLocation, mapLoaded]);

  useEffect(() => {
    if (showUserLocation) {
      startTracking();
    } else {
      stopTracking();
    }
    return () => stopTracking();
  }, [showUserLocation, startTracking, stopTracking]);

  useEffect(() => {
    if (locationError) {
      toast.error(`Location Error: ${locationError}`, { duration: 5000 });
    }
  }, [locationError]);

  useEffect(() => {
    if (selectedLandmarkForStreetView) {
      const fetchImages = async () => {
        const streetViewData = await fetchStreetView(selectedLandmarkForStreetView);
        setStreetViewImages([streetViewData.imageUrl]);
      };
      fetchImages();
    }
  }, [selectedLandmarkForStreetView, fetchStreetView]);

  const renderReactComponentToString = (reactComponent: React.ReactElement): string => {
    const div = document.createElement("div");
    ReactDOM.render(reactComponent, div);
    return div.innerHTML;
  };

  return (
    <>
      <div 
        ref={mapContainer} 
        className="w-full h-full rounded-lg shadow-lg"
        style={{ minHeight: '400px' }}
      />
      {proximityAlerts.map(alert => (
        <FloatingProximityCard
          key={alert.landmark.id}
          landmark={alert.landmark}
          distance={alert.distance}
        />
      ))}

      <StreetViewModal
        isOpen={isStreetViewModalOpen}
        onClose={() => {
          setIsStreetViewModalOpen(false);
          setSelectedLandmarkForStreetView(null);
        }}
        landmark={selectedLandmarkForStreetView}
        streetViewImages={streetViewImages}
        onViewAll={() => {
          setIsStreetViewGridOpen(true);
        }}
      />

      <StreetViewThumbnailGrid
        isOpen={isStreetViewGridOpen}
        onClose={() => setIsStreetViewGridOpen(false)}
        landmark={selectedLandmarkForStreetView}
        streetViewImages={streetViewImages}
      />
    </>
  );
};

export default Map;
