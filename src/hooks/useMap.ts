
import { useRef } from 'react';
import mapboxgl from 'mapbox-gl';

export const useMap = (mapContainerRef: React.RefObject<HTMLDivElement>) => {
  const map = useRef<mapboxgl.Map | null>(null);

  const initialize = () => {
    if (!mapContainerRef.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [0, 0],
      zoom: 2,
    });
  };

  return {
    current: map.current,
    initialize
  };
};
