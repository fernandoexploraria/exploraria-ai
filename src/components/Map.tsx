import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Volume2, VolumeX } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { supabase } from '@/integrations/supabase/client';

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
  plannedLandmarks: Landmark[];
}

// Google API key
const GOOGLE_API_KEY = 'AIzaSyCjQKg2W9uIrIx4EmRnyf3WCkO4eeEvpyg';

const Map: React.FC<MapProps> = ({ mapboxToken, landmarks, onSelectLandmark, selectedLandmark, plannedLandmarks }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const imageCache = useRef<{ [key: string]: string }>({});
  const photoPopups = useRef<{ [key: string]: mapboxgl.Popup }>({});
  const [playingAudio, setPlayingAudio] = useState<{ [key: string]: boolean }>({});
  const pendingPopupLandmark = useRef<Landmark | null>(null);
  const isZooming = useRef<boolean>(false);

  // Convert top landmarks to Landmark format
  const allLandmarksWithTop = React.useMemo(() => {
    const topLandmarksConverted: Landmark[] = TOP_LANDMARKS.map((topLandmark, index) => ({
      id: `top-landmark-${index}`,
      name: topLandmark.name,
      coordinates: topLandmark.coordinates,
      description: topLandmark.description
    }));
    
    return [...landmarks, ...topLandmarksConverted];
  }, [landmarks]);

  // Initialize map (runs once)
  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || map.current) return;

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

    // Close all popups when clicking on the map
    map.current.on('click', (e) => {
      // Check if the click was on a marker by looking for our marker class
      const clickedElement = e.originalEvent.target as HTMLElement;
      const isMarkerClick = clickedElement.closest('.w-4.h-4.rounded-full');
      
      if (!isMarkerClick) {
        // Close all photo popups
        Object.values(photoPopups.current).forEach(popup => {
          popup.remove();
        });
        photoPopups.current = {};
        
        // Also close any Mapbox popups that might be open
        const mapboxPopups = document.querySelectorAll('.mapboxgl-popup');
        mapboxPopups.forEach(popup => {
          popup.remove();
        });
      }
    });

    // Handle moveend event to show popup after zoom completes
    map.current.on('moveend', () => {
      if (pendingPopupLandmark.current && isZooming.current) {
        const landmark = pendingPopupLandmark.current;
        pendingPopupLandmark.current = null;
        isZooming.current = false;
        
        // Small delay to ensure zoom animation is fully complete
        setTimeout(() => {
          showLandmarkPopup(landmark);
        }, 100);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  // Function to handle text-to-speech
  const handleTextToSpeech = async (landmark: Landmark) => {
    const landmarkId = landmark.id;
    
    if (playingAudio[landmarkId]) {
      return; // Already playing
    }

    try {
      setPlayingAudio(prev => ({ ...prev, [landmarkId]: true }));
      
      // Try browser speech synthesis first
      const utterance = new SpeechSynthesisUtterance(`${landmark.name}. ${landmark.description}`);
      utterance.onend = () => {
        setPlayingAudio(prev => ({ ...prev, [landmarkId]: false }));
      };
      utterance.onerror = () => {
        setPlayingAudio(prev => ({ ...prev, [landmarkId]: false }));
      };
      
      speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      setPlayingAudio(prev => ({ ...prev, [landmarkId]: false }));
    }
  };

  // Function to fetch landmark image using Supabase edge function
  const fetchLandmarkImage = async (landmark: Landmark): Promise<string> => {
    const cacheKey = `${landmark.name}-${landmark.coordinates[0]}-${landmark.coordinates[1]}`;
    
    if (imageCache.current[cacheKey]) {
      console.log('Using cached image for:', landmark.name);
      return imageCache.current[cacheKey];
    }

    try {
      console.log('Fetching image via edge function for:', landmark.name);
      
      const { data, error } = await supabase.functions.invoke('fetch-landmark-image', {
        body: { 
          landmarkName: landmark.name,
          coordinates: landmark.coordinates
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data && data.imageUrl) {
        console.log('Received image URL for:', landmark.name, data.isFallback ? '(fallback)' : '(Google Places)');
        imageCache.current[cacheKey] = data.imageUrl;
        return data.imageUrl;
      }

      throw new Error('No image URL received from edge function');
      
    } catch (error) {
      console.error('Error fetching image for', landmark.name, error);
      
      // Fallback to a seeded placeholder image
      console.log('Using local fallback image for:', landmark.name);
      const seed = landmark.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const fallbackUrl = `https://picsum.photos/seed/${seed}/400/300`;
      imageCache.current[cacheKey] = fallbackUrl;
      return fallbackUrl;
    }
  };

  // Function to show landmark popup
  const showLandmarkPopup = async (landmark: Landmark) => {
    if (!map.current) return;
    
    console.log('Showing popup for:', landmark.name);
    
    // Remove existing photo popup for this landmark
    if (photoPopups.current[landmark.id]) {
      photoPopups.current[landmark.id].remove();
    }
    
    // Close all other popups first
    Object.values(photoPopups.current).forEach(popup => {
      popup.remove();
    });
    photoPopups.current = {};
    
    // Create new photo popup with image and listen button
    const photoPopup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 25,
      maxWidth: '450px',
      className: 'custom-popup'
    });

    // Initial popup with loading state
    photoPopup
      .setLngLat(landmark.coordinates)
      .setHTML(`
        <div style="text-align: center; padding: 10px; position: relative;">
          <button class="custom-close-btn" onclick="this.closest('.mapboxgl-popup').remove()" style="
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
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='rgba(0, 0, 0, 0.9)'" onmouseout="this.style.backgroundColor='rgba(0, 0, 0, 0.7)'">×</button>
          <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; padding-right: 30px; color: #1a1a1a;">${landmark.name}</h3>
          <div style="margin-bottom: 10px; color: #666;">Loading image...</div>
        </div>
      `)
      .addTo(map.current!);

    photoPopups.current[landmark.id] = photoPopup;

    // Handle popup close event
    photoPopup.on('close', () => {
      delete photoPopups.current[landmark.id];
    });

    // Fetch and display image with listen button
    try {
      const imageUrl = await fetchLandmarkImage(landmark);
      const isPlaying = playingAudio[landmark.id] || false;
      
      photoPopup.setHTML(`
        <div style="text-align: center; padding: 10px; max-width: 400px; position: relative;">
          <button class="custom-close-btn" onclick="this.closest('.mapboxgl-popup').remove()" style="
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
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='rgba(0, 0, 0, 0.9)'" onmouseout="this.style.backgroundColor='rgba(0, 0, 0, 0.7)'">×</button>
          <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; padding-right: 30px; color: #1a1a1a;">${landmark.name}</h3>
          <div style="position: relative; margin-bottom: 10px;">
            <img src="${imageUrl}" alt="${landmark.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px;" />
            <button 
              class="listen-btn-${landmark.id}" 
              onclick="window.handleLandmarkListen('${landmark.id}')"
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
                ${isPlaying ? 'opacity: 0.7;' : ''}
              "
              onmouseover="this.style.backgroundColor='rgba(59, 130, 246, 0.95)'; this.style.borderColor='white'; this.style.transform='scale(1.15)'; this.style.boxShadow='0 6px 20px rgba(0, 0, 0, 0.5)'"
              onmouseout="this.style.backgroundColor='rgba(0, 0, 0, 0.9)'; this.style.borderColor='rgba(255, 255, 255, 0.9)'; this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.4)'"
              ${isPlaying ? 'disabled' : ''}
              title="Listen to description"
            >
              🔊
            </button>
          </div>
        </div>
      `);

      // Add global handler for listen button if it doesn't exist
      if (!(window as any).handleLandmarkListen) {
        (window as any).handleLandmarkListen = (landmarkId: string) => {
          const targetLandmark = allLandmarksWithTop.find(l => l.id === landmarkId);
          if (targetLandmark) {
            handleTextToSpeech(targetLandmark);
          }
        };
      }

    } catch (error) {
      console.error('Failed to load image for', landmark.name, error);
      photoPopup.setHTML(`
        <div style="text-align: center; padding: 10px; max-width: 400px; position: relative;">
          <button class="custom-close-btn" onclick="this.closest('.mapboxgl-popup').remove()" style="
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
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='rgba(0, 0, 0, 0.9)'" onmouseout="this.style.backgroundColor='rgba(0, 0, 0, 0.7)'">×</button>
          <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; padding-right: 30px; color: #1a1a1a;">${landmark.name}</h3>
          <div style="width: 100%; height: 150px; background-color: #f0f0f0; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #888; position: relative;">
            No image available
            <button 
              class="listen-btn-${landmark.id}" 
              onclick="window.handleLandmarkListen('${landmark.id}')"
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
        </div>
      `);
    }
  };

  // Update markers when landmarks change
  useEffect(() => {
    if (!map.current) return;

    const landmarkIds = new Set(allLandmarksWithTop.map(l => l.id));

    // Remove markers that are no longer in the landmarks list
    Object.keys(markers.current).forEach(markerId => {
      if (!landmarkIds.has(markerId)) {
        markers.current[markerId].remove();
        delete markers.current[markerId];
        if (photoPopups.current[markerId]) {
          photoPopups.current[markerId].remove();
          delete photoPopups.current[markerId];
        }
      }
    });

    // Add new markers
    allLandmarksWithTop.forEach((landmark) => {
      if (!markers.current[landmark.id]) {
        const el = document.createElement('div');
        
        // Different styling for top landmarks vs user landmarks
        const isTopLandmark = landmark.id.startsWith('top-landmark-');
        const markerColor = isTopLandmark ? 'bg-yellow-400' : 'bg-cyan-400';
        
        el.className = `w-4 h-4 rounded-full ${markerColor} border-2 border-white shadow-lg cursor-pointer transition-transform duration-300 hover:scale-125`;
        el.style.transition = 'background-color 0.3s, transform 0.3s';
        
        const marker = new mapboxgl.Marker(el)
          .setLngLat(landmark.coordinates)
          .addTo(map.current!);

        marker.getElement().addEventListener('click', async (e) => {
          e.stopPropagation(); // Prevent map click event
          
          console.log('Marker clicked:', landmark.name);
          
          // Check current zoom level and zoom in if needed
          const currentZoom = map.current?.getZoom() || 1.5;
          if (currentZoom < 10) {
            isZooming.current = true;
            pendingPopupLandmark.current = landmark;
            map.current?.flyTo({
              center: landmark.coordinates,
              zoom: 14,
              speed: 0.7,
              curve: 1,
              easing: (t) => t,
            });
          } else {
            // Show popup immediately for marker clicks when already zoomed
            showLandmarkPopup(landmark);
          }
          
          // Call the landmark selection handler to update the selected landmark
          onSelectLandmark(landmark);
        });

        markers.current[landmark.id] = marker;
      }
    });

  }, [allLandmarksWithTop, playingAudio, onSelectLandmark]);

  // Fly to selected landmark and update marker styles
  useEffect(() => {
    if (map.current && selectedLandmark) {
      console.log('Selected landmark changed:', selectedLandmark.name);
      
      const currentZoom = map.current.getZoom() || 1.5;
      
      // Always zoom and show popup for search selections
      if (currentZoom < 10) {
        console.log('Zooming to landmark from search');
        isZooming.current = true;
        pendingPopupLandmark.current = selectedLandmark;
        map.current.flyTo({
          center: selectedLandmark.coordinates,
          zoom: 14,
          speed: 0.7,
          curve: 1,
          easing: (t) => t,
        });
      } else {
        // If already zoomed in, just fly to the new location and show popup
        console.log('Flying to landmark and showing popup');
        map.current.flyTo({
          center: selectedLandmark.coordinates,
          zoom: 14,
          speed: 0.7,
          curve: 1,
          easing: (t) => t,
        });
        
        // Show popup after a short delay
        setTimeout(() => {
          showLandmarkPopup(selectedLandmark);
        }, 500);
      }
    }

    Object.entries(markers.current).forEach(([id, marker]) => {
      const element = marker.getElement();
      const isSelected = id === selectedLandmark?.id;
      const isTopLandmark = id.startsWith('top-landmark-');
      
      if (isSelected) {
        element.style.backgroundColor = '#f87171'; // red-400
        element.style.transform = 'scale(1.5)';
      } else {
        element.style.backgroundColor = isTopLandmark ? '#facc15' : '#22d3ee'; // yellow-400 or cyan-400
        element.style.transform = 'scale(1)';
      }
    });

  }, [selectedLandmark]);

  // Zooms to fit planned landmarks when a new tour is generated
  useEffect(() => {
    if (!map.current || !plannedLandmarks || plannedLandmarks.length === 0) {
      return;
    }

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
        zoom: 14,
        speed: 0.7,
        curve: 1,
        easing: (t) => t,
      });
    }
  }, [plannedLandmarks]);

  return <div ref={mapContainer} className="absolute inset-0" />;
};

export default Map;
