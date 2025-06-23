
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, Navigation } from 'lucide-react';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useToast } from '@/hooks/use-toast';

interface MyLocationButtonProps {
  onLocationFound: (location: { latitude: number; longitude: number; accuracy?: number }) => void;
  className?: string;
}

const MyLocationButton: React.FC<MyLocationButtonProps> = ({ onLocationFound, className = '' }) => {
  const { toast } = useToast();
  const { requestCurrentLocation, locationState } = useLocationTracking();
  const [isLoading, setIsLoading] = useState(false);

  const handleLocationRequest = async () => {
    setIsLoading(true);
    
    try {
      const location = await requestCurrentLocation();
      
      if (location) {
        onLocationFound({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
        });
        
        toast({
          title: "Location Found",
          description: `Accuracy: ${Math.round(location.accuracy || 0)}m`,
        });
      } else {
        toast({
          title: "Location Unavailable",
          description: "Could not determine your current location.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
      toast({
        title: "Location Error",
        description: "Failed to get your current location.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={`bg-background/80 backdrop-blur-sm shadow-lg hover:bg-accent hover:text-accent-foreground ${className}`}
      onClick={handleLocationRequest}
      disabled={isLoading}
      title="Show my location"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : locationState.isTracking ? (
        <Navigation className="h-4 w-4 text-primary" />
      ) : (
        <MapPin className="h-4 w-4" />
      )}
      <span className="ml-2 hidden sm:inline">My Location</span>
    </Button>
  );
};

export default MyLocationButton;
