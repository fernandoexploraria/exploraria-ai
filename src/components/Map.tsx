
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Landmark } from '@/data/landmarks';
import { useStreetView } from '@/hooks/useStreetView';
import { useEnhancedPhotos, PhotoData } from '@/hooks/useEnhancedPhotos';
import { useToast } from '@/hooks/use-toast';

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  selectedLandmark?: Landmark;
  plannedLandmarks: Landmark[];
  showPlannedOnly?: boolean;
  onLandmarkSelect: (landmark: Landmark) => void;
  className?: string;
}

declare global {
  interface Window {
    openStreetView: (landmarkId: string) => void;
    selectLandmark: (landmarkId: string) => void;
  }
}

const Map: React.FC<MapProps> = ({
  mapboxToken,
  landmarks,
  selectedLandmark,
  plannedLandmarks,
  showPlannedOnly = false,
  onLandmarkSelect,
  className = "",
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const popupsRef = useRef<{ [key: string]: mapboxgl.Popup }>({});
  const { fetchStreetView } = useStreetView();
  const { fetchPhotos, getBestPhoto, getOptimalPhotoUrl } = useEnhancedPhotos();
  const { toast } = useToast();
  const [photoCache, setPhotoCache] = useState<{ [key: string]: PhotoData | null }>({});

  const fetchLandmarkPhoto = useCallback(async (landmark: Landmark): Promise<PhotoData | null> => {
    if (!landmark.placeId) return null;
    
    // Check cache first
    if (photoCache[landmark.placeId] !== undefined) {
      return photoCache[landmark.placeId];
    }

    try {
      console.log(`📸 Fetching best photo for ${landmark.name}`);
      const photosResponse = await fetchPhotos(landmark.placeId, 600, 'medium');
      
      if (photosResponse?.photos && photosResponse.photos.length > 0) {
        const bestPhoto = getBestPhoto(photosResponse.photos);
        console.log(`✅ Selected best photo for ${landmark.name} (score: ${bestPhoto?.qualityScore || 'N/A'})`);
        
        // Cache the result
        setPhotoCache(prev => ({
          ...prev,
          [landmark.placeId!]: bestPhoto
        }));
        
        return bestPhoto;
      } else {
        // Cache null result to avoid repeated requests
        setPhotoCache(prev => ({
          ...prev,
          [landmark.placeId!]: null
        }));
        return null;
      }
    } catch (error) {
      console.error(`❌ Error fetching photo for ${landmark.name}:`, error);
      // Cache null result to avoid repeated requests
      setPhotoCache(prev => ({
        ...prev,
        [landmark.placeId!]: null
      }));
      return null;
    }
  }, [fetchPhotos, getBestPhoto, photoCache]);

  const createPopupContent = useCallback(async (landmark: Landmark): Promise<string> => {
    const photo = await fetchLandmarkPhoto(landmark);
    
    const photoHtml = photo ? `
      <div class="photo-container mb-3 relative">
        <img 
          src="${getOptimalPhotoUrl(photo, 'medium')}" 
          alt="${landmark.name}"
          class="w-full h-32 object-cover rounded"
          loading="lazy"
        />
        <div class="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
          <span class="text-yellow-300">★</span>
          <span>Quality: ${Math.round(photo.qualityScore || 0)}</span>
        </div>
        ${photo.attributions && photo.attributions.length > 0 ? `
          <div class="absolute bottom-1 left-1 bg-black/60 text-white px-1 py-0.5 rounded text-xs">
            © ${photo.attributions[0].displayName}
          </div>
        ` : ''}
      </div>
    ` : '';

    return `
      <div class="popup-content max-w-sm">
        ${photoHtml}
        <div class="landmark-info">
          <h3 class="font-bold text-lg mb-2">${landmark.name}</h3>
          <p class="text-sm text-gray-600 mb-3">${landmark.description}</p>
          <div class="flex gap-2">
            <button 
              onclick="window.selectLandmark('${landmark.id}')" 
              class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
            >
              Select
            </button>
            ${landmark.placeId ? `
              <button 
                onclick="window.openStreetView('${landmark.id}')" 
                class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
              >
                Street View
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }, [fetchLandmarkPhoto, getOptimalPhotoUrl]);

  const addMarkers = useCallback((landmarks: Landmark[]) => {
    if (!map.current) return;

    // Clear existing markers and popups
    Object.keys(markersRef.current).forEach((key) => {
      markersRef.current[key].remove();
      delete markersRef.current[key];
      popupsRef.current[key].remove();
      delete popupsRef.current[key];
    });

    landmarks.forEach(async (landmark) => {
      if (showPlannedOnly && !plannedLandmarks.find(planned => planned.id === landmark.id)) {
        return;
      }

      const el = document.createElement('div');
      el.className = 'marker';
      el.style.backgroundImage = `url(/marker.svg)`;
      el.style.width = `30px`;
      el.style.height = `30px`;
      el.style.backgroundSize = '100%';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([landmark.location.lng, landmark.location.lat]);

      // Create popup content
      const popupContent = await createPopupContent(landmark);

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        anchor: 'top',
        maxWidth: '300px',
      }).setHTML(popupContent);

      marker.setPopup(popup);

      el.addEventListener('click', () => {
        onLandmarkSelect(landmark);
      });

      marker.on('popupopen', () => {
        el.classList.add('active');
      });

      marker.on('popupclose', () => {
        el.classList.remove('active');
      });

      marker.addTo(map.current);

      markersRef.current[landmark.id] = marker;
      popupsRef.current[landmark.id] = popup;
    });
  }, [showPlannedOnly, plannedLandmarks, onLandmarkSelect, createPopupContent]);

  useEffect(() => {
    if (map.current) return; // prevent re-initialization

    map.current = new mapboxgl.Map({
      accessToken: mapboxToken,
      container: mapContainer.current as HTMLDivElement,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-122.4194, 37.7749], // San Francisco coordinates
      zoom: 12,
    });

    // Add navigation control (the +/- zoom buttons)
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Disable map rotation using touch rotation gesture.
    map.current.touchZoomRotate.disableRotation();

    // Add geolocation control to the map.
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      })
    );

    // Load initial landmarks
    addMarkers(landmarks);

    // Handle landmark selection from popups
    window.selectLandmark = (landmarkId: string) => {
      const landmark = landmarks.find((lm) => lm.id === landmarkId);
      if (landmark) {
        onLandmarkSelect(landmark);
      }
    };

    // Handle street view requests from popups
    window.openStreetView = async (landmarkId: string) => {
      const landmark = landmarks.find((lm) => lm.id === landmarkId);
      if (landmark) {
        try {
          const streetViewData = await fetchStreetView(landmark);
          if (streetViewData) {
            const { location } = streetViewData;
            const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${location.lat},${location.lng}&heading=${streetViewData.heading}&pitch=${streetViewData.pitch}`;
            window.open(streetViewUrl, '_blank');
          } else {
            toast({
              title: "Street View Not Available",
              description: "Could not retrieve street view for this location.",
            });
          }
        } catch (error) {
          console.error("Error fetching street view:", error);
          toast({
            title: "Error",
            description: "Failed to open street view.",
            variant: "destructive",
          });
        }
      }
    };

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken, landmarks, fetchStreetView, onLandmarkSelect, toast, addMarkers]);

  useEffect(() => {
    if (!map.current) return;

    map.current.on('load', () => {
      addMarkers(landmarks);
    });

    addMarkers(landmarks);

    // Fly to the selected landmark
    if (selectedLandmark) {
      map.current.flyTo({
        center: [selectedLandmark.location.lng, selectedLandmark.location.lat],
        zoom: 14,
        essential: true
      });

      // Open the popup for the selected landmark
      if (markersRef.current[selectedLandmark.id]) {
        markersRef.current[selectedLandmark.id].togglePopup();
      }
    }
  }, [landmarks, selectedLandmark, addMarkers]);

  // Define window functions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.openStreetView = async (landmarkId: string) => {
        const landmark = landmarks.find((lm) => lm.id === landmarkId);
        if (landmark) {
          try {
            const streetViewData = await fetchStreetView(landmark);
            if (streetViewData) {
              const { location } = streetViewData;
              const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${location.lat},${location.lng}&heading=${streetViewData.heading}&pitch=${streetViewData.pitch}`;
              window.open(streetViewUrl, '_blank');
            } else {
              toast({
                title: "Street View Not Available",
                description: "Could not retrieve street view for this location.",
              });
            }
          } catch (error) {
            console.error("Error fetching street view:", error);
            toast({
              title: "Error",
              description: "Failed to open street view.",
              variant: "destructive",
            });
          }
        }
      };

      window.selectLandmark = (landmarkId: string) => {
        const landmark = landmarks.find((lm) => lm.id === landmarkId);
        if (landmark) {
          onLandmarkSelect(landmark);
        }
      };
    }

    return () => {
      // Clean up the window functions to prevent memory leaks
      delete window.openStreetView;
      delete window.selectLandmark;
    };
  }, [landmarks, fetchStreetView, onLandmarkSelect, toast]);

  useEffect(() => {
    return () => {
      Object.keys(markersRef.current).forEach((key) => {
        markersRef.current[key].remove();
        popupsRef.current[key].remove();
      });
    };
  }, []);

  return (
    <div
      ref={mapContainer}
      className={`map-container ${className}`}
    />
  );
};

export default Map;
