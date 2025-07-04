
import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Route } from 'lucide-react';
import { useOptimalRoute } from '@/hooks/useOptimalRoute';
import { TourLandmark } from '@/data/tourLandmarks';
import { Landmark } from '@/data/landmarks';
import SearchControl from "@/components/SearchControl";
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from "@/components/ui/use-toast"

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
  plannedLandmarks: Landmark[];
}

const Map: React.FC<MapProps> = ({ 
  mapboxToken, 
  landmarks, 
  onSelectLandmark, 
  selectedLandmark, 
  plannedLandmarks 
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [lng, setLng] = useState(2.3522);
  const [lat, setLat] = useState(48.8566);
  const [zoom, setZoom] = useState(12);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<{ longitude: number; latitude: number } | null>(null);
  const { toast } = useToast();

  const { subscriptionData } = useSubscription();

  const { 
    isLoading: isOptimalRouteLoading, 
    error: optimalRouteError,
    routeGeoJSON,
    optimizedLandmarks,
    routeStats,
    calculateOptimalRoute,
    clearRoute
  } = useOptimalRoute();

  const handleOptimalRouteClick = async () => {
    if (routeGeoJSON) {
      clearRoute();
    } else if (userLocation) {
      await calculateOptimalRoute([userLocation.longitude, userLocation.latitude], plannedLandmarks);
    } else {
      toast({
        title: "Location Required",
        description: "Please enable location services to calculate the optimal route.",
      })
    }
  };

  const isOptimalRouteEnabled = plannedLandmarks.length >= 2 && userLocation !== null;
  const hasActiveRoute = routeGeoJSON !== null;

  useEffect(() => {
    if (map.current) return; // prevent initialize map multiple times
    if (!mapContainer.current) return; // Ensure the container is available

    // Set Mapbox access token
    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: zoom
    });

    map.current.on('load', () => {
      setIsMapLoaded(true);
      map.current?.resize();
    });

    map.current.on('move', () => {
      if (!map.current) return;
      setLng(map.current.getCenter().lng);
      setLat(map.current.getCenter().lat);
      setZoom(map.current.getZoom());
    });

    // Add navigation control (location button)
    map.current.addControl(
      new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: false
      }),
      'top-right'
    );

    // Add geolocate control
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });

    map.current.addControl(geolocate, 'top-right');

    // Listen for location updates
    geolocate.on('geolocate', (e) => {
      setUserLocation({
        longitude: e.coords.longitude,
        latitude: e.coords.latitude
      });
    });

    return () => {
      map.current?.off('move', () => {});
      map.current?.off('load', () => {});
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Add planned landmarks as markers on the map
    plannedLandmarks.forEach(landmark => {
      // Check if a marker with the same ID already exists
      if (map.current?.getSource(`landmark-${landmark.id}`)) {
        return; // Skip adding the marker if it already exists
      }

      const el = document.createElement('div');
      el.className = 'marker';
      el.style.backgroundImage = `url(https://cdn.mapmarker.io/api/v1/pin?size=20&background=%233898db&icon=fa-flag&color=%23FFFFFF)`;
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.borderRadius = '10px';
      el.style.cursor = 'pointer';

      el.addEventListener('click', () => {
        onSelectLandmark(landmark);
      });

      new mapboxgl.Marker(el)
        .setLngLat([landmark.coordinates[0], landmark.coordinates[1]])
        .addTo(map.current!)
        .setDraggable(false);
    });
  }, [plannedLandmarks, isMapLoaded, onSelectLandmark]);

  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // Clear existing route if it exists
    if (map.current.getSource('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }

    // Add the route as a line on the map
    if (routeGeoJSON) {
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: routeGeoJSON
        }
      });

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3887be',
          'line-width': 5,
          'line-opacity': 0.75
        }
      });
    }
  }, [routeGeoJSON, isMapLoaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Search Control */}
      <div className="absolute top-4 left-4 z-10">
        <SearchControl landmarks={landmarks} onSelectLandmark={onSelectLandmark} />
      </div>

      {/* Optimal Route Button - positioned below location button */}
      <div className="absolute top-[120px] right-4 z-10">
        <button
          onClick={handleOptimalRouteClick}
          disabled={!isOptimalRouteEnabled || isOptimalRouteLoading}
          title={
            !isOptimalRouteEnabled 
              ? plannedLandmarks.length < 2 
                ? "Need at least 2 tour landmarks for route optimization"
                : "Location required for route calculation"
              : hasActiveRoute
                ? "Clear optimal route" 
                : "Calculate optimal walking route"
          }
          className={`
            w-8 h-8 rounded border border-gray-300 bg-white shadow-md
            flex items-center justify-center transition-all duration-200
            ${isOptimalRouteEnabled && !isOptimalRouteLoading
              ? 'hover:bg-gray-50 hover:shadow-lg cursor-pointer' 
              : 'opacity-50 cursor-not-allowed'
            }
            ${hasActiveRoute ? 'bg-blue-50 border-blue-300' : ''}
          `}
        >
          {isOptimalRouteLoading ? (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Route 
              size={16} 
              className={`
                ${hasActiveRoute ? 'text-blue-600' : 'text-gray-700'}
                ${!isOptimalRouteEnabled ? 'text-gray-400' : ''}
              `} 
            />
          )}
        </button>
      </div>
    </div>
  );
};

export default Map;
