
import React, { useState, useCallback, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Camera, Volume2 } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { useEnhancedPhotos } from '@/hooks/useEnhancedPhotos';
import PhotoCarousel from '@/components/photo-carousel/PhotoCarousel';
import SmartLandmarkInfo from '@/components/landmark/SmartLandmarkInfo';

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
  plannedLandmarks: Landmark[];
}

const Map: React.FC<MapProps> = ({ 
  mapboxToken,
  landmarks, 
  onSelectLandmark,
  selectedLandmark,
  plannedLandmarks
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedLandmarkState, setSelectedLandmarkState] = useState<Landmark | null>(selectedLandmark);
  const [enhancedPhotos, setEnhancedPhotos] = useState<any[]>([]);
  const { fetchPhotos } = useEnhancedPhotos();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: landmarks.length > 0 ? landmarks[0].coordinates : [-99.1332, 19.4326],
      zoom: 12
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Add markers when landmarks change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add new markers
    landmarks.forEach((landmark) => {
      const marker = new mapboxgl.Marker()
        .setLngLat(landmark.coordinates)
        .addTo(map.current!);

      marker.getElement().addEventListener('click', () => {
        handleMarkerClick(landmark);
      });
    });
  }, [landmarks]);

  // Fetch photos when selectedLandmarkState changes
  useEffect(() => {
    if (selectedLandmarkState) {
      fetchLandmarkPhotos(selectedLandmarkState);
    }
  }, [selectedLandmarkState]);

  const fetchLandmarkPhotos = async (landmark: Landmark) => {
    try {
      const result = await fetchPhotos(
        landmark.placeId || '',
        800,
        'medium',
        landmark.id
      );
      
      if (result?.photos) {
        setEnhancedPhotos(result.photos);
      } else {
        setEnhancedPhotos([]);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
      setEnhancedPhotos([]);
    }
  };

  const handleMarkerClick = (landmark: Landmark) => {
    setSelectedLandmarkState(landmark);
    onSelectLandmark(landmark);
  };

  const handleStreetViewClick = (landmark: Landmark) => {
    console.log('Street view clicked for:', landmark.name);
  };

  const handleListenClick = (landmark: Landmark) => {
    console.log('Listen clicked for:', landmark.name);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {selectedLandmarkState && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 w-full max-w-sm">
          {/* Photo Carousel Section */}
          <div className="bg-white rounded-t-lg shadow-lg overflow-hidden">
            <PhotoCarousel
              photos={enhancedPhotos}
              initialIndex={0}
              showThumbnails={enhancedPhotos.length > 1}
              allowZoom={false}
              allowFullscreen={true}
              className="aspect-video"
            />
          </div>

          {/* Smart Landmark Info Section */}
          <div className="bg-white rounded-b-lg shadow-lg p-4">
            <SmartLandmarkInfo 
              landmark={selectedLandmarkState}
              className="space-y-3"
            />

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStreetViewClick(selectedLandmarkState)}
                className="flex items-center gap-1"
              >
                <Camera className="h-4 w-4" />
                Street View
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleListenClick(selectedLandmarkState)}
                className="flex items-center gap-1"
              >
                <Volume2 className="h-4 w-4" />
                Listen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Map;
