
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Headphones, Camera, X, Users } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { toast } from 'sonner';
import { useTourDetails } from '@/hooks/useTourDetails';
import EnhancedLandmarkInfo from './landmark/EnhancedLandmarkInfo';
import { EnhancedLandmarkData } from '@/utils/landmarkDisplayUtils';

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  userLocation?: { latitude: number; longitude: number } | null;
  onLandmarkClick?: (landmark: Landmark) => void;
  onSelectLandmark?: (landmark: Landmark) => void;
  onGetDirections?: (landmark: Landmark) => void;
  onShowStreetView?: (landmark: Landmark) => void;
  onPlayAudio?: (landmark: Landmark) => void;
  selectedLandmark?: Landmark | null;
  plannedLandmarks?: Landmark[];
  className?: string;
  onProximityServiceClick?: (landmark: Landmark) => void;
}

const Map: React.FC<MapProps> = ({
  mapboxToken,
  landmarks,
  userLocation,
  onLandmarkClick,
  onSelectLandmark,
  onGetDirections,
  onShowStreetView,
  onPlayAudio,
  selectedLandmark,
  plannedLandmarks = [],
  className = '',
  onProximityServiceClick
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [currentPopup, setCurrentPopup] = useState<mapboxgl.Popup | null>(null);
  const { tourDetails } = useTourDetails(landmarks);

  const getEnhancedLandmarkData = useCallback((landmark: Landmark): EnhancedLandmarkData | undefined => {
    if (!tourDetails?.landmarksWithRawData) return undefined;
    
    // Find matching landmark in tour details by name or coordinates
    const enhancedLandmark = tourDetails.landmarksWithRawData.find(tourLandmark => 
      tourLandmark.name === landmark.name ||
      (Math.abs(tourLandmark.latitude - landmark.coordinates[1]) < 0.0001 &&
       Math.abs(tourLandmark.longitude - landmark.coordinates[0]) < 0.0001)
    );

    if (!enhancedLandmark) return undefined;

    // Extract enhanced data from raw_data or direct fields
    const rawData = enhancedLandmark.raw_data;
    
    return {
      rating: rawData?.rating || enhancedLandmark.rating,
      user_ratings_total: rawData?.user_ratings_total || enhancedLandmark.user_ratings_total,
      opening_hours: rawData?.opening_hours || enhancedLandmark.opening_hours,
      editorial_summary: rawData?.editorial_summary || enhancedLandmark.editorial_summary,
      formatted_address: rawData?.formatted_address || enhancedLandmark.formatted_address,
      website: rawData?.website || enhancedLandmark.website_uri,
      types: rawData?.types || enhancedLandmark.types,
      price_level: rawData?.price_level || enhancedLandmark.price_level,
      raw_data: rawData,
      photos: rawData?.photos || enhancedLandmark.photos
    };
  }, [tourDetails]);

  const createLandmarkPopup = useCallback((landmark: Landmark) => {
    if (currentPopup) {
      currentPopup.remove();
    }

    const enhancedData = getEnhancedLandmarkData(landmark);
    
    // Create popup container
    const popupContainer = document.createElement('div');
    popupContainer.className = 'landmark-popup-container';
    
    // Create popup content with enhanced info
    const popupContent = `
      <div class="bg-gray-900 p-4 rounded-lg shadow-xl max-w-sm">
        <!-- Enhanced landmark info will be rendered here by React -->
        <div id="enhanced-landmark-info-${landmark.id}"></div>
        
        <!-- Photo Carousel Placeholder -->
        <div class="mt-3 mb-3">
          <div class="w-full h-32 bg-gray-800 rounded-lg flex items-center justify-center">
            <Camera class="w-8 h-8 text-gray-500" />
            <span class="ml-2 text-gray-500 text-sm">Loading photos...</span>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex gap-2 mt-3">
          <button 
            id="street-view-btn-${landmark.id}" 
            class="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Street View
          </button>
          
          <button 
            id="directions-btn-${landmark.id}" 
            class="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
            </svg>
            Directions
          </button>
          
          <button 
            id="audio-btn-${landmark.id}" 
            class="bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 px-3 rounded-lg transition-colors flex items-center justify-center"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M9 9a3 3 0 000 6v-6zm0 0V7a1 1 0 011-1h4a1 1 0 011 1v2" />
            </svg>
          </button>
        </div>
        
        ${onProximityServiceClick ? `
          <button 
            id="services-btn-${landmark.id}" 
            class="w-full mt-2 bg-orange-600 hover:bg-orange-700 text-white text-sm py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Find Nearby Services
          </button>
        ` : ''}
      </div>
    `;

    popupContainer.innerHTML = popupContent;

    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: '350px',
      className: 'landmark-popup'
    })
      .setLngLat([landmark.coordinates[0], landmark.coordinates[1]])
      .setDOMContent(popupContainer)
      .addTo(map.current!);

    // Render enhanced landmark info using React
    setTimeout(() => {
      const enhancedInfoContainer = document.getElementById(`enhanced-landmark-info-${landmark.id}`);
      if (enhancedInfoContainer) {
        const { createRoot } = require('react-dom/client');
        const root = createRoot(enhancedInfoContainer);
        root.render(React.createElement(EnhancedLandmarkInfo, {
          landmark,
          enhancedData,
          className: 'mb-3'
        }));
      }
    }, 0);

    // Add event listeners for buttons
    setTimeout(() => {
      const streetViewBtn = document.getElementById(`street-view-btn-${landmark.id}`);
      const directionsBtn = document.getElementById(`directions-btn-${landmark.id}`);
      const audioBtn = document.getElementById(`audio-btn-${landmark.id}`);
      const servicesBtn = document.getElementById(`services-btn-${landmark.id}`);

      if (streetViewBtn) {
        streetViewBtn.addEventListener('click', () => {
          console.log(`🗺️ Street View clicked for: ${landmark.name}`);
          onShowStreetView?.(landmark);
        });
      }

      if (directionsBtn) {
        directionsBtn.addEventListener('click', () => {
          console.log(`🧭 Directions clicked for: ${landmark.name}`);
          onGetDirections?.(landmark);
        });
      }

      if (audioBtn) {
        audioBtn.addEventListener('click', () => {
          console.log(`🎧 Audio clicked for: ${landmark.name}`);
          onPlayAudio?.(landmark);
        });
      }

      if (servicesBtn) {
        servicesBtn.addEventListener('click', () => {
          console.log(`🏪 Services clicked for: ${landmark.name}`);
          onProximityServiceClick?.(landmark);
        });
      }
    }, 100);

    setCurrentPopup(popup);

    popup.on('close', () => {
      setCurrentPopup(null);
    });

    return popup;
  }, [getEnhancedLandmarkData, onShowStreetView, onGetDirections, onPlayAudio, onProximityServiceClick, currentPopup]);

  useEffect(() => {
    if (mapboxToken && !map.current) {
      mapboxgl.accessToken = mapboxToken;

      const newMap = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-73.9857, 40.7589],
        zoom: 12,
      });

      // Add navigation control (the +/- zoom buttons)
      newMap.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add geolocate control to the map.
      newMap.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true
          },
          trackUserLocation: true,
          showUserHeading: true
        })
      );

      map.current = newMap;

      newMap.on('load', () => {
        // Load landmark markers
        landmarks.forEach((landmark) => {
          const el = document.createElement('div');
          el.className = 'marker';
          el.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 13.5C12.8284 13.5 13.5 12.8284 13.5 12C13.5 11.1716 12.8284 10.5 12 10.5C11.1716 10.5 10.5 11.1716 10.5 12C10.5 12.8284 11.1716 13.5 12 13.5Z" fill="#fff"/>
              <path d="M12 2C7.58172 2 4 5.58172 4 9.5C4 15.3733 11.1267 21.6 11.2546 21.7111C11.6445 22.0544 12.2986 22.0544 12.6885 21.7111C12.8164 21.6 20 15.3733 20 9.5C20 5.58172 16.4183 2 12 2ZM12 15.5C10.067 15.5 8.5 13.933 8.5 12C8.5 10.067 10.067 8.5 12 8.5C13.933 8.5 15.5 10.067 15.5 12C15.5 13.933 13.933 15.5 12 15.5Z" fill="#fff"/>
            </svg>
          `;

          el.addEventListener('click', (e) => {
            e.stopPropagation();
            createLandmarkPopup(landmark);
            onLandmarkClick?.(landmark);
            onSelectLandmark?.(landmark);
          });

          new mapboxgl.Marker(el)
            .setLngLat([landmark.coordinates[0], landmark.coordinates[1]])
            .addTo(newMap);
        });

        // Fly to the selected landmark if available
        if (selectedLandmark) {
          flyToLandmark(selectedLandmark);
        }
      });

      newMap.on('click', () => {
        if (currentPopup) {
          currentPopup.remove();
          setCurrentPopup(null);
        }
      });

      // Clean up on unmount
      return () => {
        newMap.remove();
        map.current = null;
      };
    }
  }, [mapboxToken, landmarks, onLandmarkClick, onSelectLandmark, selectedLandmark, createLandmarkPopup]);

  useEffect(() => {
    if (map.current && userLocation) {
      map.current.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 14,
        duration: 3000,
        essential: true
      });
    }
  }, [userLocation]);

  useEffect(() => {
    if (map.current && selectedLandmark) {
      flyToLandmark(selectedLandmark);
    }
  }, [selectedLandmark]);

  const flyToLandmark = (landmark: Landmark) => {
    map.current?.flyTo({
      center: [landmark.coordinates[0], landmark.coordinates[1]],
      zoom: 16,
      duration: 2000,
      essential: true
    });
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
};

export default Map;
