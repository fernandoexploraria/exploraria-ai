import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Volume2, VolumeX } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
  plannedLandmarks: Landmark[];
}

// Google API key
const GOOGLE_API_KEY = 'AIzaSyCjQKg2W9uIrIx4EmRnyf3WCkO4eeEvpyg';

const Map: React.FC<MapProps> = ({ 
  mapboxToken, 
  landmarks, 
  onSelectLandmark, 
  selectedLandmark, 
  plannedLandmarks
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const imageCache = useRef<{ [key: string]: string }>({});
  const photoPopups = useRef<{ [key: string]: mapboxgl.Popup }>({});
  const [playingAudio, setPlayingAudio] = useState<{ [key: string]: boolean }>({});
  const pendingPopupLandmark = useRef<Landmark | null>(null);
  const isZooming = useRef<boolean>(false);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const navigationMarkers = useRef<{ marker: mapboxgl.Marker; interaction: any }[]>([]);
  const { user } = useAuth();

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

  // Function to store map marker interaction
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

  // Function to stop current audio playback
  const stopCurrentAudio = () => {
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current.currentTime = 0;
      currentAudio.current = null;
    }
    setPlayingAudio({});
  };

  // Initialize map (runs once)
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

      map.current.on('style.load', () => {
        console.log('🗺️ [Map] Map style loaded, adding fog...');
        map.current?.setFog({});
      });

      // Close all popups when clicking on the map
      map.current.on('click', (e) => {
        const clickedElement = e.originalEvent.target as HTMLElement;
        const isMarkerClick = clickedElement.closest('.w-4.h-4.rounded-full') || clickedElement.closest('.w-6.h-6.rounded-full');
        
        if (!isMarkerClick) {
          stopCurrentAudio();
          
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

      // Handle moveend event to show popup after zoom completes
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
        map.current?.remove();
        map.current = null;
      };
    } catch (error) {
      console.error('🗺️ [Map] Error during map initialization:', error);
    }
  }, [mapboxToken]);

  // Function to handle text-to-speech using Google Cloud TTS via edge function
  const handleTextToSpeech = async (landmark: Landmark) => {
    const landmarkId = landmark.id;
    
    if (playingAudio[landmarkId]) {
      return; // Already playing
    }

    // Stop any currently playing audio
    stopCurrentAudio();

    try {
      setPlayingAudio(prev => ({ ...prev, [landmarkId]: true }));
      const text = `${landmark.name}. ${landmark.description}`;
      
      console.log('Calling Google Cloud TTS via edge function for map marker:', text.substring(0, 50) + '...');
      
      // Call the same edge function used by the voice assistant
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

  // Function to play audio from base64
  const playAudioFromBase64 = async (base64Audio: string) => {
    return new Promise<void>((resolve, reject) => {
      try {
        console.log('Converting base64 to audio blob for map marker');
        
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        // Store reference to current audio
        currentAudio.current = audio;
        
        audio.onended = () => {
          console.log('Map marker audio playback ended');
          URL.revokeObjectURL(audioUrl);
          currentAudio.current = null;
          resolve();
        };
        
        audio.onerror = (error) => {
          console.error('Map marker audio playback error:', error);
          URL.revokeObjectURL(audioUrl);
          currentAudio.current = null;
          reject(error);
        };
        
        audio.play().then(() => {
          console.log('Map marker audio playing successfully');
        }).catch(error => {
          console.error('Failed to play map marker audio:', error);
          URL.revokeObjectURL(audioUrl);
          currentAudio.current = null;
          reject(error);
        });
        
      } catch (error) {
        console.error('Error creating audio from base64 for map marker:', error);
        reject(error);
      }
    });
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
    
    // Stop any playing audio when showing new popup
    stopCurrentAudio();
    
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
          <button class="custom-close-btn" onclick="
            if (window.handlePopupClose) window.handlePopupClose('${landmark.id}');
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
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='rgba(0, 0, 0, 0.9)'" onmouseout="this.style.backgroundColor='rgba(0, 0, 0, 0.7)'">×</button>
          <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; padding-right: 30px; color: #1a1a1a;">${landmark.name}</h3>
          <div style="margin-bottom: 10px; color: #666;">Loading image...</div>
        </div>
      `)
      .addTo(map.current!);

    photoPopups.current[landmark.id] = photoPopup;

    // Handle popup close event - stop audio when popup closes
    photoPopup.on('close', () => {
      stopCurrentAudio();
      delete photoPopups.current[landmark.id];
    });

    // Add global handler for popup close if it doesn't exist
    if (!(window as any).handlePopupClose) {
      (window as any).handlePopupClose = (landmarkId: string) => {
        stopCurrentAudio();
        if (photoPopups.current[landmarkId]) {
          delete photoPopups.current[landmarkId];
        }
      };
    }

    // Fetch and display image with listen button
    try {
      const imageUrl = await fetchLandmarkImage(landmark);
      const isPlaying = playingAudio[landmark.id] || false;
      
      // Store the interaction ONLY ONCE with the fetched image URL
      await storeMapMarkerInteraction(landmark, imageUrl);
      
      photoPopup.setHTML(`
        <div style="text-align: center; padding: 10px; max-width: 400px; position: relative;">
          <button class="custom-close-btn" onclick="
            if (window.handlePopupClose) window.handlePopupClose('${landmark.id}');
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
      
      // Store the interaction even without image
      await storeMapMarkerInteraction(landmark);
      
      photoPopup.setHTML(`
        <div style="text-align: center; padding: 10px; max-width: 400px; position: relative;">
          <button class="custom-close-btn" onclick="
            if (window.handlePopupClose) window.handlePopupClose('${landmark.id}');
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

  // Update markers when landmarks change - now with proximity landmark styling
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
        
        // Different styling for different landmark types
        const isTopLandmark = landmark.id.startsWith('top-landmark-');
        const isProximityLandmark = landmark.id.startsWith('proximity-');
        
        let markerColor = 'bg-cyan-400'; // default for regular landmarks
        
        if (isProximityLandmark) {
          markerColor = 'bg-green-400'; // green for proximity landmarks
        } else if (isTopLandmark) {
          markerColor = 'bg-yellow-400'; // yellow for top landmarks
        }
        
        el.className = `w-4 h-4 rounded-full ${markerColor} border-2 border-white shadow-lg cursor-pointer transition-transform duration-300 hover:scale-125`;
        el.style.transition = 'background-color 0.3s, transform 0.3s';
        
        const marker = new mapboxgl.Marker(el)
          .setLngLat(landmark.coordinates)
          .addTo(map.current!);

        marker.getElement().addEventListener('click', async (e) => {
          e.stopPropagation();
          
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
            showLandmarkPopup(landmark);
          }
          
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
        console.log('Flying to landmark and showing popup');
        map.current.flyTo({
          center: selectedLandmark.coordinates,
          zoom: 14,
          speed: 0.7,
          curve: 1,
          easing: (t) => t,
        });
        
        setTimeout(() => {
          showLandmarkPopup(selectedLandmark);
        }, 500);
      }
    }

    Object.entries(markers.current).forEach(([id, marker]) => {
      const element = marker.getElement();
      const isSelected = id === selectedLandmark?.id;
      const isTopLandmark = id.startsWith('top-landmark-');
      const isProximityLandmark = id.startsWith('proximity-');
      
      if (isSelected) {
        element.style.backgroundColor = '#f87171'; // red-400 for selected
        element.style.transform = 'scale(1.5)';
      } else {
        // Set color based on landmark type
        if (isProximityLandmark) {
          element.style.backgroundColor = '#4ade80'; // green-400 for proximity
        } else if (isTopLandmark) {
          element.style.backgroundColor = '#facc15'; // yellow-400 for top
        } else {
          element.style.backgroundColor = '#22d3ee'; // cyan-400 for regular
        }
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

  // New function specifically for "Show on Map" button
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
      zoom: 14,
      speed: 0.8,
      curve: 1,
      easing: (t) => t,
    });

    // Add a permanent marker at the coordinates with same style as other markers but in red
    const el = document.createElement('div');
    el.className = 'w-4 h-4 rounded-full bg-red-400 border-2 border-white shadow-lg cursor-pointer transition-transform duration-300 hover:scale-125';
    el.style.transition = 'background-color 0.3s, transform 0.3s';
    
    const marker = new mapboxgl.Marker(el)
      .setLngLat(coordinates)
      .addTo(map.current);

    // Add click handler to the navigation marker if interaction data is provided
    if (interaction) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        showInteractionPopup(coordinates, interaction);
      });
      
      // Show popup instantly after adding the marker
      setTimeout(() => {
        showInteractionPopup(coordinates, interaction);
      }, 1000); // Small delay to allow fly animation to complete
    }

    // Store the marker so it can be managed later if needed
    navigationMarkers.current.push({ marker, interaction });

    console.log('Fly command sent and permanent marker added');
    console.log('=== End Map Debug ===');
  };

  // Function to show interaction popup
  const showInteractionPopup = (coordinates: [number, number], interaction: any) => {
    if (!map.current) return;
    
    console.log('Showing interaction popup for:', interaction.user_input);
    
    // Stop any playing audio when showing new popup
    stopCurrentAudio();
    
    // Close any existing popups
    const existingPopups = document.querySelectorAll('.mapboxgl-popup');
    existingPopups.forEach(popup => popup.remove());
    
    // Create popup content with TTS button
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
    
    // Create and show popup
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

    // Handle popup close event - stop audio when popup closes
    popup.on('close', () => {
      stopCurrentAudio();
    });
  };

  // Function to handle text-to-speech for interactions
  const handleTextToSpeechForInteraction = async (assistantResponse: string) => {
    // Stop any currently playing audio
    stopCurrentAudio();

    try {
      console.log('Calling Google Cloud TTS via edge function for interaction:', assistantResponse.substring(0, 50) + '...');
      
      // Call the same edge function used by the voice assistant
      const { data, error } = await supabase.functions.invoke('gemini-tts', {
        body: { text: assistantResponse }
      });

      if (error) {
        console.error('Google Cloud TTS error:', error);
        return;
      }

      if (data?.audioContent && !data.fallbackToBrowser) {
        console.log('Playing audio from Google Cloud TTS for interaction');
        await playAudioFromBase64(data.audioContent);
      } else {
        console.log('No audio content received for interaction');
      }
      
    } catch (error) {
      console.error('Error with Google Cloud TTS for interaction:', error);
    }
  };

  // Expose the function globally so InteractionCard can call it
  React.useEffect(() => {
    console.log('Setting up navigateToMapCoordinates on window');
    (window as any).navigateToMapCoordinates = navigateToCoordinates;
    (window as any).stopCurrentAudio = stopCurrentAudio;
    
    (window as any).handleInteractionListen = (interactionId: string) => {
      const markerData = navigationMarkers.current.find(m => m.interaction?.id === interactionId);
      if (markerData?.interaction?.assistant_response) {
        handleTextToSpeechForInteraction(markerData.interaction.assistant_response);
      }
    };
    
    return () => {
      console.log('Cleaning up navigateToMapCoordinates from window');
      delete (window as any).navigateToMapCoordinates;
      delete (window as any).handleInteractionListen;
      delete (window as any).stopCurrentAudio;
    };
  }, []);

  return <div ref={mapContainer} className="absolute inset-0" />;
};

export default Map;
