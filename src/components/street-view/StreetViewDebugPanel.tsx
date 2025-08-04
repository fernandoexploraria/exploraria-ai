
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Database, 
  Network, 
  Timer, 
  Settings,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { networkSimulator, NETWORK_CONDITIONS, testStrategySelection, performanceTimer } from '@/utils/networkSimulator';
import { useDemoMode } from '@/hooks/useDemoMode';
import { CacheTestUtils, performanceBenchmark } from '@/utils/streetViewTestUtils';

interface StreetViewDebugPanelProps {
  isVisible: boolean;
  onToggle: () => void;
  className?: string;
}

const StreetViewDebugPanel: React.FC<StreetViewDebugPanelProps> = ({
  isVisible,
  onToggle,
  className = ""
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [simulatedNetwork, setSimulatedNetwork] = useState<string | null>(null);
  const { isOnline, effectiveType, downlink, connectionType } = useNetworkStatus();
  const { isDemoMode } = useDemoMode();
  const cacheTestUtils = CacheTestUtils.getInstance();

  // Auto-refresh debug data
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 2000);
    
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

  
  // Only show when demo mode is enabled
  if (!isDemoMode) {
    return null;
  }

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className={`fixed bottom-4 right-4 z-50 ${className}`}
        title="Show Debug Panel"
      >
        <Eye className="h-4 w-4" />
      </Button>
    );
  }

  const cacheMetrics = cacheTestUtils.getMetrics();
  const networkStats = {
    isOnline,
    effectiveType,
    downlink,
    connectionType,
    simulated: simulatedNetwork
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 w-96 max-h-96 overflow-hidden ${className}`}>
      <Card className="bg-black/90 backdrop-blur-sm text-white border-white/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Street View Debug
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="text-white hover:bg-white/20"
              title="Hide Debug Panel"
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Tabs defaultValue="network" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-white/10">
              <TabsTrigger value="network" className="text-xs">Network</TabsTrigger>
              <TabsTrigger value="cache" className="text-xs">Cache</TabsTrigger>
              <TabsTrigger value="perf" className="text-xs">Performance</TabsTrigger>
              <TabsTrigger value="test" className="text-xs">Test</TabsTrigger>
            </TabsList>
            
            <TabsContent value="network" className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Status:</span>
                  <Badge variant={isOnline ? "default" : "destructive"}>
                    {isOnline ? "Online" : "Offline"}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Type:</span>
                  <Badge variant="outline">{effectiveType || connectionType}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Speed:</span>
                  <span className="text-sm">{downlink} Mbps</span>
                </div>
                
                {simulatedNetwork && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Simulated:</span>
                    <Badge variant="secondary">{simulatedNetwork}</Badge>
                  </div>
                )}
              </div>
              
              <div className="space-y-1">
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
            
            <TabsContent value="cache" className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Hit Rate:</span>
                  <span>{(cacheMetrics.hitRate * 100).toFixed(1)}%</span>
                </div>
                
                <div className="flex justify-between">
                  <span>Total Ops:</span>
                  <span>{cacheMetrics.totalOperations}</span>
                </div>
                
                <div className="flex justify-between">
                  <span>Size:</span>
                  <span>{(cacheMetrics.totalSize / 1024).toFixed(1)} KB</span>
                </div>
                
                <Progress 
                  value={cacheMetrics.hitRate * 100} 
                  className="h-2"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 bg-white/10 rounded">
                  <div className="text-lg font-bold text-green-400">{cacheMetrics.hits}</div>
                  <div className="text-xs">Hits</div>
                </div>
                <div className="text-center p-2 bg-white/10 rounded">
                  <div className="text-lg font-bold text-red-400">{cacheMetrics.misses}</div>
                  <div className="text-xs">Misses</div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="perf" className="space-y-3">
              <div className="space-y-2">
                <div className="text-sm">
                  <div className="flex justify-between mb-1">
                    <span>API Calls:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => performanceBenchmark.logSummary('API')}
                      className="h-6 px-2 text-xs"
                    >
                      Log Stats
                    </Button>
                  </div>
                  
                  <div className="flex justify-between mb-1">
                    <span>Loading:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => performanceBenchmark.logSummary('Loading')}
                      className="h-6 px-2 text-xs"
                    >
                      Log Stats
                    </Button>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => performanceBenchmark.logSummary()}
                  className="w-full h-7 text-xs"
                >
                  <Timer className="h-3 w-3 mr-1" />
                  Full Performance Report
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="test" className="space-y-3">
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testAllStrategies}
                  className="w-full h-7 text-xs"
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Test All Strategies
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cacheTestUtils.logSummary()}
                  className="w-full h-7 text-xs"
                >
                  <Database className="h-3 w-3 mr-1" />
                  Log Cache Summary
                </Button>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={clearAllCaches}
                  className="w-full h-7 text-xs"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear All Caches
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default StreetViewDebugPanel;
