import React from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocationPermissionFlow } from '@/hooks/useLocationPermissionFlow';
import { useLocationTracking } from '@/hooks/useLocationTracking';

interface LocationButtonProps {
  onLocationFound?: (coordinates: [number, number]) => void;
  className?: string;
}

export const LocationButton: React.FC<LocationButtonProps> = ({
  onLocationFound,
  className = "",
}) => {
  const { showPermissionDialog, getCurrentPosition, permissionStatus } = useLocationPermissionFlow();
  const { userLocation, locationState } = useLocationTracking();

  const handleLocationRequest = async () => {
    console.log('📍 Location button clicked');
    
    // If we already have location and are tracking, zoom to current location
    if (userLocation && locationState.isTracking) {
      console.log('📍 Using existing tracked location');
      onLocationFound?.([userLocation.longitude, userLocation.latitude]);
      return;
    }
    
    // Check if we need to request permission
    if (permissionStatus === 'denied') {
      console.log('📍 Permission previously denied');
      return;
    }
    
    if (permissionStatus === 'prompt' || permissionStatus === 'unknown') {
      console.log('📍 Requesting permission via dialog');
      const granted = await showPermissionDialog('navigation');
      if (!granted) {
        console.log('📍 Permission not granted');
        return;
      }
    }
    
    // Get current position
    console.log('📍 Getting current position');
    const position = await getCurrentPosition();
    if (position) {
      const coordinates: [number, number] = [position.coords.longitude, position.coords.latitude];
      console.log('📍 Position obtained:', coordinates);
      onLocationFound?.(coordinates);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLocationRequest}
      className={`h-8 w-8 p-0 bg-white/95 hover:bg-white border-gray-200 shadow-md ${className}`}
      title="My Location"
    >
      {locationState.isTracking ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <MapPin className="h-4 w-4 text-gray-700" />
      )}
    </Button>
  );
};