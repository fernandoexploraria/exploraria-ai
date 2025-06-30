import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Landmark } from '@/data/landmarks';
import { TourLandmark } from '@/data/tourLandmarks';
import { useMap } from '@/hooks/useMap';
import { useIsMobile } from '@/hooks/use-mobile';

interface MapProps {
  mapboxToken: string;
  allLandmarks: Landmark[];
  selectedLandmark: Landmark | null;
  smartTourLandmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
}

const Map: React.FC<MapProps> = ({
  mapboxToken,
  allLandmarks,
  selectedLandmark,
  smartTourLandmarks,
  onSelectLandmark,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const map = useMap(mapContainerRef);
  const [initialLoad, setInitialLoad] = useState(true);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const photoPopupsRef = useRef<{ [key: string]: mapboxgl.Popup }>({});
  const pendingPopupLandmark = useRef<Landmark | null>(null);
  const isZooming = useRef<boolean>(false);
  const isMobile = useIsMobile();

  // Fly to landmark function
  const flyToLandmark = useCallback((landmark: Landmark, zoomLevel: number = 16) => {
    if (!map.current) return;

    console.log('✈️ Flying to landmark:', landmark.name, 'Zoom:', zoomLevel);
    isZooming.current = true; // Set the zooming flag

    map.current.flyTo({
      center: landmark.coordinates,
      zoom: zoomLevel,
      duration: 2000,
      essential: true
    });

    // Shorter timeout for mobile
    const delay = isMobile ? 1500 : 2000;

    setTimeout(() => {
      isZooming.current = false; // Clear the zooming flag after the animation
      console.log('✅ Zoom animation complete for:', landmark.name);
      
      // Open popup immediately if no other popup is pending
      if (!pendingPopupLandmark.current) {
        openPhotoPopup(landmark);
      } else {
        console.log('⚠️ Another popup is pending, delaying popup for:', landmark.name);
      }
    }, delay);
  }, [map, isMobile]);

  // Open photo popup function
  const openPhotoPopup = useCallback((landmark: Landmark) => {
    if (!map.current) return;

    // Check if already zooming, if so, delay the popup
    if (isZooming.current) {
      console.log('⚠️ Map is currently zooming, delaying popup for:', landmark.name);
      pendingPopupLandmark.current = landmark;
      return;
    }

    // Check if a popup is already open
    if (pendingPopupLandmark.current) {
      console.log('⚠️ Another popup is already open, delaying popup for:', landmark.name);
      return;
    }

    pendingPopupLandmark.current = landmark;

    // Define popup content
    const popupContent = document.createElement('div');
    popupContent.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <h3 style="font-size: 1.2em; margin-bottom: 0.5em;">${landmark.name}</h3>
        ${landmark.photos && landmark.photos.length > 0
        ? `<img src="${landmark.photos[0]}" alt="${landmark.name}" style="max-width: 200px; max-height: 150px; margin-bottom: 0.5em; border-radius: 8px; object-fit: cover;">`
        : ''}
        <p style="font-size: 0.9em; color: #555; margin-bottom: 0.5em;">${landmark.description}</p>
        ${landmark.formattedAddress ? `<p style="font-size: 0.8em; color: #777;">${landmark.formattedAddress}</p>` : ''}
      </div>
    `;

    // Create popup
    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      anchor: 'bottom',
      maxWidth: '300px'
    })
      .setLngLat(landmark.coordinates)
      .setDOMContent(popupContent)
      .addTo(map.current);

    // Store popup
    const popupId = `photo-popup-${landmark.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
    photoPopupsRef.current[popupId] = popup;

    // Set popup open callback
    popup.on('open', () => {
      console.log('ℹ️ Popup opened for:', landmark.name);
    });

    // Set popup close callback
    popup.on('close', () => {
      console.log('ℹ️ Popup closed for:', landmark.name);
      delete photoPopupsRef.current[popupId];
      pendingPopupLandmark.current = null;
    });

    console.log('✅ Photo popup opened for:', landmark.name);
  }, [map]);

  // Handler for landmark selection
  const handleLandmarkSelect = useCallback((landmark: Landmark) => {
    console.log('📍 Landmark selected:', landmark.name);
    onSelectLandmark(landmark);
    flyToLandmark(landmark);
  }, [onSelectLandmark, flyToLandmark]);

  // Initialize map
  useEffect(() => {
    if (!mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    if (!map.current) {
      console.log('🗺️ Initializing map...');
      map.initialize();
    }

    return () => {
      if (map.current) {
        console.log('🧹 Cleaning up map...');
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken, map]);

  // Effect for initial map load
  useEffect(() => {
    if (!map.current) return;

    const handleMapLoad = () => {
      console.log('🗺️ Map loaded successfully');
      setInitialLoad(false);
    };

    map.current.on('load', handleMapLoad);

    return () => {
      if (map.current) {
        map.current.off('load', handleMapLoad);
      }
    };
  }, [map]);

  // Effect for all landmarks
  useEffect(() => {
    if (!map.current || initialLoad) return;

    console.log('📍 Adding all landmarks:', allLandmarks.length);

    // Create markers
    allLandmarks.forEach(landmark => {
      const marker = new mapboxgl.Marker()
        .setLngLat(landmark.coordinates)
        .addTo(map.current);

      // Marker click handler
      marker.getElement().addEventListener('click', () => {
        handleLandmarkSelect(landmark);
      });
    });
  }, [allLandmarks, handleLandmarkSelect, initialLoad, map]);

  // Effect for selected landmark
  useEffect(() => {
    if (!map.current || !selectedLandmark) return;

    console.log('📍 Selected landmark changed:', selectedLandmark.name);
    flyToLandmark(selectedLandmark);
  }, [selectedLandmark, flyToLandmark, map]);

  // Enhanced effect for planned landmarks with popup state cleanup
  useEffect(() => {
    if (!map.current || !plannedLandmarks || plannedLandmarks.length === 0) return;

    console.log('🗺️ Enhanced planned landmarks effect triggered with', plannedLandmarks.length, 'landmarks');
    
    // Clear pending popup state to prevent interference with voice agent
    pendingPopupLandmark.current = null;
    isZooming.current = false;
    console.log('🧹 Cleared pending popup state for new tour');

    // Enhanced cleanup of existing tour markers
    if (markersRef.current) {
      Object.keys(markersRef.current).forEach(markerId => {
        if (markerId.startsWith('tour-landmark-')) {
          console.log('🗑️ Removing existing tour marker:', markerId);
          try {
            markersRef.current[markerId].remove();
            delete markersRef.current[markerId];
          } catch (error) {
            console.warn('⚠️ Error removing tour marker:', markerId, error);
          }
        }
      });
    }

    // Enhanced cleanup of existing popups
    if (photoPopupsRef.current) {
      Object.keys(photoPopupsRef.current).forEach(popupId => {
        if (popupId.startsWith('tour-landmark-')) {
          console.log('🗑️ Removing existing tour popup:', popupId);
          try {
            photoPopupsRef.current[popupId].remove();
            delete photoPopupsRef.current[popupId];
          } catch (error) {
            console.warn('⚠️ Error removing tour popup:', popupId, error);
          }
        }
      });
    }

    // Create bounds and add markers
    const bounds = new mapboxgl.LngLatBounds();
    const newMarkers: { [key: string]: mapboxgl.Marker } = {};

    plannedLandmarks.forEach((landmark, index) => {
      const coordinates = landmark.coordinates;
      if (!coordinates || coordinates.length !== 2 || 
          isNaN(coordinates[0]) || isNaN(coordinates[1])) {
        console.warn('⚠️ Invalid coordinates for landmark:', landmark.name, coordinates);
        return;
      }

      console.log(`📍 Adding Enhanced Smart Tour marker ${index + 1}:`, landmark.name, coordinates);

      // Create marker element
      const markerElement = document.createElement('div');
      markerElement.className = 'tour-landmark-marker';
      markerElement.style.cssText = `
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        border: 3px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        transition: all 0.3s ease;
        animation: tourMarkerPulse 2s infinite;
      `;
      markerElement.textContent = (index + 1).toString();

      // Create marker
      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat(coordinates)
        .addTo(map.current);

      // Store marker with enhanced ID
      const markerId = `tour-landmark-${landmark.name.replace(/[^a-zA-Z0-9]/g, '-')}-${index}`;
      newMarkers[markerId] = marker;
      
      // Add marker click handler
      markerElement.addEventListener('click', () => {
        console.log('🎯 Enhanced Smart Tour marker clicked:', landmark.name);
        handleLandmarkSelect(landmark);
      });

      // Extend bounds
      bounds.extend(coordinates);
    });

    // Update markers ref
    Object.assign(markersRef.current, newMarkers);

    // Enhanced camera animation for tour landmarks
    if (plannedLandmarks.length > 0) {
      console.log('🎬 Flying to Enhanced Smart Tour landmarks with camera animation');
      
      const padding = { top: 80, bottom: 80, left: 80, right: 80 };
      
      map.current.fitBounds(bounds, {
        padding,
        duration: 2000,
        essential: true
      });
    }

    console.log('✅ Enhanced Smart Tour landmarks effect completed');
  }, [plannedLandmarks, handleLandmarkSelect]);

  const plannedLandmarks: TourLandmark[] = smartTourLandmarks.map(landmark => ({
    ...landmark,
    coordinates: landmark.coordinates as [number, number]
  }));

  return <div ref={mapContainerRef} className="map-container" style={{ height: '100vh' }} />;
};

export default Map;
