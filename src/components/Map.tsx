import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Landmark } from '@/data/landmarks';
import { useToast } from '@/hooks/use-toast';

// Define global window type extension
declare global {
  interface Window {
    __mapInstance?: mapboxgl.Map;
    selectLandmarkById?: (id: string) => void;
    zoomToLandmarks?: () => void;
  }
}

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
  plannedLandmarks: Landmark[];
  destinationCoordinates?: [number, number];
}

const Map: React.FC<MapProps> = ({
  mapboxToken,
  landmarks,
  onSelectLandmark,
  selectedLandmark,
  plannedLandmarks,
  destinationCoordinates,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [isMapReady, setIsMapReady] = useState(false);
  const { toast } = useToast();

  // Store the click handler reference for proper cleanup
  const mapClickHandlerRef = useRef<(e: mapboxgl.MapMouseEvent) => void>();

  useEffect(() => {
    if (!mapboxToken) {
      console.error('Mapbox token is missing!');
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    if (map.current) return; // prevent re-initialization

    const newMap = new mapboxgl.Map({
      container: mapContainer.current!,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      projection: 'globe',
      center: [30, 15], // Globe center
      zoom: 1.5,
      pitch: 45,
    });

    map.current = newMap;
    window.__mapInstance = newMap;

    // Add navigation controls
    newMap.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Disable scroll zoom initially for smoother globe experience
    newMap.scrollZoom.disable();

    newMap.on('load', () => {
      setIsMapReady(true);
      
      // Add atmosphere and fog effects for globe
      newMap.setFog({
        color: 'rgb(186, 210, 235)',
        'high-color': 'rgb(36, 92, 223)',
        'horizon-blend': 0.02,
        'space-color': 'rgb(11, 11, 25)',
        'star-intensity': 0.6,
      });

      // Enable scroll zoom after map loads
      newMap.scrollZoom.enable();
    });

    // Globe rotation settings
    const secondsPerRevolution = 240;
    const maxSpinZoom = 5;
    const slowSpinZoom = 3;
    let userInteracting = false;
    let spinEnabled = true;

    // Spin globe function
    function spinGlobe() {
      if (!newMap) return;
      
      const zoom = newMap.getZoom();
      if (spinEnabled && !userInteracting && zoom < maxSpinZoom) {
        let distancePerSecond = 360 / secondsPerRevolution;
        if (zoom > slowSpinZoom) {
          const zoomDif = (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
          distancePerSecond *= zoomDif;
        }
        const center = newMap.getCenter();
        center.lng -= distancePerSecond;
        newMap.easeTo({ center, duration: 1000, easing: (n) => n });
      }
    }

    // Event listeners for interaction
    newMap.on('mousedown', () => {
      userInteracting = true;
    });
    
    newMap.on('dragstart', () => {
      userInteracting = true;
    });
    
    newMap.on('mouseup', () => {
      userInteracting = false;
      spinGlobe();
    });
    
    newMap.on('touchend', () => {
      userInteracting = false;
      spinGlobe();
    });

    newMap.on('moveend', () => {
      spinGlobe();
    });

    // Start the globe spinning
    spinGlobe();

    // Create and store the click handler
    const mapClickHandler = (e: mapboxgl.MapMouseEvent) => {
      // Check if the click was on a marker
      const features = newMap.queryRenderedFeatures(e.point, {
        layers: ['markers'] // Replace 'markers' with your marker layer id if you have one
      });

      if (!features.length) {
        // If no marker was clicked, deselect the current landmark
        onSelectLandmark(null as any); // Passing null to deselect
        return;
      }
    };

    mapClickHandlerRef.current = mapClickHandler;
    newMap.on('click', mapClickHandler);

    return () => {
      if (mapClickHandlerRef.current) {
        newMap.off('click', mapClickHandlerRef.current);
      }
      newMap.remove();
      map.current = null;
      window.__mapInstance = undefined;
    };
  }, [mapboxToken, onSelectLandmark]);

  // Manage markers
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    console.log('🗺️ Adding markers for landmarks:', landmarks.length);

    // Clear existing markers
    Object.keys(markersRef.current).forEach(id => {
      markersRef.current[id].remove();
    });
    markersRef.current = {};

    // Add new markers with custom styling for better visibility on globe
    landmarks.forEach(landmark => {
      // Create custom marker element for better visibility
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.width = '12px';
      el.style.height = '12px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#ff6b6b';
      el.style.border = '2px solid #fff';
      el.style.cursor = 'pointer';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

      const marker = new mapboxgl.Marker(el)
        .setLngLat(landmark.coordinates)
        .addTo(map.current!);

      // Add click handler to the marker element
      el.addEventListener('click', () => {
        onSelectLandmark(landmark);
      });

      markersRef.current[landmark.id] = marker;
    });

    console.log('🗺️ Markers added:', Object.keys(markersRef.current).length);
  }, [landmarks, onSelectLandmark, isMapReady]);

  // Effect to highlight the selected landmark
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    Object.keys(markersRef.current).forEach(id => {
      const markerEl = markersRef.current[id].getElement();
      markerEl.classList.remove('selected');
    });

    if (selectedLandmark && markersRef.current[selectedLandmark.id]) {
      const markerEl = markersRef.current[selectedLandmark.id].getElement();
      markerEl.classList.add('selected');

      // Fly to the selected landmark
      map.current.flyTo({
        center: selectedLandmark.coordinates,
        zoom: 14,
        duration: 1000,
        essential: true // this animation is considered essential with respect to prefers-reduced-motion
      });
    }
  }, [selectedLandmark, isMapReady]);

  // Add planned landmarks as source and layer
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    // Store the planned landmarks click handler reference
    const plannedLandmarksClickHandler = (e: mapboxgl.MapMouseEvent) => {
      if (e.features && e.features.length > 0) {
        const clickedFeature = e.features[0];
        const landmarkId = clickedFeature.properties?.id;

        if (landmarkId) {
          const landmark = landmarks.find(lm => lm.id === landmarkId);
          if (landmark) {
            onSelectLandmark(landmark);
          } else {
            console.warn(`Landmark with id ${landmarkId} not found.`);
          }
        }
      }
    };

    if (map.current.getSource('planned-landmarks')) {
      (map.current.getSource('planned-landmarks') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: plannedLandmarks.map(landmark => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: landmark.coordinates
          },
          properties: {
            id: landmark.id
          }
        }))
      });
    } else {
      map.current.addSource('planned-landmarks', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: plannedLandmarks.map(landmark => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: landmark.coordinates
            },
            properties: {
              id: landmark.id
            }
          }))
        }
      });

      map.current.addLayer({
        id: 'planned-landmarks',
        type: 'circle',
        source: 'planned-landmarks',
        paint: {
          'circle-radius': 6,
          'circle-color': '#007cbf'
        }
      });

      map.current.on('click', 'planned-landmarks', plannedLandmarksClickHandler);
    }

    return () => {
      if (map.current?.getLayer('planned-landmarks')) {
        map.current.removeLayer('planned-landmarks');
      }
      if (map.current?.getSource('planned-landmarks')) {
        map.current.removeSource('planned-landmarks');
      }
      if (map.current) {
        map.current.off('click', 'planned-landmarks', plannedLandmarksClickHandler);
      }
    };
  }, [plannedLandmarks, landmarks, onSelectLandmark, isMapReady]);

  const selectLandmarkById = useCallback((id: string) => {
    const landmark = landmarks.find(lm => lm.id === id);
    if (landmark) {
      onSelectLandmark(landmark);
    } else {
      toast({
        title: "Landmark not found",
        description: `Could not find landmark with id ${id}`,
      });
    }
  }, [landmarks, onSelectLandmark, toast]);

  const zoomToLandmarks = useCallback(() => {
    if (!map.current || landmarks.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();

    landmarks.forEach(landmark => {
      bounds.extend(landmark.coordinates);
    });

    map.current.fitBounds(bounds, {
      padding: 50,
      maxZoom: 15,
      duration: 2000
    });
  }, [landmarks, isMapReady]);

  useEffect(() => {
    window.selectLandmarkById = selectLandmarkById;
    window.zoomToLandmarks = zoomToLandmarks;

    return () => {
      delete window.selectLandmarkById;
      delete window.zoomToLandmarks;
    };
  }, [selectLandmarkById, zoomToLandmarks]);

  // PHASE 1: Add destination fly-to effect
  useEffect(() => {
    if (!map.current || !destinationCoordinates) return;

    console.log('🎯 Flying to destination coordinates:', destinationCoordinates);
    
    map.current.flyTo({
      center: destinationCoordinates,
      zoom: 12,
      duration: 2000,
      essential: true
    });
  }, [destinationCoordinates]);

  return (
    <div 
      ref={mapContainer} 
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 1 }}
    />
  );
};

export default Map;
