
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation } from 'lucide-react';
import { useSortedLandmarks } from '@/hooks/useSortedLandmarks';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { landmarks } from '@/data/landmarks';
import { formatDistance } from '@/utils/proximityUtils';

interface LandmarksDebugWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LandmarksDebugWindow: React.FC<LandmarksDebugWindowProps> = ({
  open,
  onOpenChange,
}) => {
  const { userLocation, locationState } = useLocationTracking();
  const sortedLandmarks = useSortedLandmarks(userLocation, landmarks);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Landmarks Debug - Distance Sorting
          </DialogTitle>
          <DialogDescription>
            Real-time sorted list of landmarks by distance from your location
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Location Status */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm font-medium">Location Status</span>
                </div>
                <Badge variant={locationState.isTracking ? "default" : "secondary"}>
                  {locationState.isTracking ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {userLocation && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Lat: {userLocation.latitude.toFixed(6)}, 
                  Lng: {userLocation.longitude.toFixed(6)}
                  {userLocation.accuracy && (
                    <span className="ml-2">±{Math.round(userLocation.accuracy)}m</span>
                  )}
                </div>
              )}
              {locationState.error && (
                <div className="mt-2 text-xs text-destructive">
                  Error: {locationState.error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sorted Landmarks List */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              Landmarks Sorted by Distance ({sortedLandmarks.length})
            </h4>
            
            {sortedLandmarks.length === 0 ? (
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center text-muted-foreground">
                    {userLocation 
                      ? 'No landmarks available' 
                      : 'Location not available - enable location tracking to see distances'
                    }
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {sortedLandmarks.map(({ landmark, distance }, index) => (
                  <Card key={landmark.id} className="relative">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                          <span className="text-sm font-medium">
                            {landmark.name}
                          </span>
                        </div>
                        <Badge 
                          variant={distance <= 1000 ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {formatDistance(distance)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {landmark.description}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {locationState.lastUpdate && (
            <div className="text-xs text-muted-foreground text-center">
              Last updated: {locationState.lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LandmarksDebugWindow;
