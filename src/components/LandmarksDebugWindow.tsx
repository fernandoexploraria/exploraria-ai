
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MapPin, Navigation, Filter, List, Clock, Database } from 'lucide-react';
import { useSortedLandmarks } from '@/hooks/useSortedLandmarks';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useLandmarkSourceToggle, LANDMARK_SOURCE_OPTIONS, LandmarkSource } from '@/hooks/useLandmarkSourceToggle';
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
  const [showAllLandmarks, setShowAllLandmarks] = useState(false);

  // Use the new landmark source toggle hook
  const {
    selectedSource,
    setSelectedSource,
    currentLandmarks,
    sourceCounts
  } = useLandmarkSourceToggle();

  // Get filtered landmarks (within range) and all landmarks for comparison
  const filteredLandmarks = useSortedLandmarks(
    userLocation, 
    currentLandmarks, 
    proximitySettings?.default_distance
  );
  const allLandmarks = useSortedLandmarks(userLocation, currentLandmarks);

  const currentList = showAllLandmarks ? allLandmarks : filteredLandmarks;
  const defaultDistance = proximitySettings?.default_distance || 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Landmarks Debug - Source Toggle
          </DialogTitle>
          <DialogDescription>
            Debug different landmark sources and proximity filtering
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Landmark Source Toggle */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-4 w-4" />
                <span className="text-sm font-medium">Landmark Source</span>
              </div>
              
              <ToggleGroup
                type="single"
                value={selectedSource}
                onValueChange={(value: LandmarkSource) => {
                  if (value) setSelectedSource(value);
                }}
                className="grid grid-cols-1 gap-2"
              >
                {LANDMARK_SOURCE_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className="flex items-center justify-between p-3 h-auto"
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {sourceCounts[option.value]}
                    </Badge>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <div className="mt-3 text-xs text-muted-foreground">
                Current source: <strong>{selectedSource}</strong> • {currentLandmarks.length} landmarks loaded
              </div>
            </CardContent>
          </Card>

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
              
              {/* Polling Information */}
              {locationState.isTracking && (
                <div className="mt-2 flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Polling every {locationState.pollInterval / 1000}s
                  </span>
                </div>
              )}
              
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

          {/* Filter Controls */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Filter Range: {formatDistance(defaultDistance)}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllLandmarks(!showAllLandmarks)}
                  className="text-xs"
                >
                  {showAllLandmarks ? (
                    <>
                      <Filter className="h-3 w-3 mr-1" />
                      Show Within Range
                    </>
                  ) : (
                    <>
                      <List className="h-3 w-3 mr-1" />
                      Show All
                    </>
                  )}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                {filteredLandmarks.length} within range • {allLandmarks.length} total landmarks
              </div>
            </CardContent>
          </Card>

          {/* Landmarks List */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              {showAllLandmarks ? 'All Landmarks' : 'Landmarks Within Range'} ({currentList.length})
            </h4>
            
            {currentList.length === 0 ? (
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center text-muted-foreground">
                    {userLocation 
                      ? (showAllLandmarks 
                          ? `No landmarks available from ${selectedSource} source` 
                          : `No landmarks within ${formatDistance(defaultDistance)} range from ${selectedSource} source`
                        )
                      : 'Location not available - enable location tracking to see distances'
                    }
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {currentList.map(({ landmark, distance }, index) => {
                  const isWithinRange = distance <= defaultDistance;
                  
                  return (
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
                            {showAllLandmarks && !isWithinRange && (
                              <Badge variant="secondary" className="text-xs">
                                Out of range
                              </Badge>
                            )}
                          </div>
                          <Badge 
                            variant={isWithinRange ? "default" : "secondary"}
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
                  );
                })}
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
