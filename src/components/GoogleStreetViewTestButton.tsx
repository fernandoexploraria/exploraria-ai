
import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { useGoogleStreetViewTest } from '@/hooks/useGoogleStreetViewTest';
import GoogleStreetViewPanorama from './GoogleStreetViewPanorama';

const GoogleStreetViewTestButton: React.FC = () => {
  const { 
    isPanoramaOpen, 
    currentLocation, 
    testLocations,
    openPanorama, 
    closePanorama 
  } = useGoogleStreetViewTest();

  return (
    <>
      <div className="fixed bottom-4 left-4 z-40 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border max-w-sm">
        <h4 className="font-semibold text-sm mb-2">🗺️ Street View Test</h4>
        <p className="text-xs text-gray-600 mb-3">
          Test Google Street View panorama functionality:
        </p>
        <div className="space-y-2">
          {testLocations.map((location, index) => (
            <Button
              key={index}
              onClick={() => openPanorama(location)}
              variant="outline"
              size="sm"
              className="w-full text-xs"
            >
              <Eye size={14} className="mr-1" />
              {location.name}
            </Button>
          ))}
        </div>
      </div>

      {isPanoramaOpen && currentLocation && (
        <GoogleStreetViewPanorama
          isOpen={isPanoramaOpen}
          onClose={closePanorama}
          location={{ lat: currentLocation.lat, lng: currentLocation.lng }}
          landmarkName={currentLocation.name}
        />
      )}
    </>
  );
};

export default GoogleStreetViewTestButton;
