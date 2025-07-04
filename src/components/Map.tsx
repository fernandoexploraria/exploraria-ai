import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Volume2, Eye, MapPin, Route } from 'lucide-react';
import { toast } from 'sonner';
import { Landmark } from '@/data/landmarks';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { TOUR_LANDMARKS, TourLandmark } from '@/data/tourLandmarks';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useStreetView } from '@/hooks/useStreetView';
import { useStreetViewNavigation } from '@/hooks/useStreetViewNavigation';
import { useEnhancedStreetView } from '@/hooks/useEnhancedStreetView';
import EnhancedStreetViewModal from './EnhancedStreetViewModal';
import { useLandmarkPhotos } from '@/hooks/useLandmarkPhotos';
import { PhotoData } from '@/hooks/useEnhancedPhotos';
import { PhotoCarousel } from './photo-carousel';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { getEnhancedLandmarkText } from '@/utils/landmarkPromptUtils';
import { useOptimalRoute } from '@/hooks/useOptimalRoute';
import { usePermissionMonitor } from '@/hooks/usePermissionMonitor';

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
  plannedLandmarks: Landmark[];
}

const TOUR_LANDMARKS_SOURCE_ID = 'tour-landmarks-source';
const TOUR_LANDMARKS_LAYER_ID = 'tour-landmarks-layer';
const TOP_LANDMARKS_SOURCE_ID = 'top-landmarks-source';
const TOP_LANDMARKS_LAYER_ID = 'top-landmarks-layer';
const BASE_LANDMARKS_SOURCE_ID = 'base-landmarks-source';
const BASE_LANDMARKS_LAYER_ID = 'base-landmarks-layer';

// Add new constants for route markers
const ROUTE_MARKERS_SOURCE_ID = 'route-markers-source';
const ROUTE_MARKERS_LAYER_ID = 'route-markers-layer';

const MapComponent: React.FC<MapProps> = ({ 
  mapboxToken, 
  landmarks, 
  onSelectLandmark, 
  selectedLandmark, 
  plannedLandmarks
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const imageCache = useRef<{ [key: string]: string }>({});
  const enhancedPhotosCache = useRef<{ [key: string]: PhotoData[] }>({});
  const photoPopups = useRef<{ [key: string]: mapboxgl.Popup }>({});
  const [playingAudio, setPlayingAudio] = useState<{ [key: string]: boolean }>({});
  const pendingPopupLandmark = useRef<Landmark | null>(null);
  const isZooming = useRef<boolean>(false);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const navigationMarkers = useRef<{ marker: mapboxgl.Marker; interaction: any }[]>([]);
  const currentRouteLayer = useRef<string | null>(null);
  
  const [tourLandmarks, setTourLandmarks] = useState<TourLandmark[]>([]);
  
  const geolocateControl = useRef<mapboxgl.GeolocateControl | null>(null);
  const isUpdatingFromProximitySettings = useRef<boolean>(false);
  const userInitiatedLocationRequest = useRef<boolean>(false);
  const lastLocationEventTime = useRef<number>(0);
  const processedPlannedLandmarks = useRef<string[]>([]);
  
  const { user } = useAuth();
  const { updateProximityEnabled, proximitySettings } = useProximityAlerts();
  const { fetchLandmarkPhotos: fetchPhotosWithHook } = useLandmarkPhotos();
  const { locationState } = useLocationTracking();
  const { permissionState, requestPermission, checkPermission } = usePermissionMonitor();
  
  const { getCachedData } = useStreetView();
  const { getStreetViewWithOfflineSupport } = useEnhancedStreetView();
  const { 
    openStreetViewModal, 
    closeStreetViewModal, 
    isModalOpen, 
    streetViewItems, 
    currentIndex,
    navigateToIndex,
    navigateNext,
    navigatePrevious 
  } = useStreetViewNavigation();

  const {
    isLoading: isCalculatingRoute,
    error: routeError,
    routeGeoJSON,
    optimizedLandmarks,
    routeStats,
    calculateOptimalRoute,
    clearRoute
  } = useOptimalRoute();

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  const findLandmarkByFeatureProperties = useCallback((properties: any, layerType: 'tour' | 'top' | 'base'): Landmark | null => {
    if (!properties) return null;
    
    switch (layerType) {
      case 'tour':
        const tourLandmark = TOUR_LANDMARKS.find(landmark => 
          landmark.name === properties.name ||
          (Math.abs(landmark.coordinates[0] - properties.coordinates?.[0]) < 0.0001 &&
           Math.abs(landmark.coordinates[1] - properties.coordinates?.[1]) < 0.0001)
        );
        
        if (!tourLandmark) return null;
        
        const landmarkIndex = TOUR_LANDMARKS.indexOf(tourLandmark);
        return {
          id: `tour-landmark-${landmarkIndex}`,
          name: tourLandmark.name,
          coordinates: tourLandmark.coordinates,
          description: tourLandmark.description,
          placeId: tourLandmark.placeId // 🔥 PRESERVE PLACE_ID FOR DATABASE LOOKUP
        };
        
      case 'top':
        const topLandmark = TOP_LANDMARKS.find((landmark, index) => 
          landmark.name === properties.name || properties.id === `top-landmark-${index}`
        );
        
        if (!topLandmark) return null;
        
        const topIndex = TOP_LANDMARKS.indexOf(topLandmark);
        return {
          id: `top-landmark-${topIndex}`,
          name: topLandmark.name,
          coordinates: topLandmark.coordinates,
          description: topLandmark.description,
          placeId: topLandmark.place_id // Include place_id for enhanced photo fetching
        };
        
      case 'base':
        const baseLandmark = landmarks.find(landmark => 
          landmark.name === properties.name || landmark.id === properties.id
        );
        
        return baseLandmark || null;
        
      default:
        return null;
    }
  }, [landmarks]);

  const updateTourLandmarksLayer = useCallback(() => {
    if (!map.current) return;
    
    console.log('🗺️ [Tour Layer] Updating tour landmarks GeoJSON layer with', tourLandmarks.length, 'landmarks');
    
    const features = tourLandmarks.map((landmark, index) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: landmark.coordinates
      },
      properties: {
        id: `tour-landmark-${index}`,
        name: landmark.name,
        description: landmark.description
      }
    }));
    
    const geojsonData = {
      type: 'FeatureCollection' as const,
      features
    };
    
    const source = map.current.getSource(TOUR_LANDMARKS_SOURCE_ID) as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(geojsonData);
      console.log('🗺️ [Tour Layer] Updated with', features.length, 'features');
    }
  }, [tourLandmarks]);

  const updateTopLandmarksLayer = useCallback(() => {
    if (!map.current) return;
    
    console.log('🗺️ [Top Layer] Updating top landmarks GeoJSON layer with', TOP_LANDMARKS.length, 'landmarks');
    
    const features = TOP_LANDMARKS.map((landmark, index) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: landmark.coordinates
      },
      properties: {
        id: `top-landmark-${index}`,
        name: landmark.name,
        description: landmark.description
      }
    }));
    
    const geojsonData = {
      type: 'FeatureCollection' as const,
      features
    };
    
    const source = map.current.getSource(TOP_LANDMARKS_SOURCE_ID) as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(geojsonData);
      console.log('🗺️ [Top Layer] Updated with', features.length, 'features');
    }
  }, []);

  const updateBaseLandmarksLayer = useCallback(() => {
    if (!map.current) return;
    
    console.log('🗺️ [Base Layer] Updating base landmarks GeoJSON layer with', landmarks.length, 'landmarks');
    
    // Filter out tour landmarks from base landmarks to avoid duplicates
    const baseLandmarksOnly = landmarks.filter(landmark => {
      // Check if this landmark exists in tour landmarks by name and coordinates
      return !tourLandmarks.some(tourLandmark => 
        tourLandmark.name === landmark.name &&
        Math.abs(tourLandmark.coordinates[0] - landmark.coordinates[0]) < 0.0001 &&
        Math.abs(tourLandmark.coordinates[1] - landmark.coordinates[1]) < 0.0001
      );
    });
    
    console.log('🗺️ [Base Layer] Filtered out duplicates, showing', baseLandmarksOnly.length, 'unique base landmarks');
    
    const features = baseLandmarksOnly.map((landmark) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: landmark.coordinates
      },
      properties: {
        id: landmark.id,
        name: landmark.name,
        description: landmark.description
      }
    }));
    
    const geojsonData = {
      type: 'FeatureCollection' as const,
      features
    };
    
    const source = map.current.getSource(BASE_LANDMARKS_SOURCE_ID) as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(geojsonData);
      console.log('🗺️ [Base Layer] Updated with', features.length, 'features');
    }
  }, [landmarks, tourLandmarks]);

  useEffect(() => {
    console.log('🔄 Syncing tour landmarks state:', TOUR_LANDMARKS.length);
    setTourLandmarks([...TOUR_LANDMARKS]);
  }, [TOUR_LANDMARKS.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (TOUR_LANDMARKS.length !== tourLandmarks.length) {
        console.log('🔄 Detected tour landmarks change via polling:', TOUR_LANDMARKS.length);
        setTourLandmarks([...TOUR_LANDMARKS]);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [tourLandmarks.length]);

  const storeMapMarkerInteraction = async (landmark: Landmark, imageUrl?: string) => {
    if (!user) {
      console.log('User not authenticated, skipping interaction storage');
      return;
    }

    try {
      console.log('Storing map marker interaction for:', landmark.name);
      
      const { error } = await supabase.functions.invoke('store-interaction', {
        body: {
          userInput: `Clicked on map marker: ${landmark.name}`,
          assistantResponse: landmark.description,
          destination: 'Map',
          interactionType: 'map_marker',
          landmarkCoordinates: landmark.coordinates,
          landmarkImageUrl: imageUrl
        }
      });

      if (error) {
        console.error('Error storing map marker interaction:', error);
      } else {
        console.log('Map marker interaction stored successfully');
      }
    } catch (error) {
      console.error('Error storing map marker interaction:', error);
    }
  };

  const stopCurrentAudio = () => {
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current.currentTime = 0;
      currentAudio.current = null;
    }
    setPlayingAudio({});
  };

  useEffect(() => {
    console.log('🗺️ [Map] useEffect triggered with token:', mapboxToken ? 'TOKEN_PRESENT' : 'TOKEN_EMPTY');
    
    if (!mapboxToken) {
      console.log('🗺️ [Map] No mapbox token, skipping map initialization');
      return;
    }
    
    if (!mapContainer.current) {
      console.log('🗺️ [Map] No map container ref, skipping initialization');
      return;
    }
    
    if (map.current) {
      console.log('🗺️ [Map] Map already exists, skipping initialization');
      return;
    }

    console.log('🗺️ [Map] Starting map initialization...');
    
    try {
      mapboxgl.accessToken = mapboxToken;
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        projection: { name: 'globe' },
        zoom: 1.5,
        center: [0, 20],
      });

      console.log('🗺️ [Map] Map instance created successfully');

      if (user) {
        console.log('🗺️ [Map] Adding GeolocateControl for authenticated user');
        
        const geoControl = new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 600000 // 10 minutes
          },
          trackUserLocation: true,
          showUserHeading: true,
          showAccuracyCircle: true,
          fitBoundsOptions: {
            maxZoom: 16
          }
        });
        
        geolocateControl.current = geoControl;
        
        const controlElement = geoControl._container;
        if (controlElement) {
          controlElement.addEventListener('click', () => {
            const currentState = (geoControl as any)._watchState;
            console.log('🌍 GeolocateControl: Button clicked, current state:', currentState);
            userInitiatedLocationRequest.current = true;
            lastLocationEventTime.current = Date.now();
            console.log('🌍 GeolocateControl: Marked as user-initiated request');
          });
        }
        
        geoControl.on('geolocate', (e) => {
          const currentState = (geoControl as any)._watchState;
          console.log('🌍 GeolocateControl: Location found', { 
            coordinates: [e.coords.longitude, e.coords.latitude],
            state: currentState,
            userInitiated: userInitiatedLocationRequest.current
          });
          
          setUserLocation([e.coords.longitude, e.coords.latitude]);
          
          lastLocationEventTime.current = Date.now();
          
          if (!isUpdatingFromProximitySettings.current) {
            console.log('🌍 GeolocateControl: Enabling proximity (user initiated location)');
            updateProximityEnabled(true);
          }
        });
        
        geoControl.on('trackuserlocationstart', () => {
          console.log('🌍 GeolocateControl: Started tracking user location (ACTIVE state)');
          lastLocationEventTime.current = Date.now();
          
          if (!isUpdatingFromProximitySettings.current) {
            console.log('🌍 GeolocateControl: Enabling proximity (tracking started)');
            updateProximityEnabled(true);
          }
        });
        
        geoControl.on('trackuserlocationend', () => {
          console.log('🌍 GeolocateControl: Stopped tracking user location (PASSIVE/INACTIVE state)');
          if (!isUpdatingFromProximitySettings.current) {
            console.log('🌍 GeolocateControl: Disabling proximity (tracking ended)');
            updateProximityEnabled(false);
          }
        });
        
        geoControl.on('error', (e) => {
          console.error('🌍 GeolocateControl: Error occurred', e);
          userInitiatedLocationRequest.current = false;
          if (!isUpdatingFromProximitySettings.current) {
            console.log('🌍 GeolocateControl: Disabling proximity (error occurred)');
            updateProximityEnabled(false);
          }
        });
        
        map.current.addControl(geoControl, 'top-right');

        setTimeout(() => {
          const controlContainer = document.querySelector('.mapboxgl-ctrl-top-right');
          if (controlContainer) {
            (controlContainer as HTMLElement).style.top = '10px';
          }
        }, 100);
      }

      map.current.on('style.load', () => {
        console.log('🗺️ [Map] Map style loaded, adding fog...');
        map.current?.setFog({});
      });

      map.current.on('load', () => {
        console.log('🗺️ [Layers] Map loaded, initializing all GeoJSON layers...');
        
        if (!map.current) return;
        
        map.current.addSource(TOUR_LANDMARKS_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
        
        map.current.addLayer({
          id: TOUR_LANDMARKS_LAYER_ID,
          type: 'circle',
          source: TOUR_LANDMARKS_SOURCE_ID,
          paint: {
            'circle-radius': 8,
            'circle-color': '#4ade80',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2
          }
        });
        
        map.current.addSource(TOP_LANDMARKS_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
        
        map.current.addLayer({
          id: TOP_LANDMARKS_LAYER_ID,
          type: 'circle',
          source: TOP_LANDMARKS_SOURCE_ID,
          paint: {
            'circle-radius': 6,
            'circle-color': '#facc15',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2
          }
        });
        
        map.current.addSource(BASE_LANDMARKS_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
        
        map.current.addLayer({
          id: BASE_LANDMARKS_LAYER_ID,
          type: 'circle',
          source: BASE_LANDMARKS_SOURCE_ID,
          paint: {
            'circle-radius': 6,
            'circle-color': '#a855f7',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2
          }
        });
        
        // Add route markers source and layer for numbered markers
        map.current.addSource(ROUTE_MARKERS_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
        
        map.current.addLayer({
          id: ROUTE_MARKERS_LAYER_ID,
          type: 'symbol',
          source: ROUTE_MARKERS_SOURCE_ID,
          layout: {
            'text-field': ['get', 'number'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 14,
            'text-anchor': 'center',
            'text-offset': [0, 0],
            'text-allow-overlap': true,
            'text-ignore-placement': true
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#4ade80',
            'text-halo-width': 8
          }
        });
        
        console.log('🗺️ [Layers] All GeoJSON layers initialized including route markers');
        
        const addLayerClickHandler = (layerId: string, layerType: 'tour' | 'top' | 'base') => {
          map.current!.on('click', layerId, (e) => {
            e.originalEvent.stopPropagation();
            
            const feature = e.features?.[0];
            if (!feature?.properties) return;
            
            console.log(`🗺️ [${layerType.toUpperCase()} Layer] Clicked:`, feature.properties.name);
            
            const landmark = findLandmarkByFeatureProperties(feature.properties, layerType);
            if (!landmark) {
              console.warn(`🗺️ [${layerType.toUpperCase()} Layer] Could not find landmark`);
              return;
            }
            
            const currentZoom = map.current?.getZoom() || 1.5;
            if (currentZoom < 10) {
              console.log(`🗺️ [${layerType.toUpperCase()} Layer] Zooming to landmark`);
              isZooming.current = true;
              pendingPopupLandmark.current = landmark;
              map.current?.flyTo({
                center: landmark.coordinates,
                zoom: 16,
                speed: 0.6,
                curve: 1,
                easing: (t) => t,
              });
            } else {
              showLandmarkPopup(landmark);
            }
            
            onSelectLandmark(landmark);
          });
          
          map.current!.on('mouseenter', layerId, () => {
            if (map.current) {
              map.current.getCanvas().style.cursor = 'pointer';
            }
          });
          
          map.current!.on('mouseleave', layerId, () => {
            if (map.current) {
              map.current.getCanvas().style.cursor = '';
            }
          });
        };
        
        addLayerClickHandler(TOUR_LANDMARKS_LAYER_ID, 'tour');
        addLayerClickHandler(TOP_LANDMARKS_LAYER_ID, 'top');
        addLayerClickHandler(BASE_LANDMARKS_LAYER_ID, 'base');
        
        updateTourLandmarksLayer();
        updateTopLandmarksLayer();
        updateBaseLandmarksLayer();
      });

      map.current.on('click', (e) => {
        const clickedElement = e.originalEvent.target as HTMLElement;
        const isMarkerClick = clickedElement.closest('.w-4.h-4.rounded-full') || clickedElement.closest('.w-6.h-6.rounded-full');
        
        if (!isMarkerClick) {
          stopCurrentAudio();
          
          if (currentRouteLayer.current && map.current) {
            if (map.current.getLayer(currentRouteLayer.current)) {
              map.current.removeLayer(currentRouteLayer.current);
            }
            if (map.current.getSource(currentRouteLayer.current)) {
              map.current.removeSource(currentRouteLayer.current);
            }
            currentRouteLayer.current = null;
            console.log('🗺️ Route cleared');
          }
          
          Object.values(photoPopups.current).forEach(popup => {
            popup.remove();
          });
          photoPopups.current = {};
          
          const mapboxPopups = document.querySelectorAll('.mapboxgl-popup');
          mapboxPopups.forEach(popup => {
            popup.remove();
          });
        }
      });

      map.current.on('moveend', () => {
        if (pendingPopupLandmark.current && isZooming.current) {
          const landmark = pendingPopupLandmark.current;
          pendingPopupLandmark.current = null;
          isZooming.current = false;
          
          setTimeout(() => {
            showLandmarkPopup(landmark);
          }, 100);
        }
      });

      return () => {
        console.log('🗺️ [Map] Cleanup function called');
        stopCurrentAudio();
        geolocateControl.current = null;
        map.current?.remove();
        map.current = null;
      };
    } catch (error) {
      console.error('🗺️ [Map] Error during map initialization:', error);
    }
  }, [mapboxToken, user, updateTourLandmarksLayer, updateTopLandmarksLayer, updateBaseLandmarksLayer, findLandmarkByFeatureProperties, onSelectLandmark]);

  useEffect(() => {
    updateTourLandmarksLayer();
  }, [updateTourLandmarksLayer]);

  useEffect(() => {
    updateTopLandmarksLayer();
  }, [updateTopLandmarksLayer]);

  useEffect(() => {
    updateBaseLandmarksLayer();
  }, [updateBaseLandmarksLayer]);

  useEffect(() => {
    if (!geolocateControl.current || !proximitySettings) {
      return;
    }

    console.log('🔄 Proximity settings changed:', proximitySettings);
    
    const timeSinceLastLocationEvent = Date.now() - lastLocationEventTime.current;
    const isRecentLocationEvent = timeSinceLastLocationEvent < 2000;
    
    console.log('🔄 Timing check:', {
      timeSinceLastLocationEvent,
      isRecentLocationEvent,
      userInitiated: userInitiatedLocationRequest.current
    });
    
    if (userInitiatedLocationRequest.current && isRecentLocationEvent) {
      console.log('🔄 Skipping proximity sync - recent user-initiated request in progress');
      setTimeout(() => {
        userInitiatedLocationRequest.current = false;
        console.log('🔄 Reset user-initiated flag');
      }, 3000);
      return;
    }
    
    isUpdatingFromProximitySettings.current = true;
    
    try {
      const currentWatchState = (geolocateControl.current as any)._watchState;
      const isCurrentlyTracking = currentWatchState === 'ACTIVE_LOCK';
      const isTransitioning = currentWatchState === 'WAITING_ACTIVE' || currentWatchState === 'BACKGROUND';
      const shouldBeTracking = proximitySettings.is_enabled;
      
      console.log('🔄 GeolocateControl sync check:', {
        isCurrentlyTracking,
        isTransitioning,
        shouldBeTracking,
        watchState: currentWatchState,
        willInterfere: isTransitioning && shouldBeTracking
      });
      
      if (isTransitioning) {
        console.log('🔄 Control is transitioning, avoiding interference');
        setTimeout(() => {
          isUpdatingFromProximitySettings.current = false;
        }, 500);
        return;
      }
      
      setTimeout(() => {
        try {
          const finalWatchState = (geolocateControl.current as any)._watchState;
          const finalIsTracking = finalWatchState === 'ACTIVE_LOCK';
          
          console.log('🔄 Final state check before sync:', {
            finalWatchState,
            finalIsTracking,
            shouldBeTracking
          });
          
          if (shouldBeTracking && !finalIsTracking && !isTransitioning) {
            console.log('🔄 Starting GeolocateControl tracking (proximity enabled)');
            geolocateControl.current?.trigger();
          } else if (!shouldBeTracking && finalIsTracking) {
            console.log('🔄 Stopping GeolocateControl tracking (proximity disabled)');
            geolocateControl.current?.trigger();
          } else {
            console.log('🔄 No sync needed - states already match');
          }
        } catch (error) {
          console.error('🔄 Error during delayed sync:', error);
        } finally {
          isUpdatingFromProximitySettings.current = false;
        }
      }, isRecentLocationEvent ? 1000 : 200);
      
    } catch (error) {
      console.error('🔄 Error syncing GeolocateControl with proximity settings:', error);
      isUpdatingFromProximitySettings.current = false;
    }
  }, [proximitySettings?.is_enabled]);

  const playAudioFromBase64 = async (base64Audio: string) => {
    return new Promise<void>((resolve, reject) => {
      try {
        const audioBlob = new Blob(
          [Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0))],
          { type: 'audio/mp3' }
        );
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const audio = new Audio(audioUrl);
        currentAudio.current = audio;
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudio.current = null;
          resolve();
        };
        
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          currentAudio.current = null;
          reject(new Error('Audio playback failed'));
        };
        
        audio.play().catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Enhanced photo fetching function that optimally uses place_id with fallbacks
  const fetchLandmarkPhotos = async (landmark: Landmark) => {
    try {
      console.log(`🖼️ Fetching photos for landmark: ${landmark.name}`, {
        hasPlaceId: !!landmark.placeId,
        placeId: landmark.placeId,
        landmarkId: landmark.id,
        coordinates: landmark.coordinates
      });

      // Strategy 1: Use place_id if available (optimal path)
      if (landmark.placeId) {
        console.log(`🎯 Using place_id for ${landmark.name}: ${landmark.placeId}`);
        
        const enhancedLandmark = {
          ...landmark,
          place_id: landmark.placeId,
          placeId: landmark.placeId
        };

        const result = await fetchPhotosWithHook(enhancedLandmark, {
          maxWidth: 800,
          quality: 'medium' as const,
          preferredSource: 'database' as const
        });

        if (result.photos.length > 0) {
          console.log(`✅ Photo fetch SUCCESS with place_id for ${landmark.name}: ${result.photos.length} photos`);
          return result.photos;
        }
        
        console.log(`⚠️ No photos found with place_id, trying fallback methods for ${landmark.name}`);
      }

      // Strategy 2: Fallback to coordinate-based search using Google Places Nearby API
      if (landmark.coordinates && landmark.coordinates.length === 2) {
        console.log(`🗺️ Trying coordinate-based search for ${landmark.name} at [${landmark.coordinates[0]}, ${landmark.coordinates[1]}]`);
        
        try {
          // Use the supabase function for nearby search to find place_id
          const { data: nearbyData, error: nearbyError } = await supabase.functions.invoke('google-places-nearby', {
            body: {
              coordinates: [landmark.coordinates[0], landmark.coordinates[1]], // [longitude, latitude]
              radius: 50, // Small radius for precise matching
              type: 'tourist_attraction'
            }
          });

          if (!nearbyError && nearbyData?.places && nearbyData.places.length > 0) {
            const nearbyPlace = nearbyData.places[0];
            if (nearbyPlace.placeId) {
              console.log(`🎯 Found place_id via coordinates for ${landmark.name}: ${nearbyPlace.placeId}`);
              
              const coordinateBasedLandmark = {
                ...landmark,
                place_id: nearbyPlace.placeId,
                placeId: nearbyPlace.placeId
              };

              const result = await fetchPhotosWithHook(coordinateBasedLandmark, {
                maxWidth: 800,
                quality: 'medium' as const,
                preferredSource: 'api' as const
              });

              if (result.photos.length > 0) {
                console.log(`✅ Photo fetch SUCCESS with coordinate fallback for ${landmark.name}: ${result.photos.length} photos`);
                return result.photos;
              }
            }
          }
        } catch (coordError) {
          console.warn(`⚠️ Coordinate-based search failed for ${landmark.name}:`, coordError);
        }
      }

      // Strategy 3: Fallback to text search using landmark name
      console.log(`🔍 Trying text search fallback for ${landmark.name}`);
      
      try {
        const { data: searchData, error: searchError } = await supabase.functions.invoke('google-places-search', {
          body: {
            query: `${landmark.name} landmark tourist attraction`,
            location: landmark.coordinates && landmark.coordinates.length === 2 ? {
              lat: landmark.coordinates[1],
              lng: landmark.coordinates[0]
            } : undefined,
            radius: landmark.coordinates ? 1000 : undefined // 1km radius if we have coordinates
          }
        });

        if (!searchError && searchData?.results && searchData.results.length > 0) {
          const searchPlace = searchData.results[0];
          if (searchPlace.place_id) {
            console.log(`🎯 Found place_id via text search for ${landmark.name}: ${searchPlace.place_id}`);
            
            const textSearchLandmark = {
              ...landmark,
              place_id: searchPlace.place_id,
              placeId: searchPlace.place_id
            };

            const result = await fetchPhotosWithHook(textSearchLandmark, {
              maxWidth: 800,
              quality: 'medium' as const,
              preferredSource: 'api' as const
            });

            if (result.photos.length > 0) {
              console.log(`✅ Photo fetch SUCCESS with text search fallback for ${landmark.name}: ${result.photos.length} photos`);
              return result.photos;
            }
          }
        }
      } catch (searchError) {
        console.warn(`⚠️ Text search fallback failed for ${landmark.name}:`, searchError);
      }

      // Strategy 4: Final fallback - try with just the landmark data we have
      console.log(`🔄 Final fallback attempt for ${landmark.name} using available data`);
      
      try {
        const fallbackResult = await fetchPhotosWithHook(landmark, {
          maxWidth: 800,
          quality: 'medium' as const
        });

        if (fallbackResult.photos.length > 0) {
          console.log(`✅ Photo fetch SUCCESS with final fallback for ${landmark.name}: ${fallbackResult.photos.length} photos`);
          return fallbackResult.photos;
        }
      } catch (finalError) {
        console.warn(`⚠️ Final fallback failed for ${landmark.name}:`, finalError);
      }

      console.log(`ℹ️ No photos found for ${landmark.name} after all fallback attempts`);
      return [];

    } catch (error) {
      console.error('❌ Error in enhanced photo fetching for landmark:', landmark.name, error);
      return [];
    }
  };

  const handleTextToSpeechForInteraction = async (text: string) => {
    if (!text) return;
    
    stopCurrentAudio();
    
    try {
      console.log('Playing TTS for interaction text:', text.substring(0, 100) + '...');
      
      const { data, error } = await supabase.functions.invoke('gemini-tts', {
        body: { text }
      });

      if (error) {
        console.error('TTS error for interaction:', error);
        return;
      }

      if (data?.audioContent && !data.fallbackToBrowser) {
        console.log('Playing audio from Google Cloud TTS for interaction');
        await playAudioFromBase64(data.audioContent);
      }
      
    } catch (error) {
      console.error('Error with TTS for interaction:', error);
    }
  };

  const handleTextToSpeech = async (landmark: Landmark) => {
    const landmarkId = landmark.id;
    
    if (playingAudio[landmarkId]) {
      return;
    }

    stopCurrentAudio();

    try {
      setPlayingAudio(prev => ({ ...prev, [landmarkId]: true }));
      
      let landmarkSource: 'tour' | 'top' | 'base' = 'base';
      
      if (landmarkId.startsWith('tour-landmark-')) {
        landmarkSource = 'tour';
      } else if (landmarkId.startsWith('top-landmark-')) {
        landmarkSource = 'top';
      }
      
      const text = getEnhancedLandmarkText(landmark, landmarkSource);
      
      console.log('Calling Google Cloud TTS via edge function for map marker with enhanced prompt:', text.substring(0, 100) + '...');
      
      const { data, error } = await supabase.functions.invoke('gemini-tts', {
        body: { text }
      });

      if (error) {
        console.error('Google Cloud TTS error:', error);
        return;
      }

      if (data?.audioContent && !data.fallbackToBrowser) {
        console.log('Playing audio from Google Cloud TTS for map marker');
        await playAudioFromBase64(data.audioContent);
      } else {
        console.log('No audio content received for map marker');
      }
      
    } catch (error) {
      console.error('Error with Google Cloud TTS for map marker:', error);
    } finally {
      setPlayingAudio(prev => ({ ...prev, [landmarkId]: false }));
    }
  };

  const showLandmarkPopup = async (landmark: Landmark) => {
    if (!map.current) return;
    
    console.log('🗺️ Showing popup for landmark:', landmark.name, {
      hasPlaceId: !!landmark.placeId,
      placeId: landmark.placeId
    });
    
    stopCurrentAudio();
    
    if (photoPopups.current[landmark.id]) {
      photoPopups.current[landmark.id].remove();
    }
    
    Object.values(photoPopups.current).forEach(popup => {
      popup.remove();
    });
    photoPopups.current = {};

    const streetViewDataFromUseStreetView = getCachedData(landmark.id);
    let streetViewDataFromEnhanced = null;
    try {
      streetViewDataFromEnhanced = await getStreetViewWithOfflineSupport(landmark);
    } catch (error) {
      console.log('❌ Error getting Street View from enhanced hook:', error);
    }
    
    const hasStreetView = streetViewDataFromUseStreetView !== null || streetViewDataFromEnhanced !== null;

    const popupContainer = document.createElement('div');
    popupContainer.style.width = '450px';
    popupContainer.style.maxWidth = '90vw';

    const photoPopup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 25,
      maxWidth: 'none',
      className: 'custom-popup'
    });

    photoPopup
      .setLngLat(landmark.coordinates)
      .setDOMContent(popupContainer)
      .addTo(map.current!);

    photoPopups.current[landmark.id] = photoPopup;

    photoPopup.on('close', () => {
      stopCurrentAudio();
      delete photoPopups.current[landmark.id];
    });

    try {
      // Use enhanced photo fetching with place_id optimization
      const photos = await fetchLandmarkPhotos(landmark);
      const firstPhotoUrl = photos.length > 0 ? photos[0].urls.medium : undefined;
      
      await storeMapMarkerInteraction(landmark, firstPhotoUrl);

      const root = ReactDOM.createRoot(popupContainer);

      const PopupContent = () => {
        return (
          <div className="relative">
            <button
              onClick={() => {
                photoPopup.remove();
              }}
              className="absolute top-2 right-2 z-50 bg-black/70 hover:bg-black/90 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold transition-colors"
              style={{ fontSize: '14px' }}
            >
              ×
            </button>

            <div className="absolute top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/70 to-transparent p-4">
              <h3 className="text-white font-bold text-lg pr-8">{landmark.name}</h3>
            </div>

            <div className="absolute bottom-16 right-4 z-40 flex gap-2">
              {hasStreetView && (
                <button
                  onClick={async () => {
                    try {
                      await openStreetViewModal([landmark], landmark);
                    } catch (error) {
                      console.error('❌ Error opening Street View:', error);
                    }
                  }}
                  className="bg-blue-500/95 hover:bg-blue-600 text-white border-2 border-white/90 rounded-full w-12 h-12 flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-lg"
                  title="View Street View"
                >
                  <Eye className="w-5 h-5" />
                </button>
              )}
              
              <button
                onClick={() => handleTextToSpeech(landmark)}
                disabled={playingAudio[landmark.id] || false}
                className="bg-black/90 hover:bg-blue-500/95 text-white border-2 border-white/90 rounded-full w-12 h-12 flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-lg disabled:opacity-70"
                title="Listen to description"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>

            {photos.length > 0 ? (
              <PhotoCarousel
                photos={photos}
                initialIndex={0}
                showThumbnails={photos.length > 1}
                allowZoom={true}
                className="w-full"
              />
            ) : (
              <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No photos available</p>
                </div>
              </div>
            )}
          </div>
        );
      };

      root.render(<PopupContent />);

    } catch (error) {
      console.error('❌ Failed to load photos for', landmark.name, error);
      
      await storeMapMarkerInteraction(landmark);
      
      const root = ReactDOM.createRoot(popupContainer);

      const FallbackContent = () => {
        return (
          <div className="relative">
            <button
              onClick={() => photoPopup.remove()}
              className="absolute top-2 right-2 z-50 bg-black/70 hover:bg-black/90 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold transition-colors"
            >
              ×
            </button>

            <div className="p-4">
              <h3 className="text-lg font-bold mb-3 pr-8">{landmark.name}</h3>
              <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center mb-3 relative">
                <div className="text-center">
                  <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                  <p className="text-gray-500 text-sm">No image available</p>
                </div>
                
                <div className="absolute bottom-2 right-2 flex gap-2">
                  {hasStreetView && (
                    <button
                      onClick={async () => {
                        try {
                          await openStreetViewModal([landmark], landmark);
                        } catch (error) {
                          console.error('❌ Error opening Street View:', error);
                        }
                      }}
                      className="bg-blue-500/95 hover:bg-blue-600 text-white border-2 border-white/90 rounded-full w-10 h-10 flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-lg"
                      title="View Street View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleTextToSpeech(landmark)}
                    className="bg-black/90 hover:bg-blue-500/95 text-white border-2 border-white/90 rounded-full w-10 h-10 flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-lg"
                    title="Listen to description"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      };

      root.render(<FallbackContent />);
    }
  };

  useEffect(() => {
    if (map.current && selectedLandmark) {
      console.log('Selected landmark changed:', selectedLandmark.name);
      
      const currentZoom = map.current.getZoom() || 1.5;
      
      if (currentZoom < 10) {
        console.log('Zooming to landmark from search');
        isZooming.current = true;
        pendingPopupLandmark.current = selectedLandmark;
        map.current.flyTo({
          center: selectedLandmark.coordinates,
          zoom: 16,
          speed: 0.6,
          curve: 1,
          easing: (t) => t,
        });
      } else {
        console.log('Flying to landmark and showing popup');
        map.current.flyTo({
          center: selectedLandmark.coordinates,
          zoom: 16,
          speed: 0.6,
          curve: 1,
          easing: (t) => t,
        });
        
        setTimeout(() => {
          showLandmarkPopup(selectedLandmark);
        }, 500);
      }
    }
  }, [selectedLandmark]);

  useEffect(() => {
    if (!map.current || !plannedLandmarks || plannedLandmarks.length === 0) {
      return;
    }

    const currentLandmarkIds = plannedLandmarks.map(landmark => landmark.id).sort();
    const currentLandmarkSignature = currentLandmarkIds.join(',');
    
    const previousSignature = processedPlannedLandmarks.current.join(',');
    
    if (currentLandmarkSignature === previousSignature) {
      console.log('🗺️ Planned landmarks unchanged, skipping fly-to animation');
      return;
    }

    console.log('🗺️ New planned landmarks detected, flying to show tour');
    
    processedPlannedLandmarks.current = currentLandmarkIds;

    if (plannedLandmarks.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      plannedLandmarks.forEach(landmark => {
        bounds.extend(landmark.coordinates);
      });
      map.current.fitBounds(bounds, {
        padding: 100,
        duration: 2000,
        maxZoom: 15,
      });
    } else if (plannedLandmarks.length === 1) {
      map.current.flyTo({
        center: plannedLandmarks[0].coordinates,
        zoom: 16,
        speed: 0.6,
        curve: 1,
        easing: (t) => t,
      });
    }
  }, [plannedLandmarks]);

  const navigateToCoordinates = (coordinates: [number, number], interaction?: any) => {
    console.log('=== Map Navigate Debug ===');
    console.log('navigateToCoordinates called with:', coordinates);
    console.log('Interaction data:', interaction);
    console.log('Map current exists:', !!map.current);
    
    if (!map.current) {
      console.log('ERROR: Map not initialized!');
      return;
    }
    
    console.log('Flying to coordinates...');
    map.current.flyTo({
      center: coordinates,
      zoom: 16,
      speed: 0.6,
      curve: 1,
      easing: (t) => t,
    });

    const el = document.createElement('div');
    el.className = 'w-4 h-4 rounded-full bg-red-400 border-2 border-white shadow-lg cursor-pointer transition-transform duration-300 hover:scale-125';
    el.style.transition = 'background-color 0.3s, transform 0.3s';
    
    const marker = new mapboxgl.Marker(el)
      .setLngLat(coordinates)
      .addTo(map.current);

    if (interaction) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        showInteractionPopup(coordinates, interaction);
      });
      
      setTimeout(() => {
        showInteractionPopup(coordinates, interaction);
      }, 1000);
    }

    navigationMarkers.current.push({ marker, interaction });

    console.log('Fly command sent and permanent marker added');
    console.log('=== End Map Debug ===');
  };

  const showRouteOnMap = useCallback((route: any, landmark: Landmark) => {
    if (!map.current) return;

    console.log('🗺️ Adding route to map for:', landmark.name);

    if (currentRouteLayer.current) {
      if (map.current.getLayer(currentRouteLayer.current)) {
        map.current.removeLayer(currentRouteLayer.current);
      }
      if (map.current.getSource(currentRouteLayer.current)) {
        map.current.removeSource(currentRouteLayer.current);
      }
    }

    const layerId = `route-${Date.now()}`;
    currentRouteLayer.current = layerId;

    map.current.addSource(layerId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: route.geometry
      }
    });

    map.current.addLayer({
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
    }, ROUTE_MARKERS_LAYER_ID); // Add beforeId to render route below markers

    const coordinates = route.geometry.coordinates;
    const bounds = new mapboxgl.LngLatBounds();
    coordinates.forEach((coord: [number, number]) => bounds.extend(coord));
    
    map.current.fitBounds(bounds, {
      padding: 100,
      duration: 1000
    });

    console.log(`🛣️ Route displayed: ${Math.round(route.distance)}m, ${Math.round(route.duration / 60)}min walk`);
  }, []);

  const showInteractionPopup = (coordinates: [number, number], interaction: any) => {
    if (!map.current) return;
    
    console.log('Showing interaction popup for:', interaction.user_input);
    
    stopCurrentAudio();
    
    const existingPopups = document.querySelectorAll('.mapboxgl-popup');
    existingPopups.forEach(popup => popup.remove());
    
    const popupContent = `
      <div style="text-align: center; padding: 10px; max-width: 300px; position: relative;">
        <button class="custom-close-btn" onclick="
          if (window.stopCurrentAudio) window.stopCurrentAudio();
          this.closest('.mapboxgl-popup').remove();
        " style="
          position: absolute;
          top: 5px;
          right: 5px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: bold;
          z-index: 1000;
        ">×</button>
        <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; padding-right: 30px; color: #1a1a1a;">${interaction.user_input}</h3>
        ${interaction.landmark_image_url ? `
          <div style="margin-bottom: 10px; position: relative;">
            <img src="${interaction.landmark_image_url}" alt="Landmark" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px;" />
            <button 
              class="interaction-listen-btn-${interaction.id}" 
              onclick="window.handleInteractionListen('${interaction.id}')"
              style="
                position: absolute;
                bottom: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                border: 3px solid rgba(255, 255, 255, 0.9);
                border-radius: 50%;
                width: 56px;
                height: 56px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
              "
              onmouseover="this.style.backgroundColor='rgba(59, 130, 246, 0.95)'; this.style.borderColor='white'; this.style.transform='scale(1.15)'; this.style.boxShadow='0 6px 20px rgba(0, 0, 0, 0.5)'"
              onmouseout="this.style.backgroundColor='rgba(0, 0, 0, 0.9)'; this.style.borderColor='rgba(255, 255, 255, 0.9)'; this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.4)'"
              title="Listen to description"
            >
              🔊
            </button>
          </div>
        ` : `
          <div style="width: 100%; height: 120px; background-color: #f0f0f0; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #888; position: relative;">
            No image available
            <button 
              class="interaction-listen-btn-${interaction.id}" 
              onclick="window.handleInteractionListen('${interaction.id}')"
              style="
                position: absolute;
                bottom: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                border: 3px solid rgba(255, 255, 255, 0.9);
                border-radius: 50%;
                width: 56px;
                height: 56px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
              "
              onmouseover="this.style.backgroundColor='rgba(59, 130, 246, 0.95)'; this.style.borderColor='white'; this.style.transform='scale(1.15)'; this.style.boxShadow='0 6px 20px rgba(0, 0, 0, 0.5)'"
              onmouseout="this.style.backgroundColor='rgba(0, 0, 0, 0.9)'; this.style.borderColor='rgba(255, 255, 255, 0.9)'; this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.4)'"
              title="Listen to description"
            >
              🔊
            </button>
          </div>
        `}
      </div>
    `;
    
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 25,
      maxWidth: '350px',
      className: 'custom-popup'
    })
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map.current);

    popup.on('close', () => {
      stopCurrentAudio();
    });
  };

  useEffect(() => {
    if (!map.current) return;

    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
      const clickedElement = e.originalEvent.target as HTMLElement;
      const isMarkerClick = clickedElement.closest('.w-4.h-4.rounded-full') || clickedElement.closest('.w-6.h-6.rounded-full');
      
      if (!isMarkerClick) {
        stopCurrentAudio();
        
        if (currentRouteLayer.current && map.current) {
          if (map.current.getLayer(currentRouteLayer.current)) {
            map.current.removeLayer(currentRouteLayer.current);
          }
          if (map.current.getSource(currentRouteLayer.current)) {
            map.current.removeSource(currentRouteLayer.current);
          }
          currentRouteLayer.current = null;
          console.log('🗺️ Route cleared');
        }
        
        Object.values(photoPopups.current).forEach(popup => {
          popup.remove();
        });
        photoPopups.current = {};
        
        const mapboxPopups = document.querySelectorAll('.mapboxgl-popup');
        mapboxPopups.forEach(popup => {
          popup.remove();
        });
      }
    };

    map.current.on('click', handleMapClick);
    
    return () => {
      if (map.current) {
        map.current.off('click', handleMapClick);
      }
    };
  }, []);

  React.useEffect(() => {
    console.log('Setting up global map functions');
    (window as any).navigateToMapCoordinates = navigateToCoordinates;
    (window as any).stopCurrentAudio = stopCurrentAudio;
    (window as any).showRouteOnMap = showRouteOnMap;
    
    (window as any).handleInteractionListen = (interactionId: string) => {
      const markerData = navigationMarkers.current.find(m => m.interaction?.id === interactionId);
      if (markerData?.interaction?.assistant_response) {
        handleTextToSpeechForInteraction(markerData.interaction.assistant_response);
      }
    };

    (window as any).handleStreetViewOpen = async (landmarkId: string) => {
      console.log('🔍 handleStreetViewOpen called with landmark ID:', landmarkId);
      
      let targetLandmark: Landmark | null = null;
      
      targetLandmark = landmarks.find(l => l.id === landmarkId) || null;
      
      if (!targetLandmark) {
        const topIndex = TOP_LANDMARKS.findIndex((_, index) => `top-landmark-${index}` === landmarkId);
        if (topIndex !== -1) {
          const topLandmark = TOP_LANDMARKS[topIndex];
          targetLandmark = {
            id: landmarkId,
            name: topLandmark.name,
            coordinates: topLandmark.coordinates,
            description: topLandmark.description
          };
        }
      }
      
      if (!targetLandmark) {
        const tourIndex = TOUR_LANDMARKS.findIndex((_, index) => `tour-landmark-${index}` === landmarkId);
        if (tourIndex !== -1) {
          const tourLandmark = TOUR_LANDMARKS[tourIndex];
          targetLandmark = {
            id: landmarkId,
            name: tourLandmark.name,
            coordinates: tourLandmark.coordinates,
            description: tourLandmark.description
          };
        }
      }
      
      console.log('🎯 Found landmark:', targetLandmark?.name);
      
      if (targetLandmark) {
        console.log(`🔍 Opening Street View modal for ${targetLandmark.name} from layer click`);
        try {
          await openStreetViewModal([targetLandmark], targetLandmark);
          console.log('✅ openStreetViewModal call completed');
        } catch (error) {
          console.error('❌ Error calling openStreetViewModal:', error);
        }
      } else {
        console.error('❌ Landmark not found for ID:', landmarkId);
      }
    };

    return () => {
      console.log('Cleaning up global map functions');
      delete (window as any).navigateToMapCoordinates;
      delete (window as any).handleInteractionListen;
      delete (window as any).stopCurrentAudio;
      delete (window as any).showRouteOnMap;
      delete (window as any).handleStreetViewOpen;
    };
  }, [showRouteOnMap, navigateToCoordinates, openStreetViewModal, landmarks]);

  useEffect(() => {
    if (!map.current) return;

    // Add route source and layer if route exists
    if (routeGeoJSON) {
      const sourceId = 'optimal-route-source';
      const layerId = 'optimal-route-layer';

      // Remove existing route if any
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }

      // Add new route
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: routeGeoJSON
        }
      });

      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#FF4444',
          'line-width': 4,
          'line-opacity': 0.8
        }
      }, ROUTE_MARKERS_LAYER_ID); // Add beforeId to render route below markers

      // Fit bounds to show the entire route
      const bounds = new mapboxgl.LngLatBounds();
      routeGeoJSON.coordinates.forEach(coord => bounds.extend(coord as [number, number]));
      
      if (!bounds.isEmpty()) {
        map.current.fitBounds(bounds, {
          padding: 80,
          duration: 1500,
          maxZoom: 16
        });
      }

      console.log('🗺️ Optimal route visualized on map');
    } else {
      // Clean up route when routeGeoJSON is null
      const sourceId = 'optimal-route-source';
      const layerId = 'optimal-route-layer';
      
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
      
      console.log('🧹 Optimal route removed from map');
    }
  }, [routeGeoJSON]);

  // Add new useEffect to manage route markers
  useEffect(() => {
    if (!map.current) return;

    console.log('🎯 Updating route markers, optimizedLandmarks count:', optimizedLandmarks.length);

    // Create GeoJSON features for the numbered markers
    const features = optimizedLandmarks.map((landmark, index) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: landmark.coordinates
      },
      properties: {
        number: (index + 1).toString(),
        landmarkId: landmark.placeId || `landmark-${index}`,
        name: landmark.name
      }
    }));

    const geojsonData = {
      type: 'FeatureCollection' as const,
      features
    };

    // Update the route markers source
    const source = map.current.getSource(ROUTE_MARKERS_SOURCE_ID) as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(geojsonData);
      console.log('🎯 Route markers updated:', features.length, 'markers');
    }
  }, [optimizedLandmarks]);

  const handleOptimalRoute = useCallback(async () => {
    // Check if we have enough tour landmarks first
    if (tourLandmarks.length < 2) {
      toast.error("At least 2 tour landmarks are needed for route optimization");
      return;
    }

    try {
      // Step 1: Always enable proximity first
      console.log('🎯 Auto-enabling proximity for optimal route calculation');
      updateProximityEnabled(true);
      
      // Check current permission status
      const currentPermissionState = await checkPermission();
      
      if (currentPermissionState === 'denied') {
        toast.error("Location permission is denied. Please enable location access in your browser settings.");
        return;
      }

      let currentLocation: [number, number] | null = userLocation;

      // If we don't have a current location, request it on-demand
      if (!currentLocation) {
        console.log('🎯 Requesting location on-demand for optimal route');
        
        // Try to request permission if it's in prompt state
        if (currentPermissionState === 'prompt') {
          const permissionGranted = await requestPermission();
          if (!permissionGranted) {
            toast.error("Location permission is required for route optimization");
            return;
          }
        }

        // Get current position
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000 // Allow 5-minute old location
              }
            );
          });

          currentLocation = [position.coords.longitude, position.coords.latitude];
          setUserLocation(currentLocation);
          console.log('✅ Location obtained on-demand:', currentLocation);
        } catch (error) {
          console.error('❌ Failed to get location on-demand:', error);
          toast.error("Could not get your current location. Please try again.");
          return;
        }
      }

      if (!currentLocation) {
        toast.error("Unable to determine your location for route optimization");
        return;
      }

      console.log('🎯 Starting optimal route calculation with proximity enabled:', {
        currentLocation,
        tourLandmarksCount: tourLandmarks.length,
        proximityEnabled: true
      });

      await calculateOptimalRoute(currentLocation, tourLandmarks);
    } catch (error) {
      console.error('❌ Error in handleOptimalRoute:', error);
      toast.error("Failed to calculate optimal route. Please try again.");
    }
  }, [tourLandmarks, calculateOptimalRoute, userLocation, checkPermission, requestPermission, updateProximityEnabled]);

  // Determine if the optimal route button should be enabled
  const isOptimalRouteButtonEnabled = !isCalculatingRoute && 
                                    permissionState.state !== 'denied' && 
                                    tourLandmarks.length >= 2;

  // Generate tooltip text based on current conditions
  const getOptimalRouteTooltip = () => {
    if (permissionState.state === 'denied') {
      return "Location permission denied - enable in browser settings";
    }
    if (isCalculatingRoute) {
      return "Calculating route...";
    }
    if (tourLandmarks.length < 2) {
      return "At least 2 tour landmarks needed";
    }
    if (routeGeoJSON) {
      return "Calculate new optimal route";
    }
    return "Calculate optimal walking route";
  };

  return (
    <>
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Optimal Route Button - styled to match location button */}
      {tourLandmarks.length > 0 && (
        <div className="absolute top-[58px] right-[10px] z-10">
          <button
            onClick={handleOptimalRoute}
            disabled={!isOptimalRouteButtonEnabled}
            className="w-8 h-8 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:opacity-50 rounded border border-gray-200 shadow-md flex items-center justify-center transition-all duration-200 disabled:cursor-not-allowed"
            title={getOptimalRouteTooltip()}
          >
            {isCalculatingRoute ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin"></div>
            ) : (
              <Route className="w-4 h-4 text-gray-700" />
            )}
          </button>
        </div>
      )}

      {/* Clear Route Button - only show when route exists */}
      {routeGeoJSON && (
        <div className="absolute top-[100px] right-[10px] z-10">
          <button
            onClick={clearRoute}
            className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded border border-gray-200 shadow-md flex items-center justify-center transition-all duration-200"
            title="Clear optimal route"
          >
            ×
          </button>
        </div>
      )}

      {/* Route Stats - compact version */}
      {routeStats && (
        <div className="absolute top-[142px] right-[10px] z-10 bg-white/95 backdrop-blur-sm rounded border border-gray-200 shadow-md p-2 text-xs max-w-[120px]">
          <div className="text-gray-800 space-y-1">
            <div>📏 {routeStats.distanceKm}km</div>
            <div>⏱️ {routeStats.durationText}</div>
            <div>📍 {routeStats.waypointCount} stops</div>
          </div>
        </div>
      )}

      <EnhancedStreetViewModal
        isOpen={isModalOpen}
        onClose={closeStreetViewModal}
        streetViewItems={streetViewItems}
        initialIndex={currentIndex}
        onLocationSelect={(coordinates) => {
          navigateToCoordinates(coordinates);
          closeStreetViewModal();
        }}
      />
    </>
  );
};

export default MapComponent;
