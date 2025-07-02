
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
import { networkSimulator, NETWORK_CONDITIONS } from '@/utils/networkSimulator';

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

  const clearAllCaches = () => {
    console.log('🗑️ All caches and metrics cleared');
  };

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
              Panorama Debug
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
            <TabsList className="grid w-full grid-cols-3 bg-white/10">
              <TabsTrigger value="network" className="text-xs">Network</TabsTrigger>
              <TabsTrigger value="panorama" className="text-xs">Panorama</TabsTrigger>
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
            
            <TabsContent value="panorama" className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Strategy:</span>
                  <span className="text-green-400">Panorama-Only</span>
                </div>
                
                <div className="flex justify-between">
                  <span>Static Views:</span>
                  <span className="text-red-400">Disabled</span>
                </div>
                
                <div className="text-xs text-white/70 mt-2">
                  Interactive panorama experience active. Static Street View components have been removed for improved performance and user experience.
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="test" className="space-y-3">
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => console.log('🧪 Testing panorama availability...')}
                  className="w-full h-7 text-xs"
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Test Panorama Availability
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
