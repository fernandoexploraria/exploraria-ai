
import { useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { Landmark } from '@/data/landmarks';

interface UseRouteManagerProps {
  map: mapboxgl.Map | null;
}

export const useRouteManager = ({ map }: UseRouteManagerProps) => {
  const currentRouteLayer = useRef<string | null>(null);
  const navigationMarkers = useRef<{ marker: mapboxgl.Marker; interaction: any }[]>([]);

  // Function to show route on map
  const showRouteOnMap = useCallback((route: any, landmark: Landmark) => {
    if (!map) return;

    console.log('🗺️ [RouteManager] Adding route to map for:', landmark.name);

    // Remove existing route layer if it exists
    if (currentRouteLayer.current) {
      if (map.getLayer(currentRouteLayer.current)) {
        map.removeLayer(currentRouteLayer.current);
      }
      if (map.getSource(currentRouteLayer.current)) {
        map.removeSource(currentRouteLayer.current);
      }
    }

    // Create unique layer ID
    const layerId = `route-${Date.now()}`;
    currentRouteLayer.current = layerId;

    // Add route source and layer
    map.addSource(layerId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: route.geometry
      }
    });

    map.addLayer({
      id: layerId,
      type: 'line',
      source: layerId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3B82F6',
        'line-width': 4,
        'line-opacity': 0.8
      }
    });

    // Fit map to show the entire route
    const coordinates = route.geometry.coordinates;
    const bounds = new mapboxgl.LngLatBounds();
    coordinates.forEach((coord: [number, number]) => bounds.extend(coord));
    
    map.fitBounds(bounds, {
      padding: 100,
      duration: 1000
    });

    console.log(`🛣️ Route displayed: ${Math.round(route.distance)}m, ${Math.round(route.duration / 60)}min walk`);
  }, [map]);

  // Function to clear route
  const clearRoute = useCallback(() => {
    if (currentRouteLayer.current && map) {
      if (map.getLayer(currentRouteLayer.current)) {
        map.removeLayer(currentRouteLayer.current);
      }
      if (map.getSource(currentRouteLayer.current)) {
        map.removeSource(currentRouteLayer.current);
      }
      currentRouteLayer.current = null;
      console.log('🗺️ [RouteManager] Route cleared');
    }
  }, [map]);

  // Function to navigate to coordinates with a marker
  const navigateToCoordinates = useCallback((coordinates: [number, number], interaction?: any) => {
    console.log('🗺️ [RouteManager] Navigate to coordinates:', coordinates);
    
    if (!map) {
      console.log('ERROR: Map not initialized!');
      return;
    }
    
    map.flyTo({
      center: coordinates,
      zoom: 14,
      speed: 0.8,
      curve: 1,
      easing: (t) => t,
    });

    // Add a permanent marker at the coordinates
    const el = document.createElement('div');
    el.className = 'w-4 h-4 rounded-full bg-red-400 border-2 border-white shadow-lg cursor-pointer transition-transform duration-300 hover:scale-125';
    
    const marker = new mapboxgl.Marker(el)
      .setLngLat(coordinates)
      .addTo(map);

    // Store the marker for management
    navigationMarkers.current.push({ marker, interaction });
  }, [map]);

  return {
    showRouteOnMap,
    clearRoute,
    navigateToCoordinates,
    navigationMarkers: navigationMarkers.current
  };
};
