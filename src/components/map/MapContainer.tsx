
import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAuth } from '@/components/AuthProvider';

interface MapContainerProps {
  mapboxToken: string;
  onMapReady: (map: mapboxgl.Map) => void;
  children?: React.ReactNode;
}

const MapContainer: React.FC<MapContainerProps> = ({ mapboxToken, onMapReady, children }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || map.current) return;

    console.log('🗺️ [MapContainer] Initializing map...');
    
    try {
      mapboxgl.accessToken = mapboxToken;
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        projection: { name: 'globe' },
        zoom: 1.5,
        center: [0, 20],
      });

      map.current.on('style.load', () => {
        console.log('🗺️ [MapContainer] Map style loaded, adding fog...');
        map.current?.setFog({});
      });

      // Add location control for authenticated users
      if (user) {
        console.log('🗺️ [MapContainer] Adding GeolocateControl for authenticated user');
        
        const geoControl = new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 600000
          },
          trackUserLocation: true,
          showUserHeading: true,
          showAccuracyCircle: true,
          fitBoundsOptions: {
            maxZoom: 16
          }
        });
        
        map.current.addControl(geoControl, 'top-right');

        // Add custom CSS to position the control 10px from top
        setTimeout(() => {
          const controlContainer = document.querySelector('.mapboxgl-ctrl-top-right');
          if (controlContainer) {
            (controlContainer as HTMLElement).style.top = '10px';
          }
        }, 100);
      }

      onMapReady(map.current);

      return () => {
        console.log('🗺️ [MapContainer] Cleanup');
        map.current?.remove();
        map.current = null;
      };
    } catch (error) {
      console.error('🗺️ [MapContainer] Error during initialization:', error);
    }
  }, [mapboxToken, user, onMapReady]);

  return (
    <>
      <div ref={mapContainer} className="absolute inset-0" />
      {children}
    </>
  );
};

export default MapContainer;
