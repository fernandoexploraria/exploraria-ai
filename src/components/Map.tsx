
import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Landmark } from '@/data/landmarks';

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
}

const Map: React.FC<MapProps> = ({ mapboxToken, landmarks, onSelectLandmark, selectedLandmark }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});

  useEffect(() => {
    if (!mapboxToken || !mapContainer.current) return;

    mapboxgl.accessToken = mapboxToken;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      projection: { name: 'globe' },
      zoom: 1.5,
      center: [0, 20],
    });

    map.current.on('style.load', () => {
      map.current?.setFog({}); // Add a sky layer and atmosphere
    });

    landmarks.forEach((landmark) => {
      const el = document.createElement('div');
      el.className = 'w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-lg cursor-pointer transition-transform duration-300 hover:scale-125';
      el.style.transition = 'background-color 0.3s, transform 0.3s';
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat(landmark.coordinates)
        .addTo(map.current!);

      marker.getElement().addEventListener('click', () => {
        onSelectLandmark(landmark);
      });
      markers.current[landmark.id] = marker;
    });

    return () => map.current?.remove();
  }, [mapboxToken, landmarks, onSelectLandmark]);

  useEffect(() => {
    if (map.current && selectedLandmark) {
      map.current.flyTo({
        center: selectedLandmark.coordinates,
        zoom: 14,
        speed: 0.7,
        curve: 1,
        easing: (t) => t,
      });
    }

    Object.entries(markers.current).forEach(([id, marker]) => {
      const element = marker.getElement();
      if (id === selectedLandmark?.id) {
        element.style.backgroundColor = '#f87171'; // red-400
        element.style.transform = 'scale(1.5)';
      } else {
        element.style.backgroundColor = '#22d3ee'; // cyan-400
        element.style.transform = 'scale(1)';
      }
    });

  }, [selectedLandmark]);

  return <div ref={mapContainer} className="absolute inset-0" />;
};

export default Map;
