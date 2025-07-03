import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, RefreshCw, Activity, Timer, History } from 'lucide-react';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useTourPlanner } from '@/hooks/useTourPlanner';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';
import GracePeriodDebugPanel from '@/components/debug/GracePeriodDebugPanel';
import { useDebugWindow } from '@/hooks/useDebugWindow';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { networkSimulator, NETWORK_CONDITIONS, testStrategySelection, performanceTimer } from '@/utils/networkSimulator';
import { CacheTestUtils, performanceBenchmark } from '@/utils/streetViewTestUtils';
import { gracePeriodHistory, GracePeriodHistoryEntry } from '@/utils/gracePeriodHistory';
import { getGracePeriodPresetName, formatGracePeriodDebugInfo } from '@/utils/smartGracePeriod';

interface DebugWindowProps {
  isVisible: boolean;
  onClose: () => void;
}

const DebugWindow: React.FC<DebugWindowProps> = ({ isVisible, onClose }) => {
  const { proximityAlerts, proximitySettings, userLocation, connectionStatus, forceReconnect,
    isInGracePeriod, gracePeriodRemainingMs, gracePeriodReason
  } = useProximityAlerts();
  const { tourState, currentTour, startTour, stopTour, nextStep, previousStep, resetTour } = useTourPlanner();
  const { isConnected, isRealtimeConnected, lastRealtimeEvent, lastRealtimeError } = useConnectionMonitor();
  const { isOnline, effectiveType, downlink, connectionType } = useNetworkStatus();
  const [refreshKey, setRefreshKey] = useState(0);
  const [simulatedNetwork, setSimulatedNetwork] = useState<string | null>(null);
  const cacheTestUtils = CacheTestUtils.getInstance();

  const [gracePeriodMetrics, setGracePeriodMetrics] = useState(gracePeriodHistory.getMetrics());
  const [gracePeriodRecentHistory, setGracePeriodRecentHistory] = useState<GracePeriodHistoryEntry[]>([]);

  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [isVisible]);

  // Grace period data refresh
  useEffect(() => {
    if (!isVisible) return;
    
    const refreshGracePeriodData = () => {
      setGracePeriodMetrics(gracePeriodHistory.getMetrics());
      setGracePeriodRecentHistory(gracePeriodHistory.getRecentHistory(10));
    };
    
    refreshGracePeriodData();
    const interval = setInterval(refreshGracePeriodData, 2000);
    
    return () => clearInterval(interval);
  }, [isVisible]);

  const handleNetworkSimulation = (condition: string) => {
    if (simulatedNetwork === condition) {
      networkSimulator.restore();
      setSimulatedNetwork(null);
    } else {
      networkSimulator.simulate(condition as keyof typeof NETWORK_CONDITIONS);
      setSimulatedNetwork(condition);
    }
  };

  const testAllStrategies = () => {
    const distances = [50, 200, 750, 1500];
    console.log('🧪 Testing strategy selection for all distances:');
    
    distances.forEach(distance => {
      console.log(`\n📏 Distance: ${distance}m`);
      const results = testStrategySelection(distance);
      console.table(results);
    });
  };

  const clearAllCaches = () => {
    // This would need to be implemented in the actual hooks
    cacheTestUtils.reset();
    performanceBenchmark.clear();
    console.log('🗑️ All caches and metrics cleared');
  };

  const formatGracePeriodTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.toLocaleTimeString()} ${date.toLocaleDateString()}`;
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'activated': return 'text-green-400';
      case 'cleared': return 'text-red-400';
      case 'expired': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] bg-gray-900 text-white border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            Debug Console
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="overflow-auto max-h-[75vh]">
          <Tabs defaultValue="proximity" className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-gray-800">
              <TabsTrigger value="proximity">Proximity</TabsTrigger>
              <TabsTrigger value="tours">Tours</TabsTrigger>
              <TabsTrigger value="connection">Connection</TabsTrigger>
              <TabsTrigger value="grace-period">Grace Period</TabsTrigger>
              <TabsTrigger value="system">System</TabsTrigger>
            </TabsList>

            <TabsContent value="proximity" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">User Location</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userLocation ? (
                      <div className="space-y-1">
                        <p className="text-gray-400 text-xs">
                          Latitude: {userLocation.latitude}
                        </p>
                        <p className="text-gray-400 text-xs">
                          Longitude: {userLocation.longitude}
                        </p>
                        <p className="text-gray-400 text-xs">
                          Accuracy: {userLocation.accuracy}
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">
                        No location data available.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Proximity Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {proximitySettings ? (
                      <div className="space-y-1">
                        <p className="text-gray-400 text-xs">
                          Enabled: {proximitySettings.is_enabled ? 'Yes' : 'No'}
                        </p>
                        <p className="text-gray-400 text-xs">
                          Notification Distance:{' '}
                          {proximitySettings.notification_distance}m
                        </p>
                        <p className="text-gray-400 text-xs">
                          Outer Distance: {proximitySettings.outer_distance}m
                        </p>
                        <p className="text-gray-400 text-xs">
                          Card Distance: {proximitySettings.card_distance}m
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">
                        No proximity settings available.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Proximity Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  {proximityAlerts.length > 0 ? (
                    <ul className="space-y-2">
                      {proximityAlerts.map((alert) => (
                        <li
                          key={alert.id}
                          className="text-gray-400 text-xs border-b border-gray-700 pb-2"
                        >
                          {alert.landmark_id} - {alert.distance}m{' '}
                          {alert.is_enabled ? '(Enabled)' : '(Disabled)'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      No proximity alerts available.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tours" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Tour State</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-gray-400 text-xs">
                      Is Active: {tourState.isActive ? 'Yes' : 'No'}
                    </p>
                    <p className="text-gray-400 text-xs">
                      Current Step: {tourState.currentStepIndex}
                    </p>
                    <p className="text-gray-400 text-xs">
                      Total Steps: {tourState.totalSteps}
                    </p>
                    {currentTour && (
                      <div className="mt-2">
                        <h4 className="text-sm font-semibold">Current Tour</h4>
                        <p className="text-gray-400 text-xs">
                          Name: {currentTour.name}
                        </p>
                        <p className="text-gray-400 text-xs">
                          Description: {currentTour.description}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-around mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startTour}
                  disabled={tourState.isActive}
                >
                  Start Tour
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopTour}
                  disabled={!tourState.isActive}
                >
                  Stop Tour
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextStep}
                  disabled={!tourState.isActive}
                >
                  Next Step
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={previousStep}
                  disabled={!tourState.isActive}
                >
                  Previous Step
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={resetTour}
                  disabled={!tourState.isActive}
                >
                  Reset Tour
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="connection" className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Connection Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-gray-400 text-xs">
                      Connected: {isConnected ? 'Yes' : 'No'}
                    </p>
                    <p className="text-gray-400 text-xs">
                      Realtime Connected: {isRealtimeConnected ? 'Yes' : 'No'}
                    </p>
                    <p className="text-gray-400 text-xs">
                      Last Realtime Event: {lastRealtimeEvent}
                    </p>
                    <p className="text-gray-400 text-xs">
                      Last Realtime Error: {lastRealtimeError}
                    </p>
                    <p className="text-gray-400 text-xs">
                      Consecutive Failures: {connectionStatus.consecutiveFailures}
                    </p>
                    <p className="text-gray-400 text-xs">
                      Status: {connectionStatus.status}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Button variant="outline" size="sm" onClick={forceReconnect}>
                Force Reconnect
              </Button>
            </TabsContent>

            <TabsContent value="grace-period" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Current State */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Timer className="h-4 w-4" />
                      Current State
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Status:</span>
                      <Badge variant={isInGracePeriod ? "default" : "secondary"}>
                        {isInGracePeriod ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    
                    {isInGracePeriod && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-400">Reason:</span>
                          <span className="text-sm">{gracePeriodReason}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-400">Remaining:</span>
                          <span className="text-sm font-mono">
                            {Math.round(gracePeriodRemainingMs / 1000)}s
                          </span>
                        </div>
                      </>
                    )}
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">Preset:</span>
                      <span className="text-sm">{getGracePeriodPresetName(proximitySettings)}</span>
                    </div>
                    
                    {proximitySettings && (
                      <div className="text-xs text-gray-500 font-mono mt-2 p-2 bg-gray-900 rounded">
                        Init: {proximitySettings.grace_period_initialization}ms<br/>
                        Move: {proximitySettings.grace_period_movement}ms<br/>
                        Resume: {proximitySettings.grace_period_app_resume}ms<br/>
                        Threshold: {proximitySettings.significant_movement_threshold}m
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Metrics */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Performance Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-center p-2 bg-gray-900 rounded">
                        <div className="text-lg font-bold text-green-400">
                          {gracePeriodMetrics.totalActivations}
                        </div>
                        <div className="text-xs text-gray-400">Activations</div>
                      </div>
                      
                      <div className="text-center p-2 bg-gray-900 rounded">
                        <div className="text-lg font-bold text-blue-400">
                          {gracePeriodMetrics.effectivenessRate.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-400">Effectiveness</div>
                      </div>
                      
                      <div className="text-center p-2 bg-gray-900 rounded">
                        <div className="text-lg font-bold text-yellow-400">
                          {gracePeriodMetrics.totalExpired}
                        </div>
                        <div className="text-xs text-gray-400">Expired</div>
                      </div>
                      
                      <div className="text-center p-2 bg-gray-900 rounded">
                        <div className="text-lg font-bold text-red-400">
                          {gracePeriodMetrics.totalClears}
                        </div>
                        <div className="text-xs text-gray-400">Cleared</div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-400 mt-2">
                      Avg Duration: {(gracePeriodMetrics.averageDuration / 1000).toFixed(1)}s
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent History */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Recent Activity
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setGracePeriodMetrics(gracePeriodHistory.getMetrics());
                        setGracePeriodRecentHistory(gracePeriodHistory.getRecentHistory(10));
                      }}
                      className="ml-auto h-6 w-6 p-0"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {gracePeriodRecentHistory.length === 0 ? (
                      <div className="text-sm text-gray-500 text-center py-4">
                        No grace period activity recorded
                      </div>
                    ) : (
                      gracePeriodRecentHistory.map((entry, index) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between text-xs p-2 bg-gray-900/50 rounded hover:bg-gray-900"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              entry.action === 'activated' ? 'bg-green-400' :
                              entry.action === 'cleared' ? 'bg-red-400' : 'bg-yellow-400'
                            }`} />
                            <span className={getActionColor(entry.action)}>
                              {entry.action}
                            </span>
                            {entry.reason && (
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                {entry.reason}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs px-1 py-0">
                              {entry.trigger}
                            </Badge>
                          </div>
                          <span className="text-gray-500">
                            {formatGracePeriodTimestamp(entry.timestamp)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const analysis = gracePeriodHistory.analyzePerformance();
                        console.log('📊 Grace Period Performance Analysis:', analysis);
                      }}
                      className="text-xs"
                    >
                      Analyze Performance
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const exported = gracePeriodHistory.exportHistory();
                        console.log('📤 Grace Period History Export:', exported);
                      }}
                      className="text-xs"
                    >
                      Export History
                    </Button>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        gracePeriodHistory.clearHistory();
                        setGracePeriodMetrics(gracePeriodHistory.getMetrics());
                        setGracePeriodRecentHistory([]);
                      }}
                      className="text-xs"
                    >
                      Clear History
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="system" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Network Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-gray-400 text-xs">
                        Online: {isOnline ? 'Yes' : 'No'}
                      </p>
                      <p className="text-gray-400 text-xs">
                        Effective Type: {effectiveType || 'Unknown'}
                      </p>
                      <p className="text-gray-400 text-xs">
                        Downlink Speed: {downlink} Mbps
                      </p>
                      {simulatedNetwork && (
                        <p className="text-gray-400 text-xs">
                          Simulated Network: {simulatedNetwork}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cache Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-gray-400 text-xs">
                        Hit Rate: {(cacheTestUtils.getMetrics().hitRate * 100).toFixed(1)}%
                      </p>
                      <p className="text-gray-400 text-xs">
                        Total Operations: {cacheTestUtils.getMetrics().totalOperations}
                      </p>
                      <p className="text-gray-400 text-xs">
                        Total Size: {(cacheTestUtils.getMetrics().totalSize / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-around mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testAllStrategies}
                >
                  Test All Strategies
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cacheTestUtils.logSummary()}
                >
                  Log Cache Summary
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={clearAllCaches}
                >
                  Clear All Caches
                </Button>
              </div>

              <div className="space-y-1 mt-4">
                <span className="text-xs text-white/70">Network Simulation:</span>
                <div className="grid grid-cols-3 gap-1">
                  {Object.keys(NETWORK_CONDITIONS).map(condition => (
                    <Button
                      key={condition}
                      variant={simulatedNetwork === condition ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleNetworkSimulation(condition)}
                      className="text-xs h-7"
                    >
                      {condition}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugWindow;
