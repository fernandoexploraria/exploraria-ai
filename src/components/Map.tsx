
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Eye, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import EnhancedLandmarkInfo from '@/components/EnhancedLandmarkInfo';
import EnhancedStreetViewModal from '@/components/EnhancedStreetViewModal';
import { useStreetViewNavigation } from '@/hooks/useStreetViewNavigation';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { toast } from 'sonner';

interface Landmark {
  id: string;
  name: string;
  coordinates: [number, number];
  description: string;
  rating?: number;
  photos?: string[];
  types?: string[];
  placeId?: string;
  formattedAddress?: string;
}

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
  plannedLandmarks?: Landmark[];
}

const Map: React.FC<MapProps> = ({
  mapboxToken,
  landmarks,
  onSelectLandmark,
  selectedLandmark,
  plannedLandmarks = []
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<Landmark | null>(null);
  const [isLandmarkInfoOpen, setIsLandmarkInfoOpen] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const { userLocation } = useLocationTracking();
  const { 
    isModalOpen: isStreetViewModalOpen,
    streetViewItems,
    currentIndex: streetViewCurrentIndex,
    openStreetViewModal,
    closeStreetViewModal,
    navigateNext,
    navigatePrevious,
    navigateToIndex
  } = useStreetViewNavigation();

  const handleMarkerClick = (landmark: Landmark, event: Event) => {
    event.stopPropagation();
    setSelectedMarker(landmark);
    setIsLandmarkInfoOpen(true);
  };

  const closeLandmarkInfo = () => {
    setIsLandmarkInfoOpen(false);
    setSelectedMarker(null);
  };

  const handleLocationSelect = (landmark: Landmark) => {
    onSelectLandmark(landmark);
    closeLandmarkInfo();
  };

  // Enhanced eye icon click handler - opens enhanced Street View modal
  const handleEyeClick = async (landmark: Landmark, event: Event) => {
    event.stopPropagation();
    console.log(`👁️ Enhanced Street View requested for: ${landmark.name}`);
    
    try {
      // Use the enhanced Street View navigation system
      await openStreetViewModal([landmark], landmark, userLocation || undefined);
      console.log(`✅ Enhanced Street View modal opened for: ${landmark.name}`);
    } catch (error) {
      console.error(`❌ Failed to open enhanced Street View for ${landmark.name}:`, error);
      toast.error(`Street View not available for ${landmark.name}`);
    }
  };

  useEffect(() => {
    if (!mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    const initializeMap = () => {
      const map = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-99.195755, 19.419333],
        zoom: 10,
      });

      mapRef.current = map;

      map.on('load', () => {
        setIsMapLoaded(true);
      });

      map.on('click', () => {
        onSelectLandmark(null);
      });

      return map;
    };

    let map: mapboxgl.Map | null = null;
    if (!mapRef.current) {
      map = initializeMap();
    }

    return () => {
      if (map) map.remove();
    };
  }, [mapboxToken, onSelectLandmark]);

  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.custom-marker');
    existingMarkers.forEach(marker => marker.remove());

    landmarks.forEach(landmark => {
      const markerElement = document.createElement('div');
      markerElement.className = 'custom-marker';

      const pinElement = document.createElement('div');
      pinElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="0" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2"/></svg>`;
      markerElement.appendChild(pinElement);

      const eyeElement = document.createElement('div');
      eyeElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2 12c3-5 8-5 11 0 3 5 8 5 11 0"/><circle cx="12" cy="12" r="3"/></svg>`;
      markerElement.appendChild(eyeElement);

      pinElement.addEventListener('click', (event) => handleMarkerClick(landmark, event));
      eyeElement.addEventListener('click', (event) => handleEyeClick(landmark, event));

      new mapboxgl.Marker(markerElement)
        .setLngLat(landmark.coordinates)
        .addTo(mapRef.current!);
    });
  }, [landmarks, isMapLoaded, handleEyeClick]);

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Enhanced Street View Modal */}
      <EnhancedStreetViewModal
        isOpen={isStreetViewModalOpen}
        onClose={closeStreetViewModal}
        streetViewItems={streetViewItems}
        initialIndex={streetViewCurrentIndex}
        onLocationSelect={(coordinates) => {
          // Show selected location on map
          if (mapRef.current) {
            mapRef.current.flyTo({
              center: coordinates,
              zoom: 16,
              duration: 1000
            });
          }
        }}
      />

      {isLandmarkInfoOpen && selectedMarker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="max-w-md w-full">
            <CardContent className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={closeLandmarkInfo}
                className="absolute top-2 right-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
              <EnhancedLandmarkInfo
                landmark={{
                  ...selectedMarker,
                  coordinateSource: 'unknown',
                  confidence: 0.8
                }}
                onLocationSelect={handleLocationSelect}
                onClose={closeLandmarkInfo}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Map;
