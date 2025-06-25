
import React from 'react';
import { X, MapPin, Eye, Timer, Target } from 'lucide-react';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DebugWindowProps {
  isVisible: boolean;
  onClose: () => void;
}

const DebugWindow: React.FC<DebugWindowProps> = ({ isVisible, onClose }) => {
  const { proximitySettings, combinedLandmarks } = useProximityAlerts();
  const { locationState, userLocation } = useLocationTracking();
  
  const nearbyLandmarks = useNearbyLandmarks({
    userLocation,
    toastDistance: proximitySettings?.toast_distance || 100
  });

  if (!isVisible) return null;

  const formatDistance = (distance: number) => {
    return `${Math.round(distance)}m`;
  };

  const formatCoordinate = (coord: number) => {
    return coord.toFixed(6);
  };

  return (
    <div className="p-4 max-h-[75vh] overflow-auto">
      <div className="flex items-center justify-between mb-4 pb-3 border-b">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4" />
          <span className="font-mono text-sm font-semibold">Debug Window</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="p-1"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4 font-mono text-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-green-600">
            <MapPin className="w-3 h-3" />
            <span className="font-semibold">Location Status</span>
          </div>
          <div className="pl-5 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tracking:</span>
              <Badge variant={locationState.isTracking ? "default" : "secondary"} className="text-xs">
                {locationState.isTracking ? "Active" : "Inactive"}
              </Badge>
            </div>
            {locationState.error && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Error:</span>
                <span className="text-red-500">{locationState.error}</span>
              </div>
            )}
            {locationState.lastUpdate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Update:</span>
                <span className="text-blue-600">{locationState.lastUpdate.toLocaleTimeString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Poll Interval:</span>
              <span className="text-yellow-600">{locationState.pollInterval}ms</span>
            </div>
          </div>
        </div>

        {userLocation && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-600">
              <Target className="w-3 h-3" />
              <span className="font-semibold">Current Location</span>
            </div>
            <div className="pl-5 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latitude:</span>
                <span className="text-blue-600">{formatCoordinate(userLocation.latitude)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Longitude:</span>
                <span className="text-blue-600">{formatCoordinate(userLocation.longitude)}</span>
              </div>
              {userLocation.accuracy && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Accuracy:</span>
                  <span className="text-green-600">{formatDistance(userLocation.accuracy)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timestamp:</span>
                <span className="text-purple-600">{new Date(userLocation.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        )}

        {proximitySettings && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-purple-600">
              <Timer className="w-3 h-3" />
              <span className="font-semibold">Proximity Settings</span>
            </div>
            <div className="pl-5 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enabled:</span>
                <Badge variant={proximitySettings.is_enabled ? "default" : "secondary"} className="text-xs">
                  {proximitySettings.is_enabled ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Toast Distance:</span>
                <span className="text-orange-600">{formatDistance(proximitySettings.toast_distance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Route Distance:</span>
                <span className="text-yellow-600">{formatDistance(proximitySettings.route_distance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Card Distance:</span>
                <span className="text-green-600">{formatDistance(proximitySettings.card_distance)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-yellow-600">
            <MapPin className="w-3 h-3" />
            <span className="font-semibold">Landmarks Summary</span>
          </div>
          <div className="pl-5 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Landmarks:</span>
              <span className="text-blue-600">{combinedLandmarks.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nearby Landmarks:</span>
              <span className="text-green-600">{nearbyLandmarks.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Search Radius:</span>
              <span className="text-orange-600">{formatDistance(proximitySettings?.toast_distance || 100)}</span>
            </div>
          </div>
        </div>

        {nearbyLandmarks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-600">
              <Target className="w-3 h-3" />
              <span className="font-semibold">Nearby Landmarks ({nearbyLandmarks.length})</span>
            </div>
            <div className="pl-5 space-y-2 max-h-48 overflow-y-auto">
              {nearbyLandmarks.map((nearby, index) => (
                <div key={nearby.landmark.id} className="border rounded p-2 space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-xs leading-tight">
                      {nearby.landmark.name}
                    </span>
                    <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
                      #{index + 1}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distance:</span>
                    <span className="text-orange-600">{formatDistance(nearby.distance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coordinates:</span>
                    <span className="text-blue-600 text-xs">
                      [{formatCoordinate(nearby.landmark.coordinates[0])}, {formatCoordinate(nearby.landmark.coordinates[1])}]
                    </span>
                  </div>
                  <div className="text-muted-foreground text-xs leading-tight">
                    {nearby.landmark.description.substring(0, 80)}
                    {nearby.landmark.description.length > 80 && '...'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {nearbyLandmarks.length === 0 && userLocation && proximitySettings?.is_enabled && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="w-3 h-3" />
              <span className="font-semibold">No Nearby Landmarks</span>
            </div>
            <div className="pl-5 text-muted-foreground text-xs">
              No landmarks found within {formatDistance(proximitySettings?.toast_distance || 100)} radius
            </div>
          </div>
        )}

        <div className="border-t pt-2 text-muted-foreground text-xs">
          Swipe down to close this debug window
        </div>
      </div>
    </div>
  );
};

export default DebugWindow;
