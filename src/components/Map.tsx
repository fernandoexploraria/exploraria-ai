import React, { useState, useCallback } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Camera, Volume2 } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { useEnhancedPhotos } from '@/hooks/useEnhancedPhotos';
import PhotoCarousel from '@/components/photo-carousel/PhotoCarousel';
import SmartLandmarkInfo from '@/components/landmark/SmartLandmarkInfo';

interface MapProps {
  landmarks: Landmark[];
  apiKey: string;
  onStreetViewClick: (landmark: Landmark) => void;
  onListenClick: (landmark: Landmark) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '500px',
};

const Map: React.FC<MapProps> = ({ 
  landmarks, 
  apiKey, 
  onStreetViewClick,
  onListenClick
}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  });

  const { enhancedPhotos } = useEnhancedPhotos(selectedLandmark ? selectedLandmark.name : null);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  const handleMarkerClick = (landmark: Landmark) => {
    setSelectedLandmark(landmark);
  };

  const handleStreetViewClick = (landmark: Landmark) => {
    onStreetViewClick(landmark);
  };

  const handleListenClick = (landmark: Landmark) => {
    onListenClick(landmark);
  };

  return (
    <div className="relative">
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={12}
          center={{
            lat: landmarks[0]?.latitude || 0,
            lng: landmarks[0]?.longitude || 0,
          }}
          onLoad={onLoad}
          onUnmount={onUnmount}
        >
          {landmarks.map((landmark) => (
            <Marker
              key={landmark.place_id}
              position={{
                lat: landmark.latitude,
                lng: landmark.longitude,
              }}
              onClick={() => handleMarkerClick(landmark)}
            />
          ))}
          {selectedLandmark && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
              {/* Popup Content */}
              <div className="w-full max-w-sm bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Photo Carousel Section */}
                <div className="relative">
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
                <div className="p-4 bg-white">
                  <SmartLandmarkInfo 
                    landmark={selectedLandmark}
                    className="space-y-3"
                  />

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    {selectedLandmark.latitude && selectedLandmark.longitude && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStreetViewClick(selectedLandmark)}
                        className="flex items-center gap-1"
                      >
                        <Camera className="h-4 w-4" />
                        Street View
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleListenClick(selectedLandmark)}
                      className="flex items-center gap-1"
                    >
                      <Volume2 className="h-4 w-4" />
                      Listen
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </GoogleMap>
      ) : loadError ? (
        <div>Error loading map</div>
      ) : (
        <div>Loading map...</div>
      )}
    </div>
  );
};

export default Map;
