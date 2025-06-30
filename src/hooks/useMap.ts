
import { useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

export const useMap = (mapContainerRef: React.RefObject<HTMLDivElement>) => {
  const map = useRef<mapboxgl.Map | null>(null);
  const isInitializing = useRef<boolean>(false);

  const initialize = useCallback(() => {
    // Prevent multiple initialization attempts
    if (!mapContainerRef.current || map.current || isInitializing.current) {
      return;
    }

    console.log('🗺️ Initializing map...');
    isInitializing.current = true;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [0, 0],
        zoom: 2,
      });

      // Reset initialization flag when map is loaded
      map.current.on('load', () => {
        isInitializing.current = false;
        console.log('🗺️ Map loaded successfully');
      });

      // Handle map errors
      map.current.on('error', (e) => {
        console.error('🗺️ Map error:', e);
        isInitializing.current = false;
      });

    } catch (error) {
      console.error('🗺️ Failed to initialize map:', error);
      isInitializing.current = false;
      map.current = null;
    }
  }, []); // Remove mapContainerRef from dependencies to prevent recreation

  const cleanup = useCallback(() => {
    if (!map.current) return;

    console.log('🧹 Cleaning up map...');
    
    try {
      // Check if map is still valid before removing
      if (map.current.getContainer() && map.current.getContainer().parentNode) {
        // Mapbox GL JS automatically removes all event listeners when map.remove() is called
        map.current.remove();
      }
    } catch (error) {
      console.warn('⚠️ Error during map cleanup:', error);
    } finally {
      map.current = null;
      isInitializing.current = false;
    }
  }, []);

  return {
    current: map.current,
    initialize,
    cleanup,
    isInitializing: isInitializing.current
  };
};
