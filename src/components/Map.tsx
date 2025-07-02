
import React, { useRef, useEffect, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import { Landmark } from '@/data/landmarks';
import { useAuth } from '@/components/AuthProvider';
import { useLandmarkSourceToggle } from '@/hooks/useLandmarkSourceToggle';
import { useMarkerLoadingState } from '@/hooks/useMarkerLoadingState';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';
import { getPlaceTypeIcon } from '@/utils/placeTypeIcons';

interface MapProps {
  mapboxToken: string;
  allLandmarks: Landmark[];
  smartTourLandmarks: Landmark[];
  selectedLandmark: Landmark | null;
  onSelectLandmark: (landmark: Landmark) => void;
}

const Map: React.FC<MapProps> = ({
  mapboxToken,
  allLandmarks,
  smartTourLandmarks,
  selectedLandmark,
  onSelectLandmark,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const { user } = useAuth();
  const { currentLandmarks } = useLandmarkSourceToggle();
  const { isMarkersLoading, startMarkerLoading, finishMarkerLoading } = useMarkerLoadingState(750);
  const offlineCache = useOfflineCache({ storeName: 'map-cache' });
  const { connectionHealth } = useConnectionMonitor();

  // Memoize landmarks to display - use all landmarks from the hook
  const landmarksToDisplay = useMemo(() => {
    return currentLandmarks;
  }, [currentLandmarks]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-74.006, 40.7128], // NYC
      zoom: 13,
    });

    map.current.addControl(new mapboxgl.NavigationControl());
    
    // Add user location control
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });
    
    map.current.addControl(geolocateControl);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken]);

  // Update markers when landmarks change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    Object.values(markers.current).forEach(marker => marker.remove());
    markers.current = {};

    startMarkerLoading();

    // Add new markers
    landmarksToDisplay.forEach((landmark) => {
      const [lng, lat] = landmark.coordinates;
      
      const markerElement = document.createElement('div');
      markerElement.className = 'custom-marker';
      const iconResult = getPlaceTypeIcon(landmark.types || ['point_of_interest']);
      // Fixed: Handle LucideIcon type properly
      markerElement.innerHTML = typeof iconResult === 'string' ? iconResult : '📍';
      markerElement.style.fontSize = '24px';
      markerElement.style.cursor = 'pointer';
      
      // Add smart tour styling
      const isSmartTour = smartTourLandmarks.some(smartLandmark => smartLandmark.id === landmark.id);
      if (isSmartTour) {
        markerElement.style.filter = 'drop-shadow(0 0 8px #3b82f6)';
        markerElement.style.transform = 'scale(1.2)';
      }

      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat([lng, lat])
        .addTo(map.current!);

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="p-2">
          <h3 class="font-bold text-sm mb-1">${landmark.name}</h3>
          <p class="text-xs text-gray-600 mb-2">${landmark.description || 'No description available'}</p>
          ${landmark.rating ? `<div class="text-xs">⭐ ${landmark.rating}/5</div>` : ''}
          <button 
            class="mt-2 px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
            onclick="window.selectLandmark('${landmark.id}')"
          >
            View Details
          </button>
        </div>
      `);

      marker.setPopup(popup);
      markers.current[landmark.id] = marker;
    });

    // Global function for popup button clicks
    (window as any).selectLandmark = (landmarkId: string) => {
      const landmark = landmarksToDisplay.find(l => l.id === landmarkId);
      if (landmark) {
        onSelectLandmark(landmark);
      }
    };

    finishMarkerLoading();
  }, [landmarksToDisplay, onSelectLandmark, startMarkerLoading, finishMarkerLoading, smartTourLandmarks]);

  // Handle selected landmark
  useEffect(() => {
    if (!map.current || !selectedLandmark) return;

    const [lng, lat] = selectedLandmark.coordinates;
    map.current.flyTo({
      center: [lng, lat],
      zoom: 16,
      duration: 2000
    });

    // Highlight selected marker
    Object.entries(markers.current).forEach(([id, marker]) => {
      const element = marker.getElement();
      if (id === selectedLandmark.id) {
        element.style.filter = 'drop-shadow(0 0 12px #ef4444) brightness(1.2)';
        element.style.transform = 'scale(1.3)';
      } else {
        const isSmartTour = smartTourLandmarks.some(smartLandmark => smartLandmark.id === id);
        element.style.filter = isSmartTour ? 'drop-shadow(0 0 8px #3b82f6)' : 'none';
        element.style.transform = isSmartTour ? 'scale(1.2)' : 'scale(1)';
      }
    });
  }, [selectedLandmark, smartTourLandmarks]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Connection status indicator */}
      {!connectionHealth.isHealthy && (
        <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded text-sm z-10">
          Connection Issues
        </div>
      )}
      
      {/* Loading indicator */}
      {isMarkersLoading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-4 py-2 rounded z-10">
          Loading markers...
        </div>
      )}
    </div>
  );
};

export default Map;
