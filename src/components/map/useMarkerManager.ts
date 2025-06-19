
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
      // Ensure coordinates are valid arrays with exactly 2 numbers
      let coords = landmark.coordinates;
      if (!Array.isArray(coords) || coords.length !== 2 || 
          typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
        console.warn(`Invalid coordinates for ${landmark.name}:`, coords);
        return;
      }

      // Mapbox expects [longitude, latitude] format
      // Longitude: -180 to 180, Latitude: -90 to 90
      let [lng, lat] = coords;

      // Validate coordinate ranges
      if (Math.abs(lng) > 180 || Math.abs(lat) > 90) {
        console.warn(`Coordinates out of range for ${landmark.name}:`, [lng, lat]);
        return;
      }

      const el = document.createElement('div');
      el.className = `w-4 h-4 rounded-full cursor-pointer transition-all duration-200 ${
        selectedLandmark?.id === landmark.id 
          ? 'bg-yellow-400 ring-4 ring-yellow-200 scale-125' 
          : 'bg-red-500 hover:bg-red-600 hover:scale-110'
      }`;
      
      try {
        const marker = new mapboxgl.Marker(el)
          .setLngLat([lng, lat])
          .addTo(map);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          console.log('Marker clicked:', landmark.name, 'at coordinates:', [lng, lat]);
          onMarkerClick(landmark);
        });

        markersRef.current[landmark.id] = marker;
        console.log('Added marker for:', landmark.name, 'at', [lng, lat]);
      } catch (error) {
        console.error('Error adding marker for', landmark.name, error);
      }
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
