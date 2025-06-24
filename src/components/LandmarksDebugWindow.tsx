import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { MapPin, Navigation, Clock, Database, Settings, TestTube, Activity, Target, Play, Square } from 'lucide-react';
import { useSortedLandmarks } from '@/hooks/useSortedLandmarks';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useLandmarkSourceToggle, LANDMARK_SOURCE_OPTIONS, LandmarkSource } from '@/hooks/useLandmarkSourceToggle';
import { DebugOverrides } from '@/types/debugOverrides';
import { formatDistance } from '@/utils/proximityUtils';
import { useToast } from '@/hooks/use-toast';

interface LandmarksDebugWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDebugOverridesChange?: (overrides: DebugOverrides) => void;
}

const LandmarksDebugWindow: React.FC<LandmarksDebugWindowProps> = ({
  open,
  onOpenChange,
  onDebugOverridesChange,
}) => {
  const { toast } = useToast();
  const { userLocation, locationState } = useLocationTracking();
  const { proximitySettings } = useProximityAlerts();

  // Use the landmark source toggle hook
  const {
    selectedSource,
    setSelectedSource,
    currentLandmarks,
    sourceCounts
  } = useLandmarkSourceToggle();

  // Debug override state
  const [debugOverrides, setDebugOverrides] = useState<DebugOverrides>({
    enabled: false,
    targetLandmarkId: null,
    forcedDistance: null,
  });

  // Test mode UI state
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<string>('');
  const [forcedDistanceInput, setForcedDistanceInput] = useState<string>('');

  // Dynamic range controls state
  const [toastRange, setToastRange] = useState([1000]);
  const [routeRange, setRouteRange] = useState([500]);
  const [cardRange, setCardRange] = useState([100]);

  // Test simulation state
  const [simulatedDistance, setSimulatedDistance] = useState('');
  const [notificationHistory, setNotificationHistory] = useState<string[]>([]);

  const defaultDistance = proximitySettings?.default_distance || 100;

  // Get the raw array from useSortedLandmarks - fixed to use correct signature
  const sortedLandmarks = useSortedLandmarks(
    userLocation, 
    currentLandmarks, 
    defaultDistance,
    debugOverrides
  );

  const closestLandmark = sortedLandmarks.length > 0 ? sortedLandmarks[0] : null;

  // Notify parent component when debug overrides change
  useEffect(() => {
    onDebugOverridesChange?.(debugOverrides);
  }, [debugOverrides, onDebugOverridesChange]);

  // Function to determine what notifications would trigger at a given distance
  const getNotificationsThatWouldTrigger = (distance: number) => {
    const triggers = [];
    if (distance <= cardRange[0]) {
      triggers.push('Floating Card');
    } else if (distance <= routeRange[0]) {
      triggers.push('Route Visualization');
    } else if (distance <= toastRange[0]) {
      triggers.push('Toast Notification');
    }
    return triggers;
  };

  // Test different distance scenarios
  const testDistance = (distance: number) => {
    const triggers = getNotificationsThatWouldTrigger(distance);
    const timestamp = new Date().toLocaleTimeString();
    
    if (triggers.length > 0) {
      const message = `${timestamp}: At ${distance}m would trigger: ${triggers.join(', ')}`;
      setNotificationHistory(prev => [message, ...prev.slice(0, 9)]); // Keep last 10 entries
      
      // Actually trigger a test notification
      toast({
        title: "Test Notification",
        description: `At ${distance}m: ${triggers.join(', ')} would trigger`,
      });
    } else {
      const message = `${timestamp}: At ${distance}m no notifications would trigger`;
      setNotificationHistory(prev => [message, ...prev.slice(0, 9)]);
    }
  };

  const handleSimulateDistance = () => {
    const distance = parseInt(simulatedDistance);
    if (!isNaN(distance) && distance >= 0) {
      testDistance(distance);
    }
  };

  const resetToDefaults = () => {
    setToastRange([1000]);
    setRouteRange([500]);
    setCardRange([100]);
    toast({
      title: "Reset Complete",
      description: "Range values reset to defaults",
    });
  };

  const handleApplyOverride = () => {
    const distance = parseInt(forcedDistanceInput);
    if (selectedLandmarkId && !isNaN(distance) && distance >= 0) {
      const newOverrides = {
        enabled: true,
        targetLandmarkId: selectedLandmarkId,
        forcedDistance: distance,
      };
      setDebugOverrides(newOverrides);
      
      toast({
        title: "Debug Override Applied",
        description: `Distance for selected landmark set to ${distance}m`,
      });
    }
  };

  const handleClearOverride = () => {
    setDebugOverrides({
      enabled: false,
      targetLandmarkId: null,
      forcedDistance: null,
    });
    
    toast({
      title: "Debug Override Cleared",
      description: "Using real distances again",
    });
  };

  const selectedLandmark = currentLandmarks.find(l => l.id === selectedLandmarkId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[700px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Proximity Debug Tool - Enhanced Controls
          </DialogTitle>
          <DialogDescription>
            Debug and test proximity notification ranges dynamically
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Test Mode Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4" />
                Test Mode - Force Distances
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="test-mode"
                  checked={debugOverrides.enabled}
                  onCheckedChange={(checked) => 
                    setDebugOverrides(prev => ({ ...prev, enabled: checked }))
                  }
                />
                <Label htmlFor="test-mode">Enable Test Mode</Label>
              </div>

              {debugOverrides.enabled && (
                <div className="space-y-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Target Landmark</Label>
                    <Select value={selectedLandmarkId} onValueChange={setSelectedLandmarkId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a landmark to test" />
                      </SelectTrigger>
                      <SelectContent>
                        {currentLandmarks.map((landmark) => (
                          <SelectItem key={landmark.id} value={landmark.id}>
                            {landmark.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Forced Distance (meters)</Label>
                    <Input
                      placeholder="Enter distance in meters"
                      value={forcedDistanceInput}
                      onChange={(e) => setForcedDistanceInput(e.target.value)}
                      type="number"
                      min="0"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleApplyOverride} 
                      size="sm"
                      disabled={!selectedLandmarkId || !forcedDistanceInput}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Apply Override
                    </Button>
                    <Button 
                      onClick={handleClearOverride} 
                      variant="outline" 
                      size="sm"
                    >
                      <Square className="h-3 w-3 mr-1" />
                      Clear Override
                    </Button>
                  </div>

                  {debugOverrides.targetLandmarkId && debugOverrides.forcedDistance !== null && (
                    <div className="p-2 bg-green-100 rounded border border-green-300">
                      <div className="text-sm font-medium text-green-800">
                        Active Override: {currentLandmarks.find(l => l.id === debugOverrides.targetLandmarkId)?.name} → {debugOverrides.forcedDistance}m
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dynamic Range Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4" />
                Dynamic Range Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Toast Range */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Toast Notification Range: {toastRange[0]}m
                </Label>
                <Slider
                  value={toastRange}
                  onValueChange={setToastRange}
                  max={2000}
                  min={100}
                  step={50}
                  className="w-full"
                />
              </div>

              {/* Route Range */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Route Visualization Range: {routeRange[0]}m
                </Label>
                <Slider
                  value={routeRange}
                  onValueChange={setRouteRange}
                  max={1000}
                  min={50}
                  step={25}
                  className="w-full"
                />
              </div>

              {/* Card Range */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Floating Card Range: {cardRange[0]}m
                </Label>
                <Slider
                  value={cardRange}
                  onValueChange={setCardRange}
                  max={500}
                  min={10}
                  step={10}
                  className="w-full"
                />
              </div>

              <Button onClick={resetToDefaults} variant="outline" size="sm">
                Reset to Defaults
              </Button>
            </CardContent>
          </Card>

          {/* Test Simulation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TestTube className="h-4 w-4" />
                Test Simulation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Distance in meters"
                  value={simulatedDistance}
                  onChange={(e) => setSimulatedDistance(e.target.value)}
                  type="number"
                  min="0"
                />
                <Button onClick={handleSimulateDistance} size="sm">
                  Test
                </Button>
              </div>

              {/* Quick Test Presets */}
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => testDistance(50)} variant="outline" size="sm">
                  Test 50m
                </Button>
                <Button onClick={() => testDistance(200)} variant="outline" size="sm">
                  Test 200m
                </Button>
                <Button onClick={() => testDistance(600)} variant="outline" size="sm">
                  Test 600m
                </Button>
                <Button onClick={() => testDistance(1200)} variant="outline" size="sm">
                  Test 1200m
                </Button>
              </div>

              {/* Notification History */}
              {notificationHistory.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Test History:</Label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {notificationHistory.map((entry, index) => (
                      <div key={index} className="text-xs text-muted-foreground bg-muted p-2 rounded">
                        {entry}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Current Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {closestLandmark ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Closest Landmark:</span>
                    <Badge variant="outline">{closestLandmark.landmark.name}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Distance:</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{formatDistance(closestLandmark.distance)}</Badge>
                      {debugOverrides.enabled && debugOverrides.targetLandmarkId === closestLandmark.landmark.id && (
                        <Badge variant="secondary" className="text-xs">FORCED</Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Would Trigger:</span>
                    <div className="flex gap-2 flex-wrap">
                      {getNotificationsThatWouldTrigger(closestLandmark.distance).map((trigger) => (
                        <Badge key={trigger} variant="secondary" className="text-xs">
                          {trigger}
                        </Badge>
                      ))}
                      {getNotificationsThatWouldTrigger(closestLandmark.distance).length === 0 && (
                        <Badge variant="outline" className="text-xs">
                          No notifications
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground">
                  No landmarks in range or location unavailable
                </div>
              )}

              {/* Range Indicators */}
              <div className="space-y-2 pt-2 border-t">
                <span className="text-sm font-medium">Current Ranges:</span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="font-medium">Toast</div>
                    <Badge variant="outline" className="text-xs">{toastRange[0]}m</Badge>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">Route</div>
                    <Badge variant="outline" className="text-xs">{routeRange[0]}m</Badge>
                  </div>
                  <div className="text-center">
                    <div className="font-medium">Card</div>
                    <Badge variant="outline" className="text-xs">{cardRange[0]}m</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
