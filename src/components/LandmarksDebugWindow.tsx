
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Database, Activity } from 'lucide-react';
import { useSortedLandmarks } from '@/hooks/useSortedLandmarks';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useCombinedLandmarks } from '@/hooks/useCombinedLandmarks';
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
  const { proximitySettings } = useProximityAlerts();
  const combinedLandmarks = useCombinedLandmarks();

  const defaultDistance = proximitySettings?.default_distance || 50;

  const sortedLandmarks = useSortedLandmarks(
    userLocation, 
    combinedLandmarks, 
    defaultDistance
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[700px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Landmarks Debug Tool - Simple View
          </DialogTitle>
          <DialogDescription>
            Debug view showing combined landmarks and sorted landmarks lists
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Current Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Location Status:</span>
                  <Badge variant={locationState.isTracking ? "default" : "secondary"} className="ml-2">
                    {locationState.isTracking ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Poll Interval:</span>
                  <Badge variant="outline" className="ml-2">
                    {locationState.pollInterval / 1000}s
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Default Distance:</span>
                  <Badge variant="outline" className="ml-2">
                    {defaultDistance}m
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Proximity Enabled:</span>
                  <Badge variant={proximitySettings?.is_enabled ? "default" : "secondary"} className="ml-2">
                    {proximitySettings?.is_enabled ? 'Yes' : 'No'}
                  </Badge>
                </div>
              </div>
              
              {userLocation && (
                <div className="text-xs text-muted-foreground">
                  Current Location: {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
                  {userLocation.accuracy && ` (±${Math.round(userLocation.accuracy)}m)`}
                </div>
              )}
              
              {locationState.error && (
                <div className="text-xs text-destructive">
                  Error: {locationState.error}
                </div>
              )}

              {locationState.lastUpdate && (
                <div className="text-xs text-muted-foreground">
                  Last updated: {locationState.lastUpdate.toLocaleTimeString()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Combined Landmarks List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Combined Landmarks (Unfiltered)
                </div>
                <Badge variant="outline">{combinedLandmarks.length} total</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {combinedLandmarks.length > 0 ? (
                  combinedLandmarks.map((landmark) => (
                    <div key={landmark.id} className="flex items-center justify-between p-2 bg-muted rounded border">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{landmark.name}</div>
                        <div className="text-xs text-muted-foreground">ID: {landmark.id}</div>
                        <div className="text-xs text-muted-foreground">
                          Coords: [{landmark.coordinates[0].toFixed(4)}, {landmark.coordinates[1].toFixed(4)}]
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No landmarks available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sorted Landmarks List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Sorted Landmarks (Within {defaultDistance}m)
                </div>
                <Badge variant="default">{sortedLandmarks.length} in range</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {sortedLandmarks.length > 0 ? (
                  sortedLandmarks.map((item, index) => (
                    <div key={item.landmark.id} className="flex items-center justify-between p-2 bg-muted rounded border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                          <span className="font-medium text-sm">{item.landmark.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">ID: {item.landmark.id}</div>
                        <div className="text-xs text-muted-foreground">
                          Coords: [{item.landmark.coordinates[0].toFixed(4)}, {item.landmark.coordinates[1].toFixed(4)}]
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="default" className="text-xs">
                          {formatDistance(item.distance)}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    {!userLocation ? 'No location available' : 'No landmarks within range'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LandmarksDebugWindow;
