
import React, { useEffect, useState } from 'react';
import { APIProvider, StreetViewPanorama } from '@vis.gl/react-google-maps';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GoogleStreetViewPanoramaProps {
  isOpen: boolean;
  onClose: () => void;
  location: {
    lat: number;
    lng: number;
  };
  landmarkName: string;
  apiKey: string;
}

const GoogleStreetViewPanorama: React.FC<GoogleStreetViewPanoramaProps> = ({
  isOpen,
  onClose,
  location,
  landmarkName,
  apiKey
}) => {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Check if Street View is available for this location
    const checkAvailability = async () => {
      try {
        const streetViewService = new google.maps.StreetViewService();
        streetViewService.getPanorama({
          location: location,
          radius: 50
        }, (data, status) => {
          setIsAvailable(status === google.maps.StreetViewStatus.OK);
        });
      } catch (error) {
        console.error('Error checking Street View availability:', error);
        setIsAvailable(false);
      }
    };

    checkAvailability();
  }, [isOpen, location]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center">
      <div className="relative w-full h-full max-w-6xl max-h-[90vh] bg-white rounded-lg overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-black/50 text-white p-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Street View: {landmarkName}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Panorama Content */}
        <div className="w-full h-full">
          {isAvailable === null ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p>Checking Street View availability...</p>
              </div>
            </div>
          ) : isAvailable ? (
            <APIProvider apiKey={apiKey}>
              <StreetViewPanorama
                position={location}
                pov={{ heading: 0, pitch: 0 }}
                zoom={1}
                visible={true}
                options={{
                  enableCloseButton: false,
                  fullscreenControl: true,
                  motionTracking: false,
                  motionTrackingControl: false,
                  showRoadLabels: true,
                }}
                style={{ width: '100%', height: '100%' }}
              />
            </APIProvider>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <div className="text-center text-gray-600">
                <div className="text-6xl mb-4">🏙️</div>
                <h3 className="text-xl font-semibold mb-2">Street View Not Available</h3>
                <p>Interactive Street View is not available for this location.</p>
                <p className="text-sm mt-2">This may be due to privacy restrictions or limited coverage.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleStreetViewPanorama;
