
import { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { Landmark } from '@/data/landmarks';

interface UseMarkerManagerProps {
  map: mapboxgl.Map | null;
  landmarks: Landmark[];
  selectedLandmark: Landmark | null;
  onMarkerClick: (landmark: Landmark) => void;
}

export const useMarkerManager = ({
  map,
  landmarks,
  selectedLandmark,
  onMarkerClick
}: UseMarkerManagerProps) => {
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});

  // Update markers when landmarks change
  useEffect(() => {
    if (!map) return;

    const landmarkIds = new Set(landmarks.map(l => l.id));

    // Remove markers that are no longer in the landmarks list
    Object.keys(markers.current).forEach(markerId => {
      if (!landmarkIds.has(markerId)) {
        markers.current[markerId].remove();
        delete markers.current[markerId];
      }
    });

    // Add new markers
    landmarks.forEach((landmark) => {
      if (!markers.current[landmark.id]) {
        const el = document.createElement('div');
        
        // Different styling for top landmarks vs user landmarks
        const isTopLandmark = landmark.id.startsWith('top-landmark-');
        const markerColor = isTopLandmark ? 'bg-yellow-400' : 'bg-cyan-400';
        
        el.className = `w-4 h-4 rounded-full ${markerColor} border-2 border-white shadow-lg cursor-pointer transition-transform duration-300 hover:scale-125`;
        el.style.transition = 'background-color 0.3s, transform 0.3s';
        
        const marker = new mapboxgl.Marker(el)
          .setLngLat(landmark.coordinates)
          .addTo(map);

        marker.getElement().addEventListener('click', (e) => {
          e.stopPropagation();
          onMarkerClick(landmark);
        });

        markers.current[landmark.id] = marker;
      }
    });

  }, [map, landmarks, onMarkerClick]);

  // Update marker styles based on selection
  useEffect(() => {
    Object.entries(markers.current).forEach(([id, marker]) => {
      const element = marker.getElement();
      const isSelected = id === selectedLandmark?.id;
      const isTopLandmark = id.startsWith('top-landmark-');
      
      if (isSelected) {
        element.style.backgroundColor = '#f87171'; // red-400
        element.style.transform = 'scale(1.5)';
      } else {
        element.style.backgroundColor = isTopLandmark ? '#facc15' : '#22d3ee'; // yellow-400 or cyan-400
        element.style.transform = 'scale(1)';
      }
    });
  }, [selectedLandmark]);

  return { markers: markers.current };
};
