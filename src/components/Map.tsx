
import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Landmark, EnhancedLandmark } from '@/data/landmarks';
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
  const { current: map, initialize, cleanup } = useMap(mapContainerRef);
  const [initialLoad, setInitialLoad] = useState(true);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const photoPopupsRef = useRef<{ [key: string]: mapboxgl.Popup }>({});
  const pendingPopupLandmark = useRef<Landmark | null>(null);
  const isZooming = useRef<boolean>(false);
  const isMobile = useIsMobile();

  // Convert smartTourLandmarks to planned landmarks with proper Landmark interface
  const plannedLandmarks: Landmark[] = smartTourLandmarks.map((landmark, index) => ({
    id: landmark.id || `tour-${index}`,
    name: landmark.name,
    coordinates: landmark.coordinates as [number, number],
    description: landmark.description
  }));

  // Stable callback for landmark selection - only recreate when onSelectLandmark changes
  const handleLandmarkSelect = useCallback((landmark: Landmark) => {
    console.log('📍 Landmark selected:', landmark.name);
    onSelectLandmark(landmark);
    
    if (!map || !map.isStyleLoaded()) {
      console.warn('⚠️ Map not ready for flyTo operation');
      return;
    }

    console.log('✈️ Flying to landmark:', landmark.name);
    isZooming.current = true;

    try {
      map.flyTo({
        center: landmark.coordinates,
        zoom: 16,
        duration: 2000,
        essential: true
      });

      const delay = isMobile ? 1500 : 2000;
      setTimeout(() => {
        isZooming.current = false;
        console.log('✅ Zoom animation complete for:', landmark.name);
        
        if (!pendingPopupLandmark.current) {
          openPhotoPopup(landmark);
        }
      }, delay);
    } catch (error) {
      console.error('⚠️ Error during flyTo:', error);
      isZooming.current = false;
    }
  }, [onSelectLandmark, map, isMobile]);

  // Stable callback for photo popup - only recreate when map changes
  const openPhotoPopup = useCallback((landmark: Landmark) => {
    if (!map || !map.isStyleLoaded()) {
      console.warn('⚠️ Map not ready for popup operation');
      return;
    }

    if (isZooming.current || pendingPopupLandmark.current) {
      console.log('⚠️ Map is busy or popup already pending');
      return;
    }

    pendingPopupLandmark.current = landmark;
    const enhancedLandmark = landmark as EnhancedLandmark;

    try {
      const popupContent = document.createElement('div');
      popupContent.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <h3 style="font-size: 1.2em; margin-bottom: 0.5em;">${landmark.name}</h3>
          ${enhancedLandmark.photos && enhancedLandmark.photos.length > 0
          ? `<img src="${enhancedLandmark.photos[0]}" alt="${landmark.name}" style="max-width: 200px; max-height: 150px; margin-bottom: 0.5em; border-radius: 8px; object-fit: cover;">`
          : ''}
          <p style="font-size: 0.9em; color: #555; margin-bottom: 0.5em;">${landmark.description}</p>
          ${enhancedLandmark.formattedAddress ? `<p style="font-size: 0.8em; color: #777;">${enhancedLandmark.formattedAddress}</p>` : ''}
        </div>
      `;

      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        anchor: 'bottom',
        maxWidth: '300px'
      })
        .setLngLat(landmark.coordinates)
        .setDOMContent(popupContent)
        .addTo(map);

      const popupId = `photo-popup-${landmark.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
      photoPopupsRef.current[popupId] = popup;

      popup.on('close', () => {
        delete photoPopupsRef.current[popupId];
        pendingPopupLandmark.current = null;
      });

      console.log('✅ Photo popup opened for:', landmark.name);
    } catch (error) {
      console.error('⚠️ Error creating popup:', error);
      pendingPopupLandmark.current = null;
    }
  }, [map]);

  // Initialize map with token - only reinitialize when token changes
  useEffect(() => {
    if (!mapboxToken) {
      console.warn('⚠️ No Mapbox token provided');
      return;
    }

    mapboxgl.accessToken = mapboxToken;
    initialize();

    return () => {
      // Clean up markers and popups
      Object.values(markersRef.current).forEach(marker => {
        try {
          marker.remove();
        } catch (error) {
          console.warn('⚠️ Error removing marker:', error);
        }
      });
      markersRef.current = {};

      Object.values(photoPopupsRef.current).forEach(popup => {
        try {
          popup.remove();
        } catch (error) {
          console.warn('⚠️ Error removing popup:', error);
        }
      });
      photoPopupsRef.current = {};

      pendingPopupLandmark.current = null;
      isZooming.current = false;
      cleanup();
    };
  }, [mapboxToken, initialize, cleanup]);

  // Set initial load state when map loads - remove map from dependencies
  useEffect(() => {
    if (!map) return;

    const handleMapLoad = () => {
      console.log('🗺️ Map style loaded');
      setInitialLoad(false);
    };

    if (map.isStyleLoaded()) {
      handleMapLoad();
    } else {
      map.on('load', handleMapLoad);
      return () => map.off('load', handleMapLoad);
    }
  }, [!!map]); // Use boolean conversion to avoid map object in dependencies

  // Add all landmarks markers - only update when landmarks or map readiness changes
  useEffect(() => {
    if (!map || initialLoad || !map.isStyleLoaded()) return;

    console.log('📍 Adding all landmarks:', allLandmarks.length);

    // Clean up existing general markers
    Object.keys(markersRef.current).forEach(markerId => {
      if (!markerId.startsWith('tour-landmark-')) {
        try {
          markersRef.current[markerId].remove();
          delete markersRef.current[markerId];
        } catch (error) {
          console.warn('⚠️ Error removing existing marker:', error);
        }
      }
    });

    // Create new markers
    allLandmarks.forEach((landmark, index) => {
      try {
        const marker = new mapboxgl.Marker()
          .setLngLat(landmark.coordinates)
          .addTo(map);

        marker.getElement().addEventListener('click', () => {
          handleLandmarkSelect(landmark);
        });

        markersRef.current[`landmark-${index}`] = marker;
      } catch (error) {
        console.warn('⚠️ Error creating marker for landmark:', landmark.name, error);
      }
    });
  }, [allLandmarks, handleLandmarkSelect, initialLoad, !!map]);

  // Handle selected landmark changes
  useEffect(() => {
    if (!selectedLandmark) return;
    console.log('📍 Selected landmark changed:', selectedLandmark.name);
    handleLandmarkSelect(selectedLandmark);
  }, [selectedLandmark, handleLandmarkSelect]);

  // Handle planned landmarks (smart tour) - only update when tour landmarks change
  useEffect(() => {
    if (!map || !plannedLandmarks || plannedLandmarks.length === 0) return;

    console.log('🗺️ Adding planned landmarks:', plannedLandmarks.length);
    
    // Clear state
    pendingPopupLandmark.current = null;
    isZooming.current = false;

    // Clean up existing tour markers
    Object.keys(markersRef.current).forEach(markerId => {
      if (markerId.startsWith('tour-landmark-')) {
        try {
          markersRef.current[markerId].remove();
          delete markersRef.current[markerId];
        } catch (error) {
          console.warn('⚠️ Error removing tour marker:', markerId, error);
        }
      }
    });

    // Clean up tour popups
    Object.keys(photoPopupsRef.current).forEach(popupId => {
      if (popupId.startsWith('tour-landmark-')) {
        try {
          photoPopupsRef.current[popupId].remove();
          delete photoPopupsRef.current[popupId];
        } catch (error) {
          console.warn('⚠️ Error removing tour popup:', popupId, error);
        }
      }
    });

    const bounds = new mapboxgl.LngLatBounds();

    plannedLandmarks.forEach((landmark, index) => {
      const coordinates = landmark.coordinates;
      if (!coordinates || coordinates.length !== 2 || 
          isNaN(coordinates[0]) || isNaN(coordinates[1])) {
        console.warn('⚠️ Invalid coordinates for landmark:', landmark.name, coordinates);
        return;
      }

      try {
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
        `;
        markerElement.textContent = (index + 1).toString();

        const marker = new mapboxgl.Marker(markerElement)
          .setLngLat(coordinates)
          .addTo(map);

        const markerId = `tour-landmark-${landmark.name.replace(/[^a-zA-Z0-9]/g, '-')}-${index}`;
        markersRef.current[markerId] = marker;
        
        markerElement.addEventListener('click', () => {
          handleLandmarkSelect(landmark);
        });

        bounds.extend(coordinates);
      } catch (error) {
        console.warn('⚠️ Error creating tour marker for:', landmark.name, error);
      }
    });

    // Fit map to tour bounds
    if (plannedLandmarks.length > 0 && map.isStyleLoaded()) {
      try {
        const padding = { top: 80, bottom: 80, left: 80, right: 80 };
        map.fitBounds(bounds, {
          padding,
          duration: 2000,
          essential: true
        });
      } catch (error) {
        console.warn('⚠️ Error fitting bounds for tour landmarks:', error);
      }
    }
  }, [plannedLandmarks, handleLandmarkSelect, !!map]);

  return <div ref={mapContainerRef} className="map-container" style={{ height: '100vh' }} />;
};

export default Map;
