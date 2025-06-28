
import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Landmark } from '@/data/landmarks';

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
  plannedLandmarks: Landmark[];
  destinationCoordinates?: [number, number] | null;
}

const Map: React.FC<MapProps> = ({
  mapboxToken,
  landmarks,
  onSelectLandmark,
  selectedLandmark,
  plannedLandmarks,
  destinationCoordinates
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-74.5, 40],
      zoom: 9,
      projection: 'mercator'
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setIsMapLoaded(true);
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Fly to destination coordinates when they become available
  useEffect(() => {
    if (!map.current || !isMapLoaded || !destinationCoordinates) return;

    console.log('🗺️ Flying to destination coordinates:', destinationCoordinates);
    
    map.current.flyTo({
      center: destinationCoordinates,
      zoom: 13,
      duration: 2000,
      curve: 1.42,
      easing: (t) => t,
      essential: true
    });
  }, [destinationCoordinates, isMapLoaded]);

  // Update markers when landmarks change
  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add markers for all landmarks
    landmarks.forEach((landmark) => {
      if (!landmark.coordinates || landmark.coordinates.length !== 2) return;

      const isPlanned = plannedLandmarks.some(p => p.id === landmark.id);
      const isSelected = selectedLandmark?.id === landmark.id;

      const markerElement = document.createElement('div');
      markerElement.className = `w-3 h-3 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all duration-200 ${
        isSelected ? 'bg-red-500 w-4 h-4' : 
        isPlanned ? 'bg-blue-500' : 
        'bg-gray-600'
      }`;

      markerElement.addEventListener('click', () => {
        onSelectLandmark(landmark);
      });

      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat(landmark.coordinates)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    // Fit bounds to show all landmarks if we have them and no destination coordinates
    if (landmarks.length > 0 && !destinationCoordinates) {
      const bounds = new mapboxgl.LngLatBounds();
      landmarks.forEach(landmark => {
        if (landmark.coordinates && landmark.coordinates.length === 2) {
          bounds.extend(landmark.coordinates);
        }
      });

      if (!bounds.isEmpty()) {
        map.current.fitBounds(bounds, {
          padding: 50,
          duration: 1000
        });
      }
    }
  }, [landmarks, plannedLandmarks, selectedLandmark, isMapLoaded, onSelectLandmark, destinationCoordinates]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
};

export default Map;
