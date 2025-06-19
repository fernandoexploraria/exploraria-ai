
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
    if (!map || !map.loaded()) {
      console.log('Map not ready for markers');
      return;
    }

    console.log('Adding markers to map, landmarks count:', landmarks.length);

    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => {
      marker.remove();
    });
    markersRef.current = {};

    // Add new markers
    landmarks.forEach(landmark => {
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
    });

    console.log('Markers added successfully, total:', Object.keys(markersRef.current).length);

    return () => {
      Object.values(markersRef.current).forEach(marker => {
        marker.remove();
      });
      markersRef.current = {};
    };
  }, [map, landmarks, selectedLandmark, onMarkerClick]);

  // Update marker styles when selected landmark changes
  useEffect(() => {
    if (!map || !map.loaded()) return;

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
