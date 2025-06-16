import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Landmark } from '@/data/landmarks';

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

  // Function to fetch landmark image from Unsplash
  const fetchLandmarkImage = async (landmarkName: string): Promise<string> => {
    if (imageCache.current[landmarkName]) {
      return imageCache.current[landmarkName];
    }

    try {
      const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(landmarkName)}&per_page=1&client_id=your_unsplash_access_key`);
      
      if (!response.ok) {
        // Fallback to a more generic search or placeholder
        const fallbackResponse = await fetch(`https://source.unsplash.com/400x300/?${encodeURIComponent(landmarkName)}`);
        if (fallbackResponse.ok) {
          imageCache.current[landmarkName] = fallbackResponse.url;
          return fallbackResponse.url;
        }
        throw new Error('Failed to fetch image');
      }

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const imageUrl = data.results[0].urls.small;
        imageCache.current[landmarkName] = imageUrl;
        return imageUrl;
      } else {
        // Fallback to Unsplash Source API
        const fallbackUrl = `https://source.unsplash.com/400x300/?${encodeURIComponent(landmarkName)}`;
        imageCache.current[landmarkName] = fallbackUrl;
        return fallbackUrl;
      }
    } catch (error) {
      console.error('Error fetching landmark image:', error);
      // Fallback to a generic landmark image
      const fallbackUrl = `https://source.unsplash.com/400x300/?landmark,${encodeURIComponent(landmarkName)}`;
      imageCache.current[landmarkName] = fallbackUrl;
      return fallbackUrl;
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

        // Create click popup with image
        marker.getElement().addEventListener('click', async () => {
          onSelectLandmark(landmark);
          
          // Create loading popup first
          const clickPopup = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: false,
            offset: 25,
            maxWidth: '400px'
          });

          clickPopup
            .setLngLat(landmark.coordinates)
            .setHTML(`
              <div style="text-align: center; padding: 10px;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">${landmark.name}</h3>
                <div style="margin-bottom: 10px;">Loading image...</div>
              </div>
            `)
            .addTo(map.current!);

          // Fetch and display image
          try {
            const imageUrl = await fetchLandmarkImage(landmark.name);
            clickPopup.setHTML(`
              <div style="text-align: center; padding: 10px; max-width: 350px;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">${landmark.name}</h3>
                <img src="${imageUrl}" alt="${landmark.name}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;" />
                <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.4;">${landmark.description}</p>
              </div>
            `);
          } catch (error) {
            clickPopup.setHTML(`
              <div style="text-align: center; padding: 10px; max-width: 350px;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">${landmark.name}</h3>
                <div style="width: 100%; height: 200px; background-color: #f0f0f0; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #888;">
                  No image available
                </div>
                <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.4;">${landmark.description}</p>
              </div>
            `);
          }
        });

        markers.current[landmark.id] = marker;
      }
    });

  }, [landmarks, onSelectLandmark]);

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
