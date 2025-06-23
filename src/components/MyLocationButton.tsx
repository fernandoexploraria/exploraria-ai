
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { MapPin, Loader2, Navigation, CheckCircle } from 'lucide-react';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useToast } from '@/hooks/use-toast';

interface MyLocationButtonProps {
  onLocationFound: (location: { latitude: number; longitude: number; accuracy?: number }) => void;
  className?: string;
}

const MyLocationButton: React.FC<MyLocationButtonProps> = ({ onLocationFound, className = '' }) => {
  const { toast } = useToast();
  const { requestCurrentLocation, locationState, userLocation } = useLocationTracking();
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

  // Determine tracking status for visual indicator
  const getTrackingStatus = () => {
    if (locationState.isTracking && userLocation) {
      return { 
        icon: <CheckCircle className="h-3 w-3 text-green-600" />, 
        text: 'Active', 
        variant: 'default' as const 
      };
    }
    
    if (locationState.isTracking && !userLocation) {
      return { 
        icon: <Loader2 className="h-3 w-3 animate-spin" />, 
        text: 'Locating', 
        variant: 'secondary' as const 
      };
    }
    
    return { 
      icon: null, 
      text: 'Inactive', 
      variant: 'outline' as const 
    };
  };

  const trackingStatus = getTrackingStatus();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
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
            
            {/* Tracking status badge */}
            {locationState.isTracking && (
              <Badge 
                variant={trackingStatus.variant}
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                title={`Location tracking: ${trackingStatus.text}`}
              >
                {trackingStatus.icon}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-xs">
            <div className="font-medium mb-1">Location Status</div>
            <div>Tracking: {locationState.isTracking ? 'ON' : 'OFF'}</div>
            {userLocation && (
              <div>Accuracy: {userLocation.accuracy ? `±${Math.round(userLocation.accuracy)}m` : 'Unknown'}</div>
            )}
            {locationState.lastUpdate && (
              <div>Updated: {locationState.lastUpdate.toLocaleTimeString()}</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default MyLocationButton;
