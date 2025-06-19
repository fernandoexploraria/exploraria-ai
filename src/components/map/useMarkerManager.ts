
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { Landmark } from '@/data/landmarks';

interface UseMarkerManagerProps {
  map: mapboxgl.Map | null;
  landmarks: Landmark[];
  selectedLandmark: Landmark | null;
  onMarkerClick: (landmark: Landmark) => void;
}

export const useMarkerManager = ({ map, landmarks, selectedLandmark, onMarkerClick }: UseMarkerManagerProps) => {
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});

  useEffect(() => {
    if (!map || !map.isStyleLoaded()) {
      console.log('Map not ready for markers');
      return;
    }

    console.log('Updating markers, landmarks count:', landmarks.length);

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    // Add new markers
    landmarks.forEach(landmark => {
      try {
        // Check if map container exists before creating marker
        if (!map.getCanvasContainer()) {
          console.warn('Map canvas container not available');
          return;
        }

        const el = document.createElement('div');
        el.className = `w-4 h-4 rounded-full cursor-pointer transition-all duration-200 ${
          selectedLandmark?.id === landmark.id 
            ? 'bg-yellow-400 ring-4 ring-yellow-200 scale-125' 
            : 'bg-red-500 hover:bg-red-600 hover:scale-110'
        }`;
        
        const marker = new mapboxgl.Marker(el)
          .setLngLat(landmark.coordinates)
          .addTo(map);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onMarkerClick(landmark);
        });

        markersRef.current[landmark.id] = marker;
      } catch (error) {
        console.error('Error creating marker for', landmark.name, error);
      }
    });

    return () => {
      // Cleanup markers when component unmounts
      Object.values(markersRef.current).forEach(marker => {
        try {
          marker.remove();
        } catch (error) {
          console.warn('Error removing marker:', error);
        }
      });
      markersRef.current = {};
    };
  }, [map, landmarks, selectedLandmark, onMarkerClick]);

  // Update marker styles when selected landmark changes
  useEffect(() => {
    if (!map) return;

    Object.entries(markersRef.current).forEach(([landmarkId, marker]) => {
      const el = marker.getElement();
      const isSelected = selectedLandmark?.id === landmarkId;
      
      el.className = `w-4 h-4 rounded-full cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'bg-yellow-400 ring-4 ring-yellow-200 scale-125' 
          : 'bg-red-500 hover:bg-red-600 hover:scale-110'
      }`;
    });
  }, [selectedLandmark, map]);
};
