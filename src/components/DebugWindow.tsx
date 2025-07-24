import React from 'react';
import { X, MapPin, Eye, Timer, Target, Route, Bell, Camera, TestTube, Loader2, Database, Wifi, WifiOff, CreditCard } from 'lucide-react';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { useStreetViewNavigation } from '@/hooks/useStreetViewNavigation';
import { useEnhancedStreetViewMulti } from '@/hooks/useEnhancedStreetViewMulti';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useProximityNotifications } from '@/hooks/useProximityNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EnhancedStreetViewModal from '@/components/EnhancedStreetViewModal';
import PlacesApiTestPanel from '@/components/PlacesApiTestPanel';
import NetworkTestingPanel from '@/components/NetworkTestingPanel';
import DemoAssetsUtility from '@/components/DemoAssetsUtility';

interface DebugWindowProps {
  isVisible: boolean;
  onClose: () => void;
}

const DebugWindow: React.FC<DebugWindowProps> = ({ isVisible, onClose }) => {
  const { proximitySettings, combinedLandmarks } = useProximityAlerts();
  const { locationState, userLocation } = useLocationTracking();
  const { effectiveType } = useNetworkStatus();
  const { cardZoneLandmarks, activeCards, cardState } = useProximityNotifications();
  
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

  // Street View navigation hook for interactive modal
  const {
    isModalOpen,
    streetViewItems,
    openStreetViewModal,
    closeStreetViewModal,
    getViewpointStrategy
  } = useStreetViewNavigation();

  // Enhanced Street View multi hook for strategy and cache info
  const {
    getCachedData,
    isKnownUnavailable,
    getCacheStats,
    isLoading
  } = useEnhancedStreetViewMulti();

  // Helper function to get strategy info for a landmark
  const getStrategyInfo = (landmark: any, distance: number) => {
    const strategy = getViewpointStrategy(distance, effectiveType);
    const strategyKey = `${strategy.strategy}-${strategy.quality}`;
    const cached = getCachedData(landmark.id || landmark.placeId, strategyKey);
    const isUnavailable = isKnownUnavailable(landmark.id || landmark.placeId);
    const loading = isLoading[landmark.id || landmark.placeId];

    // Determine viewpoint count based on strategy
    let viewpointCount = 1;
    switch (strategy.strategy) {
      case 'single':
        viewpointCount = 1;
        break;
      case 'cardinal':
        viewpointCount = 4;
        break;
      case 'smart':
        viewpointCount = 3;
        break;
      case 'all':
        viewpointCount = 4;
        break;
    }

    // If we have cached data, use actual viewpoint count
    if (cached && 'viewpoints' in cached) {
      viewpointCount = cached.viewpoints.length;
    }

    return {
      strategy: strategy.strategy,
      quality: strategy.quality,
      viewpointCount,
      cached: !!cached,
      isUnavailable,
      loading,
      dataUsage: cached && 'metadata' in cached ? cached.metadata.dataUsage : null
    };
  };

  // Handle landmark card clicks to open Street View
  const handleLandmarkClick = async (clickedLandmark: any, landmarks: any[]) => {
    console.log(`🔍 Opening Street View for ${clickedLandmark.landmark.name} from debug window`);
    
    // Extract just the landmark objects from NearbyLandmark array and convert to Landmark format
    const landmarkObjects = landmarks.map(nearby => ({
      id: nearby.landmark.id || nearby.landmark.placeId,
      name: nearby.landmark.name,
      coordinates: nearby.landmark.coordinates,
      description: nearby.landmark.description,
      rating: nearby.landmark.rating,
      photos: nearby.landmark.photos,
      types: nearby.landmark.types,
      placeId: nearby.landmark.placeId,
      formattedAddress: nearby.landmark.formattedAddress
    }));
    
    const clickedLandmarkConverted = {
      id: clickedLandmark.landmark.id || clickedLandmark.landmark.placeId,
      name: clickedLandmark.landmark.name,
      coordinates: clickedLandmark.landmark.coordinates,
      description: clickedLandmark.landmark.description,
      rating: clickedLandmark.landmark.rating,
      photos: clickedLandmark.landmark.photos,
      types: clickedLandmark.landmark.types,
      placeId: clickedLandmark.landmark.placeId,
      formattedAddress: clickedLandmark.landmark.formattedAddress
    };
    
    await openStreetViewModal(landmarkObjects, clickedLandmarkConverted);
  };

  if (!isVisible) return null;

  const formatDistance = (distance: number) => {
    return `${Math.round(distance)}m`;
  };

  const formatCoordinate = (coord: number) => {
    return coord.toFixed(6);
  };

  // Get strategy color for badges
  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'single':
        return 'bg-gray-500';
      case 'cardinal':
        return 'bg-blue-500';
      case 'smart':
        return 'bg-purple-500';
      case 'all':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <>
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

        <Tabs defaultValue="proximity" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="proximity">Proximity Debug</TabsTrigger>
            <TabsTrigger value="api-tests">API Tests</TabsTrigger>
          </TabsList>

          <TabsContent value="proximity" className="space-y-4 font-mono text-xs">
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Card Zone:</span>
                  <span className="text-green-600">{cardZoneLandmarks.length} (≤{formatDistance(proximitySettings?.card_distance || 75)})</span>
                </div>
              </div>
            </div>

            {cardZoneLandmarks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600">
                  <CreditCard className="w-3 h-3" />
                  <span className="font-semibold">Tourist Services Card Zone ({cardZoneLandmarks.length})</span>
                </div>
                <div className="text-xs text-muted-foreground pl-5 mb-2">
                  Landmarks within {formatDistance(proximitySettings?.card_distance || 75)} - Tourist services cards shown (Click to view)
                </div>
                <div className="pl-5 space-y-2 max-h-40 overflow-y-auto">
                  {cardZoneLandmarks.map((nearby, index) => {
                    const placeId = nearby.landmark.placeId;
                    const isActive = !!activeCards[placeId];
                    const cardInfo = cardState[placeId];
                    
                    return (
                      <div 
                        key={placeId} 
                        className="border border-green-200 dark:border-green-800 rounded p-2 space-y-1 bg-green-100 dark:bg-green-900/20 cursor-pointer hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors relative group"
                        onClick={() => handleLandmarkClick(nearby, cardZoneLandmarks)}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-xs leading-tight text-green-900 dark:text-green-100">
                            {nearby.landmark.name}
                          </span>
                          <div className="flex gap-1 ml-2 flex-shrink-0">
                            <Badge variant="outline" className="text-xs border-green-300 dark:border-green-700 text-green-800 dark:text-green-200">
                              #{index + 1}
                            </Badge>
                            {isActive && (
                              <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700 text-white">
                                <CreditCard className="w-2 h-2 mr-1" />
                                Active
                              </Badge>
                            )}
                            <Eye className="w-3 h-3 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-green-700 dark:text-green-300">Distance:</span>
                          <span className="text-green-800 dark:text-green-200 font-medium">{formatDistance(nearby.distance)}</span>
                        </div>

                        {cardInfo && (
                          <div className="flex justify-between">
                            <span className="text-green-700 dark:text-green-300">Last Card:</span>
                            <span className="text-blue-700 dark:text-blue-300 text-xs">
                              {new Date(cardInfo.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex justify-between">
                          <span className="text-green-700 dark:text-green-300">Coordinates:</span>
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

            {prepZoneLandmarks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-yellow-600">
                  <Camera className="w-3 h-3" />
                  <span className="font-semibold">Street View Prep Zone ({prepZoneLandmarks.length})</span>
                </div>
                <div className="text-xs text-muted-foreground pl-5 mb-2">
                  Landmarks within {formatDistance(proximitySettings?.outer_distance || 250)} - Street View gets pre-loaded (Click to view)
                </div>
                <div className="pl-5 space-y-2 max-h-40 overflow-y-auto">
                  {prepZoneLandmarks.map((nearby, index) => {
                    const placeId = nearby.landmark.placeId;
                    const isInNotificationZone = notificationZoneLandmarks.some(n => n.landmark.placeId === placeId);
                    const isInCardZone = cardZoneLandmarks.some(n => n.landmark.placeId === placeId);
                    const strategyInfo = getStrategyInfo(nearby.landmark, nearby.distance);
                    
                    return (
                      <div 
                        key={placeId} 
                        className="border border-yellow-200 dark:border-yellow-800 rounded p-2 space-y-1 bg-yellow-100 dark:bg-yellow-900/20 cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-900/30 transition-colors relative group"
                        onClick={() => handleLandmarkClick(nearby, prepZoneLandmarks)}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-xs leading-tight text-yellow-900 dark:text-yellow-100">
                            {nearby.landmark.name}
                          </span>
                          <div className="flex gap-1 ml-2 flex-shrink-0">
                            <Badge variant="outline" className="text-xs border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200">
                              #{index + 1}
                            </Badge>
                            {isInCardZone && (
                              <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700 text-white">
                                <CreditCard className="w-2 h-2 mr-1" />
                                Card
                              </Badge>
                            )}
                            {isInNotificationZone && (
                              <Badge variant="default" className="text-xs bg-orange-600 hover:bg-orange-700 text-white">
                                <Bell className="w-2 h-2 mr-1" />
                                Notify
                              </Badge>
                            )}
                            <Eye className="w-3 h-3 text-yellow-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        
                        {/* Enhanced Multi-Viewpoint Indicators */}
                        <div className="flex justify-between items-center">
                          <span className="text-yellow-700 dark:text-yellow-300">Strategy:</span>
                          <div className="flex items-center gap-1">
                            <Badge className={`text-xs text-white ${getStrategyColor(strategyInfo.strategy)}`}>
                              {strategyInfo.strategy.toUpperCase()}
                            </Badge>
                            <Badge className="text-xs bg-cyan-600 text-white font-bold">
                              {strategyInfo.viewpointCount}v
                            </Badge>
                            {strategyInfo.loading && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                            {strategyInfo.cached && <Database className="w-3 h-3 text-green-500" />}
                            {strategyInfo.isUnavailable && <WifiOff className="w-3 h-3 text-red-500" />}
                          </div>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-yellow-700 dark:text-yellow-300">Distance:</span>
                          <span className="text-yellow-800 dark:text-yellow-200 font-medium">{formatDistance(nearby.distance)}</span>
                        </div>
                        
                        {strategyInfo.dataUsage && (
                          <div className="flex justify-between">
                            <span className="text-yellow-700 dark:text-yellow-300">Data Usage:</span>
                            <span className="text-blue-700 dark:text-blue-300 text-xs">{strategyInfo.dataUsage}</span>
                          </div>
                        )}
                        
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
                  Landmarks within {formatDistance(proximitySettings?.notification_distance || 100)} - Toast notifications triggered (Click to view)
                </div>
                <div className="pl-5 space-y-2 max-h-40 overflow-y-auto">
                  {notificationZoneLandmarks.map((nearby, index) => {
                    const placeId = nearby.landmark.placeId;
                    const isInCardZone = cardZoneLandmarks.some(n => n.landmark.placeId === placeId);
                    const strategyInfo = getStrategyInfo(nearby.landmark, nearby.distance);
                    
                    return (
                      <div 
                        key={placeId} 
                        className="border border-orange-200 dark:border-orange-800 rounded p-2 space-y-1 bg-orange-100 dark:bg-orange-900/20 cursor-pointer hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors relative group"
                        onClick={() => handleLandmarkClick(nearby, notificationZoneLandmarks)}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-xs leading-tight text-orange-900 dark:text-orange-100">
                            {nearby.landmark.name}
                          </span>
                          <div className="flex gap-1 ml-2 flex-shrink-0">
                            <Badge variant="outline" className="text-xs border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200">
                              #{index + 1}
                            </Badge>
                            {isInCardZone && (
                              <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700 text-white">
                                <CreditCard className="w-2 h-2 mr-1" />
                                Card
                              </Badge>
                            )}
                            <Eye className="w-3 h-3 text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        
                        {/* Enhanced Multi-Viewpoint Indicators */}
                        <div className="flex justify-between items-center">
                          <span className="text-orange-700 dark:text-orange-300">Strategy:</span>
                          <div className="flex items-center gap-1">
                            <Badge className={`text-xs text-white ${getStrategyColor(strategyInfo.strategy)}`}>
                              {strategyInfo.strategy.toUpperCase()}
                            </Badge>
                            <Badge className="text-xs bg-cyan-600 text-white font-bold">
                              {strategyInfo.viewpointCount}v
                            </Badge>
                            {strategyInfo.loading && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                            {strategyInfo.cached && <Database className="w-3 h-3 text-green-500" />}
                            {strategyInfo.isUnavailable && <WifiOff className="w-3 h-3 text-red-500" />}
                          </div>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-orange-700 dark:text-orange-300">Distance:</span>
                          <span className="text-orange-800 dark:text-orange-200 font-medium">{formatDistance(nearby.distance)}</span>
                        </div>
                        
                        {strategyInfo.dataUsage && (
                          <div className="flex justify-between">
                            <span className="text-orange-700 dark:text-orange-300">Data Usage:</span>
                            <span className="text-blue-700 dark:text-blue-300 text-xs">{strategyInfo.dataUsage}</span>
                          </div>
                        )}
                        
                        <div className="text-orange-700 dark:text-orange-300 text-xs leading-tight">
                          {nearby.landmark.description.substring(0, 60)}
                          {nearby.landmark.description.length > 60 && '...'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {prepZoneLandmarks.length === 0 && notificationZoneLandmarks.length === 0 && cardZoneLandmarks.length === 0 && userLocation && proximitySettings && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Target className="w-3 h-3" />
                  <span className="font-semibold">No Nearby Landmarks</span>
                </div>
                <div className="pl-5 space-y-1 text-muted-foreground text-xs">
                  <div>No landmarks found within Street View prep zone ({formatDistance(proximitySettings?.outer_distance || 250)})</div>
                  <div>No landmarks found within notification zone ({formatDistance(proximitySettings?.notification_distance || 100)})</div>
                  <div>No landmarks found within card zone ({formatDistance(proximitySettings?.card_distance || 75)})</div>
                </div>
              </div>
            )}

            <div className="border-t pt-2 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Route className="w-3 h-3" />
                <span className="font-semibold text-xs">Zone Logic</span>
              </div>
              <div className="text-muted-foreground text-xs leading-tight">
                <div>• Tourist services cards show when landmarks enter card zone (closest)</div>
                <div>• Street View pre-loads when landmarks enter outer zone</div>
                <div>• Toast notifications trigger when landmarks enter notification zone</div>
                <div>• Card zone ⊆ Notification zone ⊆ Prep zone</div>
                <div>• Click landmark cards to open Street View modal</div>
                <div>• Strategy auto-adjusts: Single (&gt;1km) → Cardinal (500m-1km) → Smart (100m-500m) → All (&lt;100m)</div>
              </div>
            </div>

            <div className="border-t pt-2 text-muted-foreground text-xs">
              Press Ctrl+D to close this debug window
            </div>
          </TabsContent>

          <TabsContent value="api-tests" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <TestTube className="w-4 h-4" />
                <span className="font-semibold text-sm">API Testing Suite</span>
              </div>
              
              <PlacesApiTestPanel />
              
              <div className="mt-6">
                <NetworkTestingPanel />
              </div>

              <div className="mt-6 p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Camera className="w-4 h-4" />
                  <span className="font-semibold text-sm">Demo Assets Storage</span>
                </div>
                <DemoAssetsUtility />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Enhanced Street View Modal */}
      <EnhancedStreetViewModal
        isOpen={isModalOpen}
        onClose={closeStreetViewModal}
        streetViewItems={streetViewItems}
        initialIndex={0}
      />
    </>
  );
};

export default DebugWindow;
