
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Landmark } from '@/data/landmarks';
import { useStreetView } from '@/hooks/useStreetView';
import { useEnhancedPhotos, PhotoData } from '@/hooks/useEnhancedPhotos';
import { useToast } from '@/hooks/use-toast';
import { validateLandmarkArray, ValidatedLandmark } from '@/utils/landmarkUtils';

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
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  // Validate landmarks before processing
  const validatedLandmarks = validateLandmarkArray(landmarks);
  const validatedPlannedLandmarks = validateLandmarkArray(plannedLandmarks);

  console.log(`📍 Map: Processing ${validatedLandmarks.length} validated landmarks out of ${landmarks.length} total`);

  const fetchLandmarkPhoto = useCallback(async (landmark: ValidatedLandmark): Promise<PhotoData | null> => {
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

  const createPopupContent = useCallback(async (landmark: ValidatedLandmark): Promise<string> => {
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

  const addMarkers = useCallback(async (landmarks: ValidatedLandmark[]) => {
    if (!map.current) {
      console.log('📍 Cannot add markers: map not initialized');
      return;
    }

    console.log(`📍 Adding markers for ${landmarks.length} landmarks`);

    // Clear existing markers and popups
    Object.keys(markersRef.current).forEach((key) => {
      markersRef.current[key].remove();
      delete markersRef.current[key];
      if (popupsRef.current[key]) {
        popupsRef.current[key].remove();
        delete popupsRef.current[key];
      }
    });

    // Filter landmarks based on showPlannedOnly
    const landmarksToShow = showPlannedOnly 
      ? landmarks.filter(landmark => validatedPlannedLandmarks.find(planned => planned.id === landmark.id))
      : landmarks;

    console.log(`📍 Showing ${landmarksToShow.length} markers (showPlannedOnly: ${showPlannedOnly})`);

    // Process all landmarks in parallel
    await Promise.all(landmarksToShow.map(async (landmark) => {
      try {
        // Validate landmark has required location data
        if (!landmark.location || typeof landmark.location.lng !== 'number' || typeof landmark.location.lat !== 'number') {
          console.warn('📍 Skipping landmark with invalid location:', landmark);
          return;
        }

        const el = document.createElement('div');
        el.className = 'marker';
        el.style.backgroundImage = `url(/marker.svg)`;
        el.style.width = `30px`;
        el.style.height = `30px`;
        el.style.backgroundSize = '100%';
        el.style.cursor = 'pointer';

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
          console.log('📍 Marker clicked:', landmark.name);
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

        console.log(`📍 Added marker for ${landmark.name} at [${landmark.location.lng}, ${landmark.location.lat}]`);
      } catch (error) {
        console.error(`📍 Error adding marker for ${landmark.name}:`, error);
      }
    }));

    console.log(`📍 Successfully added ${Object.keys(markersRef.current).length} markers`);
  }, [showPlannedOnly, validatedPlannedLandmarks, onLandmarkSelect, createPopupContent]);

  useEffect(() => {
    if (map.current) return; // prevent re-initialization

    if (!mapboxToken) {
      setMapError('Mapbox token is required');
      setIsMapLoading(false);
      return;
    }

    if (!mapContainer.current) {
      setMapError('Map container not found');
      setIsMapLoading(false);
      return;
    }

    try {
      console.log('📍 Initializing Mapbox map...');
      
      map.current = new mapboxgl.Map({
        accessToken: mapboxToken,
        container: mapContainer.current as HTMLDivElement,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-122.4194, 37.7749], // San Francisco coordinates
        zoom: 12,
      });

      // Add error handling
      map.current.on('error', (e) => {
        console.error('📍 Mapbox error:', e);
        setMapError(`Map error: ${e.error?.message || 'Unknown error'}`);
        setIsMapLoading(false);
      });

      // Add load handling
      map.current.on('load', () => {
        console.log('📍 Map loaded successfully');
        setIsMapLoading(false);
        setMapError(null);
        
        // Add markers after map loads
        addMarkers(validatedLandmarks);
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

    } catch (error) {
      console.error('📍 Error initializing map:', error);
      setMapError(`Failed to initialize map: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsMapLoading(false);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken, addMarkers, validatedLandmarks]);

  // Update markers when landmarks change
  useEffect(() => {
    if (!map.current || isMapLoading) return;

    console.log('📍 Landmarks changed, updating markers...');
    addMarkers(validatedLandmarks);
  }, [validatedLandmarks, addMarkers, isMapLoading]);

  // Handle selected landmark
  useEffect(() => {
    if (!map.current || !selectedLandmark) return;

    // Validate selected landmark has location
    const validatedSelected = validateLandmarkArray([selectedLandmark])[0];
    if (!validatedSelected) {
      console.warn('📍 Selected landmark has invalid location data:', selectedLandmark);
      return;
    }

    console.log('📍 Flying to selected landmark:', validatedSelected.name);

    // Fly to the selected landmark
    map.current.flyTo({
      center: [validatedSelected.location.lng, validatedSelected.location.lat],
      zoom: 14,
      essential: true
    });

    // Open the popup for the selected landmark
    if (markersRef.current[validatedSelected.id]) {
      markersRef.current[validatedSelected.id].togglePopup();
    }
  }, [selectedLandmark]);

  // Define window functions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.openStreetView = async (landmarkId: string) => {
        const landmark = validatedLandmarks.find((lm) => lm.id === landmarkId);
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
        const landmark = validatedLandmarks.find((lm) => lm.id === landmarkId);
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
  }, [validatedLandmarks, fetchStreetView, onLandmarkSelect, toast]);

  useEffect(() => {
    return () => {
      Object.keys(markersRef.current).forEach((key) => {
        markersRef.current[key].remove();
        if (popupsRef.current[key]) {
          popupsRef.current[key].remove();
        }
      });
    };
  }, []);

  // Render loading state
  if (isMapLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (mapError) {
    return (
      <div className={`flex items-center justify-center bg-red-50 ${className}`}>
        <div className="text-center p-4">
          <div className="text-red-500 mb-2">⚠️</div>
          <p className="text-red-700 font-medium">Map Error</p>
          <p className="text-red-600 text-sm">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainer}
      className={`map-container ${className}`}
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export default Map;
