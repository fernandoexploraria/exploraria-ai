import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Landmark } from '@/data/landmarks';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { useGoogleTextToSpeech } from './voice-assistant/useGoogleTextToSpeech';
import { useLandmarkImage } from './map/useLandmarkImage';
import { LandmarkPopupHandler } from './map/LandmarkPopupHandler';
import { useMarkerManager } from './map/useMarkerManager';

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
  plannedLandmarks: Landmark[];
}

const Map: React.FC<MapProps> = ({ mapboxToken, landmarks, onSelectLandmark, selectedLandmark, plannedLandmarks }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<{ [key: string]: boolean }>({});
  const pendingPopupLandmark = useRef<Landmark | null>(null);
  const isZooming = useRef<boolean>(false);
  const popupHandler = useRef<LandmarkPopupHandler | null>(null);

  // Use Google Cloud TTS hook
  const { isSpeaking, speakText } = useGoogleTextToSpeech();
  
  // Use landmark image fetcher
  const { fetchLandmarkImage } = useLandmarkImage();

  // Convert top landmarks to Landmark format
  const allLandmarksWithTop = React.useMemo(() => {
    const topLandmarksConverted: Landmark[] = TOP_LANDMARKS.map((topLandmark, index) => ({
      id: `top-landmark-${index}`,
      name: topLandmark.name,
      coordinates: topLandmark.coordinates,
      description: topLandmark.description
    }));
    
    return [...landmarks, ...topLandmarksConverted];
  }, [landmarks]);

  const handleMarkerClick = React.useCallback(async (landmark: Landmark) => {
    console.log('Marker clicked:', landmark.name);
    
    // Check current zoom level and zoom in if needed
    const currentZoom = map.current?.getZoom() || 1.5;
    if (currentZoom < 10) {
      isZooming.current = true;
      pendingPopupLandmark.current = landmark;
      map.current?.flyTo({
        center: landmark.coordinates,
        zoom: 14,
        speed: 0.7,
        curve: 1,
        easing: (t) => t,
      });
    } else {
      // Show popup immediately for marker clicks when already zoomed
      popupHandler.current?.showLandmarkPopup(landmark);
    }
    
    // Call the landmark selection handler to update the selected landmark
    onSelectLandmark(landmark);
  }, [onSelectLandmark]);

  // Use marker manager - only when map is loaded
  useMarkerManager({
    map: mapLoaded ? map.current : null,
    landmarks: allLandmarksWithTop,
    selectedLandmark,
    onMarkerClick: handleMarkerClick
  });

  // Function to handle text-to-speech using Google Cloud TTS
  const handleTextToSpeech = React.useCallback(async (landmark: Landmark) => {
    const landmarkId = landmark.id;
    
    if (playingAudio[landmarkId] || isSpeaking) {
      return; // Already playing
    }

    try {
      setPlayingAudio(prev => ({ ...prev, [landmarkId]: true }));
      const text = `${landmark.name}. ${landmark.description}`;
      await speakText(text);
    } catch (error) {
      console.error('Error with Google Cloud TTS:', error);
    } finally {
      setPlayingAudio(prev => ({ ...prev, [landmarkId]: false }));
    }
  }, [playingAudio, isSpeaking, speakText]);

  // Initialize map (runs once)
  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || map.current) return;

    console.log('Initializing map with token:', mapboxToken.substring(0, 20) + '...');
    
    mapboxgl.accessToken = mapboxToken;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      projection: { name: 'globe' },
      zoom: 1.5,
      center: [0, 20],
    });

    map.current.on('style.load', () => {
      console.log('Map style loaded');
      map.current?.setFog({}); // Add a sky layer and atmosphere
    });

    map.current.on('load', () => {
      console.log('Map fully loaded');
      setMapLoaded(true);
    });

    // Close all popups when clicking on the map
    map.current.on('click', (e) => {
      const clickedElement = e.originalEvent.target as HTMLElement;
      const isMarkerClick = clickedElement.closest('.w-4.h-4.rounded-full');
      
      if (!isMarkerClick && popupHandler.current) {
        popupHandler.current.closeAllPopups();
        
        // Also close any Mapbox popups that might be open
        const mapboxPopups = document.querySelectorAll('.mapboxgl-popup');
        mapboxPopups.forEach(popup => {
          popup.remove();
        });
      }
    });

    // Handle moveend event to show popup after zoom completes
    map.current.on('moveend', () => {
      if (pendingPopupLandmark.current && isZooming.current && popupHandler.current) {
        const landmark = pendingPopupLandmark.current;
        pendingPopupLandmark.current = null;
        isZooming.current = false;
        
        // Small delay to ensure zoom animation is fully complete
        setTimeout(() => {
          popupHandler.current?.showLandmarkPopup(landmark);
        }, 100);
      }
    });

    return () => {
      console.log('Cleaning up map');
      map.current?.remove();
      map.current = null;
      setMapLoaded(false);
    };
  }, [mapboxToken]);

  // Initialize popup handler
  useEffect(() => {
    if (map.current) {
      popupHandler.current = new LandmarkPopupHandler(
        map.current,
        fetchLandmarkImage,
        allLandmarksWithTop,
        isSpeaking
      );
    }
  }, [fetchLandmarkImage, allLandmarksWithTop, isSpeaking]);

  // Update popup handler state
  useEffect(() => {
    if (popupHandler.current) {
      popupHandler.current.updateState(playingAudio, isSpeaking);
    }
  }, [playingAudio, isSpeaking]);

  // Set up global handler for landmark text-to-speech
  useEffect(() => {
    (window as any).handleLandmarkTextToSpeech = handleTextToSpeech;
    return () => {
      delete (window as any).handleLandmarkTextToSpeech;
    };
  }, [handleTextToSpeech]);

  // Fly to selected landmark
  useEffect(() => {
    if (map.current && selectedLandmark) {
      console.log('Selected landmark changed:', selectedLandmark.name);
      
      const currentZoom = map.current.getZoom() || 1.5;
      
      // Always zoom and show popup for search selections
      if (currentZoom < 10) {
        console.log('Zooming to landmark from search');
        isZooming.current = true;
        pendingPopupLandmark.current = selectedLandmark;
        map.current.flyTo({
          center: selectedLandmark.coordinates,
          zoom: 14,
          speed: 0.7,
          curve: 1,
          easing: (t) => t,
        });
      } else {
        // If already zoomed in, just fly to the new location and show popup
        console.log('Flying to landmark and showing popup');
        map.current.flyTo({
          center: selectedLandmark.coordinates,
          zoom: 14,
          speed: 0.7,
          curve: 1,
          easing: (t) => t,
        });
        
        // Show popup after a short delay
        setTimeout(() => {
          popupHandler.current?.showLandmarkPopup(selectedLandmark);
        }, 500);
      }
    }
  }, [selectedLandmark]);

  // Zooms to fit planned landmarks when a new tour is generated
  useEffect(() => {
    if (!map.current || !plannedLandmarks || plannedLandmarks.length === 0) {
      return;
    }

    if (plannedLandmarks.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      plannedLandmarks.forEach(landmark => {
        bounds.extend(landmark.coordinates);
      });
      map.current.fitBounds(bounds, {
        padding: 100,
        duration: 2000,
        maxZoom: 15,
      });
    } else if (plannedLandmarks.length === 1) {
      map.current.flyTo({
        center: plannedLandmarks[0].coordinates,
        zoom: 14,
        speed: 0.7,
        curve: 1,
        easing: (t) => t,
      });
    }
  }, [plannedLandmarks]);

  return <div ref={mapContainer} className="absolute inset-0" />;
};

export default Map;
