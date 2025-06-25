
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Landmark } from '@/data/landmarks';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { TOUR_LANDMARKS, setMapMarkersRef } from '@/data/tourLandmarks';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useStreetView } from '@/hooks/useStreetView';
import { useStreetViewNavigation } from '@/hooks/useStreetViewNavigation';
import { useEnhancedStreetView } from '@/hooks/useEnhancedStreetView';
import { useMapEventHandlers } from '@/hooks/useMapEventHandlers';
import { usePopupManager } from '@/hooks/usePopupManager';
import { useRouteManager } from '@/hooks/useRouteManager';
import EnhancedStreetViewModal from './EnhancedStreetViewModal';
import MapContainer from './map/MapContainer';
import MarkerManager from './map/MarkerManager';
import LocationManager from './map/LocationManager';

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
  plannedLandmarks: Landmark[];
}

const Map: React.FC<MapProps> = ({ 
  mapboxToken, 
  landmarks, 
  onSelectLandmark, 
  selectedLandmark, 
  plannedLandmarks
}) => {
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const photoPopups = useRef<{ [key: string]: mapboxgl.Popup }>({});
  const [playingAudio, setPlayingAudio] = useState<{ [key: string]: boolean }>({});
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const processedPlannedLandmarks = useRef<string[]>([]);
  
  const { user } = useAuth();
  
  // Street View hooks
  const { getCachedData } = useStreetView();
  const { getStreetViewWithOfflineSupport } = useEnhancedStreetView();
  const { 
    openStreetViewModal, 
    closeStreetViewModal, 
    isModalOpen, 
    streetViewItems, 
    currentIndex,
    navigateNext,
    navigatePrevious 
  } = useStreetViewNavigation();

  // Custom hooks for popup and route management
  const { showLandmarkPopup, stopCurrentAudio } = usePopupManager({
    map: map.current,
    photoPopupsRef: photoPopups,
    currentAudio,
    playingAudio,
    setPlayingAudio,
    onStreetViewOpen: handleStreetViewOpen
  });

  const { showRouteOnMap, clearRoute, navigateToCoordinates } = useRouteManager({
    map: map.current
  });

  // Convert top landmarks and tour landmarks to Landmark format
  const allLandmarksWithTop = React.useMemo(() => {
    const topLandmarksConverted: Landmark[] = TOP_LANDMARKS.map((topLandmark, index) => ({
      id: `top-landmark-${index}`,
      name: topLandmark.name,
      coordinates: topLandmark.coordinates,
      description: topLandmark.description
    }));
    
    const tourLandmarksConverted: Landmark[] = TOUR_LANDMARKS.map((tourLandmark, index) => ({
      id: `tour-landmark-${index}`,
      name: tourLandmark.name,
      coordinates: tourLandmark.coordinates,
      description: tourLandmark.description
    }));
    
    return [...landmarks, ...topLandmarksConverted, ...tourLandmarksConverted];
  }, [landmarks]);

  // Map event handlers
  const { setupMapEventListeners, setPendingPopupLandmark, setIsZooming } = useMapEventHandlers({
    onMapClick: (e) => {
      const clickedElement = e.originalEvent.target as HTMLElement;
      const isMarkerClick = clickedElement.closest('.w-4.h-4.rounded-full') || clickedElement.closest('.w-6.h-6.rounded-full');
      
      if (!isMarkerClick) {
        // Stop any playing audio and clear routes/popups
        if (currentAudio.current) {
          currentAudio.current.pause();
          currentAudio.current.currentTime = 0;
          currentAudio.current = null;
        }
        setPlayingAudio({});
        
        Object.values(photoPopups.current).forEach(popup => popup.remove());
        photoPopups.current = {};
        
        const mapboxPopups = document.querySelectorAll('.mapboxgl-popup');
        mapboxPopups.forEach(popup => popup.remove());
      }
    },
    onMoveEnd: () => {
      // Handle pending popup after zoom
    }
  });

  const handleMapReady = useCallback((mapInstance: mapboxgl.Map) => {
    console.log('🗺️ [Map] Map ready, setting up...');
    map.current = mapInstance;
    
    // Set the markers reference for tour landmarks management
    setMapMarkersRef(markers, photoPopups);
    
    // Setup event listeners
    const cleanup = setupMapEventListeners(mapInstance);
    
    return cleanup;
  }, [setupMapEventListeners]);

  // Function to handle marker clicks
  const handleMarkerClick = useCallback(async (landmark: Landmark) => {
    console.log('🗺️ [Map] Marker clicked:', landmark.name);
    
    // Check current zoom level and zoom in if needed
    const currentZoom = map.current?.getZoom() || 1.5;
    if (currentZoom < 10) {
      setIsZooming(true);
      setPendingPopupLandmark(landmark);
      map.current?.flyTo({
        center: landmark.coordinates,
        zoom: 14,
        speed: 0.7,
        curve: 1,
        easing: (t) => t,
      });
    } else {
      // Show popup immediately for marker clicks when already zoomed
      await showLandmarkPopupWithStreetView(landmark);
    }
    
    onSelectLandmark(landmark);
  }, [onSelectLandmark, setIsZooming, setPendingPopupLandmark, showLandmarkPopup]);

  // Function to check Street View availability and show popup
  const showLandmarkPopupWithStreetView = useCallback(async (landmark: Landmark) => {
    console.log('🔍 [Map] Checking Street View for:', landmark.name);
    
    const streetViewDataFromCache = getCachedData(landmark.id);
    let streetViewDataFromEnhanced = null;
    
    try {
      streetViewDataFromEnhanced = await getStreetViewWithOfflineSupport(landmark);
    } catch (error) {
      console.log('❌ Error getting Street View:', error);
    }
    
    const hasStreetView = streetViewDataFromCache !== null || streetViewDataFromEnhanced !== null;
    console.log('👁️ Has Street View available:', hasStreetView);
    
    // Store interaction
    await storeMapMarkerInteraction(landmark);
    
    // Show popup with Street View availability
    await showLandmarkPopup(landmark, hasStreetView);
  }, [getCachedData, getStreetViewWithOfflineSupport, showLandmarkPopup]);

  // Function to store map marker interaction
  const storeMapMarkerInteraction = async (landmark: Landmark, imageUrl?: string) => {
    if (!user) return;

    try {
      console.log('Storing map marker interaction for:', landmark.name);
      
      const { error } = await supabase.functions.invoke('store-interaction', {
        body: {
          userInput: `Clicked on map marker: ${landmark.name}`,
          assistantResponse: landmark.description,
          destination: 'Map',
          interactionType: 'map_marker',
          landmarkCoordinates: landmark.coordinates,
          landmarkImageUrl: imageUrl
        }
      });

      if (error) {
        console.error('Error storing map marker interaction:', error);
      }
    } catch (error) {
      console.error('Error storing map marker interaction:', error);
    }
  };

  // Function to handle Street View opening
  function handleStreetViewOpen(landmarkId: string) {
    console.log('🔍 [Map] Opening Street View for landmark ID:', landmarkId);
    const targetLandmark = allLandmarksWithTop.find(l => l.id === landmarkId);
    
    if (targetLandmark) {
      console.log(`🔍 Opening Street View modal for ${targetLandmark.name}`);
      openStreetViewModal([targetLandmark], targetLandmark);
    }
  }

  // Function to handle text-to-speech
  const handleTextToSpeech = async (landmark: Landmark) => {
    const landmarkId = landmark.id;
    
    if (playingAudio[landmarkId]) return;

    // Stop any currently playing audio
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current.currentTime = 0;
      currentAudio.current = null;
    }
    setPlayingAudio({});

    try {
      setPlayingAudio(prev => ({ ...prev, [landmarkId]: true }));
      const text = `${landmark.name}. ${landmark.description}`;
      
      console.log('Calling Google Cloud TTS for map marker:', text.substring(0, 50) + '...');
      
      const { data, error } = await supabase.functions.invoke('gemini-tts', {
        body: { text }
      });

      if (error) {
        console.error('Google Cloud TTS error:', error);
        return;
      }

      if (data?.audioContent && !data.fallbackToBrowser) {
        console.log('Playing audio from Google Cloud TTS for map marker');
        await playAudioFromBase64(data.audioContent);
      }
      
    } catch (error) {
      console.error('Error with Google Cloud TTS for map marker:', error);
    } finally {
      setPlayingAudio(prev => ({ ...prev, [landmarkId]: false }));
    }
  };

  // Function to play audio from base64
  const playAudioFromBase64 = async (base64Audio: string) => {
    return new Promise<void>((resolve, reject) => {
      try {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        currentAudio.current = audio;
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudio.current = null;
          resolve();
        };
        
        audio.onerror = (error) => {
          URL.revokeObjectURL(audioUrl);
          currentAudio.current = null;
          reject(error);
        };
        
        audio.play().catch(error => {
          URL.revokeObjectURL(audioUrl);
          currentAudio.current = null;
          reject(error);
        });
        
      } catch (error) {
        reject(error);
      }
    });
  };

  // Fly to selected landmark
  useEffect(() => {
    if (map.current && selectedLandmark) {
      console.log('🗺️ [Map] Selected landmark changed:', selectedLandmark.name);
      
      const currentZoom = map.current.getZoom() || 1.5;
      
      if (currentZoom < 10) {
        console.log('🗺️ [Map] Zooming to landmark from search');
        setIsZooming(true);
        setPendingPopupLandmark(selectedLandmark);
        map.current.flyTo({
          center: selectedLandmark.coordinates,
          zoom: 14,
          speed: 0.7,
          curve: 1,
          easing: (t) => t,
        });
      } else {
        map.current.flyTo({
          center: selectedLandmark.coordinates,
          zoom: 14,
          speed: 0.7,
          curve: 1,
          easing: (t) => t,
        });
        
        setTimeout(() => {
          showLandmarkPopupWithStreetView(selectedLandmark);
        }, 500);
      }
    }
  }, [selectedLandmark, setIsZooming, setPendingPopupLandmark, showLandmarkPopupWithStreetView]);

  // Zoom to fit planned landmarks when a new tour is generated
  useEffect(() => {
    if (!map.current || !plannedLandmarks || plannedLandmarks.length === 0) {
      return;
    }

    const currentLandmarkIds = plannedLandmarks.map(landmark => landmark.id).sort();
    const currentLandmarkSignature = currentLandmarkIds.join(',');
    const previousSignature = processedPlannedLandmarks.current.join(',');
    
    if (currentLandmarkSignature === previousSignature) {
      console.log('🗺️ [Map] Planned landmarks unchanged, skipping fly-to animation');
      return;
    }

    console.log('🗺️ [Map] New planned landmarks detected, flying to show tour');
    processedPlannedLandmarks.current = currentLandmarkIds;

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

  // Setup global functions
  useEffect(() => {
    console.log('🗺️ [Map] Setting up global functions');
    
    (window as any).handleLandmarkListen = (landmarkId: string) => {
      const targetLandmark = allLandmarksWithTop.find(l => l.id === landmarkId);
      if (targetLandmark) {
        handleTextToSpeech(targetLandmark);
      }
    };

    (window as any).handlePopupClose = (landmarkId: string) => {
      if (currentAudio.current) {
        currentAudio.current.pause();
        currentAudio.current.currentTime = 0;
        currentAudio.current = null;
      }
      setPlayingAudio({});
      if (photoPopups.current[landmarkId]) {
        delete photoPopups.current[landmarkId];
      }
    };

    (window as any).handleStreetViewOpen = handleStreetViewOpen;

    return () => {
      delete (window as any).handleLandmarkListen;
      delete (window as any).handlePopupClose;
      delete (window as any).handleStreetViewOpen;
    };
  }, [allLandmarksWithTop, handleTextToSpeech]);

  return (
    <>
      <MapContainer mapboxToken={mapboxToken} onMapReady={handleMapReady}>
        <MarkerManager
          map={map.current}
          landmarks={allLandmarksWithTop}
          selectedLandmark={selectedLandmark}
          onMarkerClick={handleMarkerClick}
          markersRef={markers}
        />
        
        <LocationManager map={map.current} user={user} />
      </MapContainer>
      
      <EnhancedStreetViewModal
        isOpen={isModalOpen}
        onClose={closeStreetViewModal}
        streetViewItems={streetViewItems}
        initialIndex={currentIndex}
        onLocationSelect={(coordinates) => {
          // Handle location selection if needed
          closeStreetViewModal();
        }}
      />
    </>
  );
};

export default Map;
