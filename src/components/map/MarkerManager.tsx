
import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { Landmark } from '@/data/landmarks';
import { createMarkerElement, updateMarkerStyle } from '@/utils/mapUtils';

interface MarkerManagerProps {
  map: mapboxgl.Map | null;
  landmarks: Landmark[];
  selectedLandmark: Landmark | null;
  onMarkerClick: (landmark: Landmark) => void;
  markersRef: React.MutableRefObject<{ [key: string]: mapboxgl.Marker }>;
}

const MarkerManager: React.FC<MarkerManagerProps> = ({
  map,
  landmarks,
  selectedLandmark,
  onMarkerClick,
  markersRef
}) => {
  const processedLandmarks = useRef<string[]>([]);

  // Update markers when landmarks change
  useEffect(() => {
    if (!map) return;

    const landmarkIds = new Set(landmarks.map(l => l.id));
    const currentLandmarkSignature = landmarks.map(l => l.id).sort().join(',');

    // Check if landmarks have changed
    if (processedLandmarks.current.join(',') === currentLandmarkSignature) {
      return;
    }

    console.log('🗺️ [MarkerManager] Updating markers for', landmarks.length, 'landmarks');

    // Remove markers that are no longer in the landmarks list
    Object.keys(markersRef.current).forEach(markerId => {
      if (!landmarkIds.has(markerId)) {
        markersRef.current[markerId].remove();
        delete markersRef.current[markerId];
      }
    });

    // Add new markers
    landmarks.forEach((landmark) => {
      if (!markersRef.current[landmark.id]) {
        const el = createMarkerElement(landmark);
        
        const marker = new mapboxgl.Marker(el)
          .setLngLat(landmark.coordinates)
          .addTo(map);

        marker.getElement().addEventListener('click', async (e) => {
          e.stopPropagation();
          console.log('🗺️ [MarkerManager] Marker clicked:', landmark.name);
          onMarkerClick(landmark);
        });

        markersRef.current[landmark.id] = marker;
      }
    });

    processedLandmarks.current = landmarks.map(l => l.id).sort();
  }, [map, landmarks, onMarkerClick, markersRef]);

  // Update marker styles when selected landmark changes
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const landmark = landmarks.find(l => l.id === id);
      if (landmark) {
        const element = marker.getElement();
        const isSelected = id === selectedLandmark?.id;
        updateMarkerStyle(element, isSelected, landmark);
      }
    });
  }, [selectedLandmark, landmarks, markersRef]);

  return null; // This component doesn't render anything directly
};

export default MarkerManager;
