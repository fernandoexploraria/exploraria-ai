import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Landmark } from '@/data/landmarks';
import CameraCapture from './CameraCapture';
import { supabase } from '@/integrations/supabase/client';

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  // Function to fetch landmark image from Unsplash API
  const fetchLandmarkImage = async (landmarkName: string): Promise<string> => {
    if (imageCache.current[landmarkName]) {
      return imageCache.current[landmarkName];
    }

    try {
      console.log('Fetching image for:', landmarkName);
      
      // Try Unsplash API first (requires no auth for basic usage)
      const searchTerm = encodeURIComponent(landmarkName);
      const unsplashUrl = `https://api.unsplash.com/photos/random?query=${searchTerm}&w=400&h=300&client_id=demo`;
      
      const response = await fetch(unsplashUrl);
      console.log('Unsplash response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        if (data.urls && data.urls.small) {
          const imageUrl = data.urls.small;
          imageCache.current[landmarkName] = imageUrl;
          console.log('Using Unsplash image:', imageUrl);
          return imageUrl;
        }
      }
      
      // Fallback to Picsum if Unsplash fails
      const seed = landmarkName.toLowerCase().replace(/\s+/g, '-');
      const fallbackUrl = `https://picsum.photos/seed/${seed}/400/300`;
      console.log('Falling back to Picsum:', fallbackUrl);
      
      // Test if fallback loads
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      return new Promise((resolve) => {
        img.onload = () => {
          imageCache.current[landmarkName] = fallbackUrl;
          resolve(fallbackUrl);
        };
        img.onerror = () => {
          // Final fallback - simple Picsum random image
          const finalFallback = `https://picsum.photos/400/300?random=${Date.now()}`;
          imageCache.current[landmarkName] = finalFallback;
          console.log('Using final fallback:', finalFallback);
          resolve(finalFallback);
        };
        img.src = fallbackUrl;
      });
      
    } catch (error) {
      console.error('Error fetching landmark image:', error);
      // Final fallback to Picsum
      const fallbackUrl = `https://picsum.photos/400/300?random=${Date.now()}`;
      imageCache.current[landmarkName] = fallbackUrl;
      return fallbackUrl;
    }
  };

  // Set up global functions for camera interactions
  useEffect(() => {
    (window as any).startCamera = (landmarkId: string) => {
      // This would need a more sophisticated implementation in a real app
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const imageData = event.target?.result as string;
            const landmark = landmarks.find(l => l.id === landmarkId);
            const popup = popups.current[landmarkId];
            if (landmark && popup) {
              analyzeImage(imageData, landmark.name, popup, landmark);
            }
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    };

    (window as any).uploadImage = (landmarkId: string) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const imageData = event.target?.result as string;
            const landmark = landmarks.find(l => l.id === landmarkId);
            const popup = popups.current[landmarkId];
            if (landmark && popup) {
              analyzeImage(imageData, landmark.name, popup, landmark);
            }
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    };
  }, [landmarks]);

  // Analyze image with AI
  const analyzeImage = async (imageData: string, landmarkName: string, popup: mapboxgl.Popup, landmark: Landmark) => {
    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-landmark-image', {
        body: { imageData, landmarkName }
      });

      if (error) {
        throw error;
      }

      // Update popup with analysis
      const landmarkImage = await fetchLandmarkImage(landmark.name);
      popup.setHTML(`
        <div style="text-align: center; padding: 10px; max-width: 400px;">
          <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">${landmark.name}</h3>
          <img src="${landmarkImage}" alt="${landmark.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;" />
          <div style="margin-bottom: 10px;">
            <div id="camera-container-${landmark.id}"></div>
          </div>
          <div style="max-height: 200px; overflow-y: auto; text-align: left; padding: 10px; background: #f9f9f9; border-radius: 8px; margin-bottom: 10px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #2563eb;">AI Analysis:</h4>
            <p style="margin: 0; font-size: 12px; color: #374151; line-height: 1.4;">${data.analysis}</p>
          </div>
          <p style="margin: 0; font-size: 12px; color: #666; line-height: 1.4;">${landmark.description}</p>
        </div>
      `);

      // Re-add camera component to the updated popup
      const cameraContainer = document.getElementById(`camera-container-${landmark.id}`);
      if (cameraContainer) {
        const cameraComponent = document.createElement('div');
        cameraContainer.appendChild(cameraComponent);
        
        // Note: This is a simplified approach. In a real React app, you'd want to use a portal
        cameraComponent.innerHTML = `
          <div style="display: flex; gap: 8px; justify-content: center; margin: 8px 0;">
            <button onclick="window.startCamera('${landmark.id}')" style="padding: 4px 8px; font-size: 12px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;">
              📷 Camera
            </button>
            <button onclick="window.uploadImage('${landmark.id}')" style="padding: 4px 8px; font-size: 12px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;">
              📁 Upload
            </button>
          </div>
        `;
      }

    } catch (error) {
      console.error('Error analyzing image:', error);
      alert('Failed to analyze image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Update markers when landmarks change
  useEffect(() => {
    if (!map.current) return;

    const landmarkIds = new Set(landmarks.map(l => l.id));

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
    landmarks.forEach((landmark) => {
      if (!markers.current[landmark.id]) {
        const el = document.createElement('div');
        el.className = 'w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-lg cursor-pointer transition-transform duration-300 hover:scale-125';
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

        // Create click popup with camera feature
        marker.getElement().addEventListener('click', async () => {
          onSelectLandmark(landmark);
          
          // Remove existing popup for this landmark
          if (popups.current[landmark.id]) {
            popups.current[landmark.id].remove();
          }
          
          // Create new popup
          const clickPopup = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: false,
            offset: 25,
            maxWidth: '450px'
          });

          clickPopup
            .setLngLat(landmark.coordinates)
            .setHTML(`
              <div style="text-align: center; padding: 10px;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">${landmark.name}</h3>
                <div style="margin-bottom: 10px; color: #666;">Loading image...</div>
              </div>
            `)
            .addTo(map.current!);

          popups.current[landmark.id] = clickPopup;

          // Fetch and display image with camera controls
          try {
            const imageUrl = await fetchLandmarkImage(landmark.name);
            clickPopup.setHTML(`
              <div style="text-align: center; padding: 10px; max-width: 400px;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">${landmark.name}</h3>
                <img src="${imageUrl}" alt="${landmark.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;" />
                <div style="display: flex; gap: 8px; justify-content: center; margin: 10px 0;">
                  <button onclick="window.startCamera('${landmark.id}')" 
                          style="padding: 6px 12px; font-size: 12px; border: 1px solid #3b82f6; border-radius: 6px; background: #3b82f6; color: white; cursor: pointer; display: flex; align-items: center; gap: 4px;"
                          ${isAnalyzing ? 'disabled' : ''}>
                    📷 Analyze with Camera
                  </button>
                  <button onclick="window.uploadImage('${landmark.id}')" 
                          style="padding: 6px 12px; font-size: 12px; border: 1px solid #6b7280; border-radius: 6px; background: #6b7280; color: white; cursor: pointer; display: flex; align-items: center; gap: 4px;"
                          ${isAnalyzing ? 'disabled' : ''}>
                    📁 Upload Image
                  </button>
                </div>
                ${isAnalyzing ? '<div style="color: #3b82f6; font-size: 12px;">Analyzing image...</div>' : ''}
                <p style="margin: 0; font-size: 12px; color: #666; line-height: 1.4;">${landmark.description}</p>
              </div>
            `);
          } catch (error) {
            console.error('Failed to load image for', landmark.name, error);
            clickPopup.setHTML(`
              <div style="text-align: center; padding: 10px; max-width: 400px;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">${landmark.name}</h3>
                <div style="width: 100%; height: 150px; background-color: #f0f0f0; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #888;">
                  No image available
                </div>
                <div style="display: flex; gap: 8px; justify-content: center; margin: 10px 0;">
                  <button onclick="window.startCamera('${landmark.id}')" 
                          style="padding: 6px 12px; font-size: 12px; border: 1px solid #3b82f6; border-radius: 6px; background: #3b82f6; color: white; cursor: pointer;">
                    📷 Analyze with Camera
                  </button>
                  <button onclick="window.uploadImage('${landmark.id}')" 
                          style="padding: 6px 12px; font-size: 12px; border: 1px solid #6b7280; border-radius: 6px; background: #6b7280; color: white; cursor: pointer;">
                    📁 Upload Image
                  </button>
                </div>
                <p style="margin: 0; font-size: 12px; color: #666; line-height: 1.4;">${landmark.description}</p>
              </div>
            `);
          }
        });

        markers.current[landmark.id] = marker;
      }
    });

  }, [landmarks, onSelectLandmark, isAnalyzing]);

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
      if (id === selectedLandmark?.id) {
        element.style.backgroundColor = '#f87171'; // red-400
        element.style.transform = 'scale(1.5)';
      } else {
        element.style.backgroundColor = '#22d3ee'; // cyan-400
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
