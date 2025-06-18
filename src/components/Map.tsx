import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Volume2, VolumeX } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { TOP_LANDMARKS } from '@/data/topLandmarks';

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
  plannedLandmarks: Landmark[];
}

const Map: React.FC<MapProps> = ({ mapboxToken, landmarks, onSelectLandmark, selectedLandmark, plannedLandmarks }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const imageCache = useRef<{ [key: string]: string }>({});
  const popups = useRef<{ [key: string]: mapboxgl.Popup }>({});
  const [playingAudio, setPlayingAudio] = useState<{ [key: string]: boolean }>({});

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
        // Close all popups
        Object.values(popups.current).forEach(popup => {
          popup.remove();
        });
        popups.current = {};
        
        // Also close any Mapbox popups that might be open
        const mapboxPopups = document.querySelectorAll('.mapboxgl-popup');
        mapboxPopups.forEach(popup => {
          popup.remove();
        });
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

  // Function to fetch landmark image with better search strategy
  const fetchLandmarkImage = async (landmarkName: string): Promise<string> => {
    if (imageCache.current[landmarkName]) {
      return imageCache.current[landmarkName];
    }

    try {
      console.log('Fetching image for:', landmarkName);
      
      // Use your Unsplash API key with better search terms
      const searchTerms = [
        `${landmarkName} architecture landmark`,
        `${landmarkName} tourist attraction`,
        `${landmarkName} monument`,
        landmarkName
      ];
      
      // Try each search term until we get a good result
      for (const searchTerm of searchTerms) {
        try {
          const encodedTerm = encodeURIComponent(searchTerm);
          const unsplashUrl = `https://api.unsplash.com/photos/random?query=${encodedTerm}&w=400&h=300&orientation=landscape&client_id=hGYkz9JVkFhlOvr477qg35Ns4d92kOc1p2lTEYt6WWY`;
          
          const response = await fetch(unsplashUrl);
          console.log(`Unsplash response for "${searchTerm}":`, response.status);
          
          if (response.ok) {
            const data = await response.json();
            if (data.urls && data.urls.small) {
              const imageUrl = data.urls.small;
              imageCache.current[landmarkName] = imageUrl;
              console.log('Using Unsplash image:', imageUrl);
              return imageUrl;
            }
          }
        } catch (error) {
          console.log(`Failed to fetch with term "${searchTerm}":`, error);
          continue;
        }
      }
      
      // If all Unsplash attempts fail, use a more specific fallback
      // Create a seed based on landmark name for consistent images
      const seed = landmarkName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const fallbackUrl = `https://picsum.photos/seed/${seed}/400/300`;
      console.log('Using fallback image:', fallbackUrl);
      
      // Test if fallback loads
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      return new Promise((resolve) => {
        img.onload = () => {
          imageCache.current[landmarkName] = fallbackUrl;
          resolve(fallbackUrl);
        };
        img.onerror = () => {
          // Final fallback - architecture/landmark themed image
          const finalFallback = `https://picsum.photos/400/300?random=${Math.abs(seed.split('').reduce((a, b) => a + b.charCodeAt(0), 0))}`;
          imageCache.current[landmarkName] = finalFallback;
          console.log('Using final fallback:', finalFallback);
          resolve(finalFallback);
        };
        img.src = fallbackUrl;
      });
      
    } catch (error) {
      console.error('Error fetching landmark image:', error);
      // Final fallback with consistent seeding
      const seed = landmarkName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const fallbackUrl = `https://picsum.photos/seed/${seed}/400/300`;
      imageCache.current[landmarkName] = fallbackUrl;
      return fallbackUrl;
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
        if (popups.current[markerId]) {
          popups.current[markerId].remove();
          delete popups.current[markerId];
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

        // Create hover popup
        const hoverPopup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 20
        });

        marker.getElement().addEventListener('mouseenter', () => {
          if (!map.current) return;
          hoverPopup
            .setLngLat(landmark.coordinates)
            .setText(landmark.name)
            .addTo(map.current);
        });
        
        marker.getElement().addEventListener('mouseleave', () => {
          hoverPopup.remove();
        });

        // Create click popup with image and listen button
        marker.getElement().addEventListener('click', async (e) => {
          e.stopPropagation(); // Prevent map click event
          onSelectLandmark(landmark);
          
          // Remove existing popup for this landmark
          if (popups.current[landmark.id]) {
            popups.current[landmark.id].remove();
          }
          
          // Create new popup with image and listen button
          const clickPopup = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: false,
            offset: 25,
            maxWidth: '450px',
            className: 'custom-popup'
          });

          // Initial popup with loading state
          clickPopup
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
                <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; padding-right: 30px;">${landmark.name}</h3>
                <div style="margin-bottom: 10px; color: #666;">Loading image...</div>
              </div>
            `)
            .addTo(map.current!);

          popups.current[landmark.id] = clickPopup;

          // Handle popup close event
          clickPopup.on('close', () => {
            delete popups.current[landmark.id];
          });

          // Fetch and display image with listen button
          try {
            const imageUrl = await fetchLandmarkImage(landmark.name);
            const isPlaying = playingAudio[landmark.id] || false;
            
            clickPopup.setHTML(`
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
                <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; padding-right: 30px;">${landmark.name}</h3>
                <div style="position: relative; margin-bottom: 10px;">
                  <img src="${imageUrl}" alt="${landmark.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px;" />
                  <button 
                    class="listen-btn-${landmark.id}" 
                    onclick="window.handleLandmarkListen('${landmark.id}')"
                    style="
                      position: absolute;
                      bottom: 8px;
                      right: 8px;
                      background: rgba(0, 0, 0, 0.7);
                      color: white;
                      border: none;
                      border-radius: 50%;
                      width: 36px;
                      height: 36px;
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 16px;
                      transition: background-color 0.2s;
                      ${isPlaying ? 'opacity: 0.7;' : ''}
                    "
                    onmouseover="this.style.backgroundColor='rgba(0, 0, 0, 0.9)'"
                    onmouseout="this.style.backgroundColor='rgba(0, 0, 0, 0.7)'"
                    ${isPlaying ? 'disabled' : ''}
                  >
                    ${isPlaying ? '🔊' : '🔊'}
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
            clickPopup.setHTML(`
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
                <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; padding-right: 30px;">${landmark.name}</h3>
                <div style="width: 100%; height: 150px; background-color: #f0f0f0; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #888; position: relative;">
                  No image available
                  <button 
                    class="listen-btn-${landmark.id}" 
                    onclick="window.handleLandmarkListen('${landmark.id}')"
                    style="
                      position: absolute;
                      bottom: 8px;
                      right: 8px;
                      background: rgba(0, 0, 0, 0.7);
                      color: white;
                      border: none;
                      border-radius: 50%;
                      width: 36px;
                      height: 36px;
                      cursor: pointer;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 16px;
                      transition: background-color 0.2s;
                    "
                    onmouseover="this.style.backgroundColor='rgba(0, 0, 0, 0.9)'"
                    onmouseout="this.style.backgroundColor='rgba(0, 0, 0, 0.7)'"
                  >
                    🔊
                  </button>
                </div>
              </div>
            `);
          }
        });

        markers.current[landmark.id] = marker;
      }
    });

  }, [allLandmarksWithTop, onSelectLandmark, playingAudio]);

  // Fly to selected landmark and update marker styles
  useEffect(() => {
    if (map.current && selectedLandmark) {
      map.current.flyTo({
        center: selectedLandmark.coordinates,
        zoom: 14,
        speed: 0.7,
        curve: 1,
        easing: (t) => t,
      });
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
