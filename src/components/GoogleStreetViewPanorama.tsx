
import React, { useEffect, useRef, useState } from 'react';
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
  panoId?: string; // NEW: Use pano ID from edge function
  isAvailable?: boolean; // NEW: Availability from edge function
}

const GoogleStreetViewPanorama: React.FC<GoogleStreetViewPanoramaProps> = ({
  isOpen,
  onClose,
  location,
  landmarkName,
  panoId,
  isAvailable = null
}) => {
  const panoramaRef = useRef<HTMLDivElement>(null);
  const [panorama, setPanorama] = useState<google.maps.StreetViewPanorama | null>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

  // Load Google Maps JavaScript API dynamically
  useEffect(() => {
    if (typeof google !== 'undefined' && google.maps) {
      setIsGoogleMapsLoaded(true);
      return;
    }

    // Load Google Maps JavaScript API
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_API_KEY || ''}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      setIsGoogleMapsLoaded(true);
    };
    
    script.onerror = () => {
      console.error('Failed to load Google Maps JavaScript API');
    };
    
    document.head.appendChild(script);

    return () => {
      // Clean up script if component unmounts
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !panoramaRef.current || !isGoogleMapsLoaded) return;

    // Check if we know the panorama is not available
    if (isAvailable === false) {
      console.log(`🚫 Panorama not available for ${landmarkName}`);
      return;
    }

    try {
      // Create the panorama using the location or pano ID
      const pano = new google.maps.StreetViewPanorama(panoramaRef.current, {
        position: location,
        ...(panoId && { pano: panoId }), // Use pano ID if available
        pov: { heading: 0, pitch: 0 },
        zoom: 1,
        visible: true,
        enableCloseButton: false,
        fullscreenControl: true,
        motionTracking: false,
        motionTrackingControl: false,
        showRoadLabels: true,
      });

      setPanorama(pano);

      // Listen for status changes
      pano.addListener('status_changed', () => {
        const status = pano.getStatus();
        if (status !== google.maps.StreetViewStatus.OK) {
          console.log(`❌ Panorama status changed to: ${status}`);
        }
      });

    } catch (error) {
      console.error('Error creating Street View panorama:', error);
    }
  }, [isOpen, location, landmarkName, panoId, isAvailable, isGoogleMapsLoaded]);

  // Cleanup panorama when component unmounts or closes
  useEffect(() => {
    return () => {
      if (panorama) {
        setPanorama(null);
      }
    };
  }, [panorama]);

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
          {!isGoogleMapsLoaded ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p>Loading Google Maps...</p>
              </div>
            </div>
          ) : isAvailable === false ? (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <div className="text-center text-gray-600">
                <div className="text-6xl mb-4">🏙️</div>
                <h3 className="text-xl font-semibold mb-2">Street View Not Available</h3>
                <p>Interactive Street View is not available for this location.</p>
                <p className="text-sm mt-2">This may be due to privacy restrictions or limited coverage.</p>
              </div>
            </div>
          ) : (
            <div 
              ref={panoramaRef}
              className="w-full h-full"
              style={{ minHeight: '400px' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleStreetViewPanorama;
