
import React from 'react';
import { X, MapPin, Eye, Timer, Target, Route, Bell, Camera } from 'lucide-react';
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
  
  // Get landmarks within notification zone (for toast notifications)
  const notificationZoneLandmarks = useNearbyLandmarks({
    userLocation,
    notificationDistance: proximitySettings?.notification_distance || 100
  });

  // Get landmarks within Street View prep zone (outer distance)
  const prepZoneLandmarks = useNearbyLandmarks({
    userLocation,
    notificationDistance: proximitySettings?.outer_distance || 250
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Movement State:</span>
              <Badge variant={locationState.movementState.isMoving ? "default" : "secondary"} className="text-xs">
                {locationState.movementState.isMoving ? "Moving" : "Stationary"}
              </Badge>
            </div>
            {locationState.movementState.averageSpeed > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Speed:</span>
                <span className="text-purple-600">{locationState.movementState.averageSpeed.toFixed(1)} m/s</span>
              </div>
            )}
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
                <span className="text-muted-foreground">Outer Distance (Prep):</span>
                <span className="text-yellow-600">{formatDistance(proximitySettings.outer_distance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notification Distance:</span>
                <span className="text-orange-600">{formatDistance(proximitySettings.notification_distance)}</span>
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
              <span className="text-muted-foreground">Street View Prep Zone:</span>
              <span className="text-yellow-600">{prepZoneLandmarks.length} (≤{formatDistance(proximitySettings?.outer_distance || 250)})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notification Zone:</span>
              <span className="text-orange-600">{notificationZoneLandmarks.length} (≤{formatDistance(proximitySettings?.notification_distance || 100)})</span>
            </div>
          </div>
        </div>

        {prepZoneLandmarks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-yellow-600">
              <Camera className="w-3 h-3" />
              <span className="font-semibold">Street View Prep Zone ({prepZoneLandmarks.length})</span>
            </div>
            <div className="text-xs text-muted-foreground pl-5 mb-2">
              Landmarks within {formatDistance(proximitySettings?.outer_distance || 250)} - Street View gets pre-loaded
            </div>
            <div className="pl-5 space-y-2 max-h-40 overflow-y-auto">
              {prepZoneLandmarks.map((nearby, index) => {
                const isInNotificationZone = notificationZoneLandmarks.some(n => n.landmark.id === nearby.landmark.id);
                return (
                  <div key={nearby.landmark.id} className="border border-yellow-200 dark:border-yellow-800 rounded p-2 space-y-1 bg-yellow-100 dark:bg-yellow-900/20">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-xs leading-tight text-yellow-900 dark:text-yellow-100">
                        {nearby.landmark.name}
                      </span>
                      <div className="flex gap-1 ml-2 flex-shrink-0">
                        <Badge variant="outline" className="text-xs border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200">
                          #{index + 1}
                        </Badge>
                        {isInNotificationZone && (
                          <Badge variant="default" className="text-xs bg-orange-600 hover:bg-orange-700 text-white">
                            <Bell className="w-2 h-2 mr-1" />
                            Notify
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-700 dark:text-yellow-300">Distance:</span>
                      <span className="text-yellow-800 dark:text-yellow-200 font-medium">{formatDistance(nearby.distance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-700 dark:text-yellow-300">Coordinates:</span>
                      <span className="text-blue-700 dark:text-blue-300 text-xs font-mono">
                        [{formatCoordinate(nearby.landmark.coordinates[0])}, {formatCoordinate(nearby.landmark.coordinates[1])}]
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {notificationZoneLandmarks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-orange-600">
              <Bell className="w-3 h-3" />
              <span className="font-semibold">Notification Zone ({notificationZoneLandmarks.length})</span>
            </div>
            <div className="text-xs text-muted-foreground pl-5 mb-2">
              Landmarks within {formatDistance(proximitySettings?.notification_distance || 100)} - Toast notifications triggered
            </div>
            <div className="pl-5 space-y-2 max-h-40 overflow-y-auto">
              {notificationZoneLandmarks.map((nearby, index) => (
                <div key={nearby.landmark.id} className="border border-orange-200 dark:border-orange-800 rounded p-2 space-y-1 bg-orange-100 dark:bg-orange-900/20">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-xs leading-tight text-orange-900 dark:text-orange-100">
                      {nearby.landmark.name}
                    </span>
                    <Badge variant="outline" className="text-xs ml-2 flex-shrink-0 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200">
                      #{index + 1}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-700 dark:text-orange-300">Distance:</span>
                    <span className="text-orange-800 dark:text-orange-200 font-medium">{formatDistance(nearby.distance)}</span>
                  </div>
                  <div className="text-orange-700 dark:text-orange-300 text-xs leading-tight">
                    {nearby.landmark.description.substring(0, 60)}
                    {nearby.landmark.description.length > 60 && '...'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {prepZoneLandmarks.length === 0 && notificationZoneLandmarks.length === 0 && userLocation && proximitySettings?.is_enabled && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="w-3 h-3" />
              <span className="font-semibold">No Nearby Landmarks</span>
            </div>
            <div className="pl-5 space-y-1 text-muted-foreground text-xs">
              <div>No landmarks found within Street View prep zone ({formatDistance(proximitySettings?.outer_distance || 250)})</div>
              <div>No landmarks found within notification zone ({formatDistance(proximitySettings?.notification_distance || 100)})</div>
            </div>
          </div>
        )}

        <div className="border-t pt-2 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Route className="w-3 h-3" />
            <span className="font-semibold text-xs">Zone Logic</span>
          </div>
          <div className="text-muted-foreground text-xs leading-tight">
            <div>• Street View pre-loads when landmarks enter outer zone</div>
            <div>• Toast notifications trigger when landmarks enter notification zone</div>
            <div>• Notification zone is subset of prep zone</div>
          </div>
        </div>

        <div className="border-t pt-2 text-muted-foreground text-xs">
          Press Ctrl+D to close this debug window
        </div>
      </div>
    </div>
  );
};

export default DebugWindow;
