
import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Volume2, VolumeX, Eye, MapPin } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { TOUR_LANDMARKS, setMapMarkersRef, TourLandmark } from '@/data/tourLandmarks';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useStreetView } from '@/hooks/useStreetView';
import { useStreetViewNavigation } from '@/hooks/useStreetViewNavigation';
import { useEnhancedStreetView } from '@/hooks/useEnhancedStreetView';
import EnhancedStreetViewModal from './EnhancedStreetViewModal';
import { useEnhancedPhotos, PhotoData } from '@/hooks/useEnhancedPhotos';
import EnhancedProgressiveImage from './EnhancedProgressiveImage';
import { PhotoCarousel } from './photo-carousel';
import { generateTourLandmarkId, generateTopLandmarkId } from '@/utils/markerIdUtils';

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
  plannedLandmarks: Landmark[];
}

const GOOGLE_API_KEY = 'AIzaSyCjQKg2W9uIrIx4EmRnyf3WCkO4eeEvpyg';

const Map: React.FC<MapProps> = ({ 
  mapboxToken, 
  landmarks, 
  onSelectLandmark, 
  selectedLandmark, 
  plannedLandmarks
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const imageCache = useRef<{ [key: string]: string }>({});
  const enhancedPhotosCache = useRef<{ [key: string]: PhotoData[] }>({});
  const photoPopups = useRef<{ [key: string]: mapboxgl.Popup }>({});
  const [playingAudio, setPlayingAudio] = useState<{ [key: string]: boolean }>({});
  const pendingPopupLandmark = useRef<Landmark | null>(null);
  const isZooming = useRef<boolean>(false);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const navigationMarkers = useRef<{ marker: mapboxgl.Marker; interaction: any }[]>([]);
  const currentRouteLayer = useRef<string | null>(null);
  
  const [tourLandmarks, setTourLandmarks] = useState<TourLandmark[]>([]);
  
  const geolocateControl = useRef<mapboxgl.GeolocateControl | null>(null);
  const isUpdatingFromProximitySettings = useRef<boolean>(false);
  const userInitiatedLocationRequest = useRef<boolean>(false);
  const lastLocationEventTime = useRef<number>(0);
  
  const processedPlannedLandmarks = useRef<string[]>([]);
  
  const { user } = useAuth();
  const { updateProximityEnabled, proximitySettings } = useProximityAlerts();
  const { fetchPhotos } = useEnhancedPhotos();
  
  const { getCachedData } = useStreetView();
  const { getStreetViewWithOfflineSupport } = useEnhancedStreetView();
  const { 
    openStreetViewModal, 
    closeStreetViewModal, 
    isModalOpen, 
    streetViewItems, 
    currentIndex,
    navigateToIndex,
    navigateNext,
    navigatePrevious 
  } = useStreetViewNavigation();

  useEffect(() => {
    console.log('🔄 Syncing tour landmarks state:', TOUR_LANDMARKS.length);
    setTourLandmarks([...TOUR_LANDMARKS]);
  }, [TOUR_LANDMARKS.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (TOUR_LANDMARKS.length !== tourLandmarks.length) {
        console.log('🔄 Detected tour landmarks change via polling:', TOUR_LANDMARKS.length);
        setTourLandmarks([...TOUR_LANDMARKS]);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [tourLandmarks.length]);

  const allLandmarksWithTop = React.useMemo(() => {
    console.log('🗺️ Rebuilding landmarks list:', {
      baseLandmarks: landmarks.length,
      topLandmarks: TOP_LANDMARKS.length,
      tourLandmarks: tourLandmarks.length
    });
    
    const topLandmarksConverted: Landmark[] = TOP_LANDMARKS.map((topLandmark, index) => ({
      id: generateTopLandmarkId(index),
      name: topLandmark.name,
      coordinates: topLandmark.coordinates,
      description: topLandmark.description
    }));
    
    const tourLandmarksConverted: Landmark[] = tourLandmarks.map((tourLandmark, index) => ({
      id: generateTourLandmarkId(index),
      name: tourLandmark.name,
      coordinates: tourLandmark.coordinates,
      description: tourLandmark.description
    }));
    
    const result = [...landmarks, ...topLandmarksConverted, ...tourLandmarksConverted];
    console.log('🗺️ Total landmarks for map:', result.length);
    return result;
  }, [landmarks, tourLandmarks]);

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-74.006, 40.7128],
      zoom: 11,
      pitch: 45,
      bearing: 0
    });

    // Set markers reference for cleanup
    setMapMarkersRef(markers, photoPopups);

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add geolocate control
    geolocateControl.current = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });

    map.current.addControl(geolocateControl.current);

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [mapboxToken]);

  // Add markers for all landmarks
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    Object.values(markers.current).forEach(marker => marker.remove());
    markers.current = {};

    // Add markers for all landmarks
    allLandmarksWithTop.forEach((landmark) => {
      const el = document.createElement('div');
      el.className = 'marker';
      
      // Different colors for different landmark types
      let backgroundColor = '#3b82f6'; // Default blue
      if (landmark.id.startsWith('top-landmark-')) {
        backgroundColor = '#ef4444'; // Red for top landmarks
      } else if (landmark.id.startsWith('tour-landmark-')) {
        backgroundColor = '#22c55e'; // Green for tour landmarks
      }
      
      el.style.cssText = `
        background-color: ${backgroundColor};
        width: 20px;
        height: 20px;
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;

      const marker = new mapboxgl.Marker(el)
        .setLngLat(landmark.coordinates)
        .addTo(map.current!);

      // Add click event
      el.addEventListener('click', () => {
        onSelectLandmark(landmark);
      });

      markers.current[landmark.id] = marker;
    });
  }, [allLandmarksWithTop, onSelectLandmark]);

  // Handle selected landmark
  useEffect(() => {
    if (!map.current || !selectedLandmark) return;

    // Fly to selected landmark
    map.current.flyTo({
      center: selectedLandmark.coordinates,
      zoom: 15,
      duration: 2000
    });
  }, [selectedLandmark]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {isModalOpen && (
        <EnhancedStreetViewModal
          isOpen={isModalOpen}
          onClose={closeStreetViewModal}
          streetViewItems={streetViewItems}
          currentIndex={currentIndex}
          onNavigateToIndex={navigateToIndex}
          onNavigateNext={navigateNext}
          onNavigatePrevious={navigatePrevious}
        />
      )}
    </div>
  );
};

export default Map;
