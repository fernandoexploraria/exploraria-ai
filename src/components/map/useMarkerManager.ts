
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
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!map) {
      console.log('Map not available for markers');
      return;
    }

    console.log('Updating markers, landmarks count:', landmarks.length);
    console.log('Map loaded:', map.loaded());

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => {
      try {
        marker.remove();
      } catch (error) {
        console.warn('Error removing existing marker:', error);
      }
    });
    markersRef.current = {};

    // Add new markers
    landmarks.forEach(landmark => {
      try {
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
          console.log('Marker clicked:', landmark.name);
          onMarkerClick(landmark);
        });

        markersRef.current[landmark.id] = marker;
        console.log('Added marker for:', landmark.name);
      } catch (error) {
        console.error('Error creating marker for', landmark.name, error);
      }
    });

    isInitialized.current = true;
    console.log('Markers initialization complete');

    return () => {
      // Cleanup markers when component unmounts or dependencies change
      Object.values(markersRef.current).forEach(marker => {
        try {
          marker.remove();
        } catch (error) {
          console.warn('Error removing marker during cleanup:', error);
        }
      });
      markersRef.current = {};
    };
  }, [map, landmarks, selectedLandmark, onMarkerClick]);

  // Update marker styles when selected landmark changes
  useEffect(() => {
    if (!map || !isInitialized.current) return;

    console.log('Updating marker styles for selected landmark:', selectedLandmark?.name);

    Object.entries(markersRef.current).forEach(([landmarkId, marker]) => {
      try {
        const el = marker.getElement();
        const isSelected = selectedLandmark?.id === landmarkId;
        
        el.className = `w-4 h-4 rounded-full cursor-pointer transition-all duration-200 ${
          isSelected 
            ? 'bg-yellow-400 ring-4 ring-yellow-200 scale-125' 
            : 'bg-red-500 hover:bg-red-600 hover:scale-110'
        }`;
      } catch (error) {
        console.warn('Error updating marker style:', error);
      }
    });
  }, [selectedLandmark, map]);
};
