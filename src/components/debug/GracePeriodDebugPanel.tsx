import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Timer, 
  Play, 
  Pause, 
  RotateCcw, 
  Activity,
  History,
  Settings,
  TrendingUp,
  MapPin,
  Zap
} from 'lucide-react';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { 
  getGracePeriodPresetName, 
  getAvailablePresets, 
  applyGracePeriodPreset,
  GRACE_PERIOD_PRESETS,
  logGracePeriodEvent
} from '@/utils/smartGracePeriod';
import { GracePeriodState } from '@/types/proximityAlerts';

interface GracePeriodDebugPanelProps {
  isVisible: boolean;
  onToggle: () => void;
  className?: string;
}

const GracePeriodDebugPanel: React.FC<GracePeriodDebugPanelProps> = ({
  isVisible,
  onToggle,
  className = ""
}) => {
  const {
    proximitySettings,
    isInGracePeriod,
    gracePeriodRemainingMs,
    gracePeriodReason,
    gracePeriodState,
    setGracePeriod,
    clearGracePeriod,
  } = useProximityAlerts();

  const [refreshKey, setRefreshKey] = useState(0);
  const [history, setHistory] = useState<Array<{
    timestamp: number;
    action: 'activated' | 'cleared' | 'expired';
    reason?: GracePeriodState['gracePeriodReason'];
    duration?: number;
  }>>([]);

  // Auto-refresh state
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isVisible]);

  // Track grace period state changes for history
  useEffect(() => {
    const handleGracePeriodChange = () => {
      const now = Date.now();
      if (isInGracePeriod && gracePeriodReason) {
        setHistory(prev => [...prev.slice(-9), {
          timestamp: now,
          action: 'activated',
          reason: gracePeriodReason
        }]);
      } else if (!isInGracePeriod && history.length > 0 && history[history.length - 1]?.action === 'activated') {
        setHistory(prev => [...prev.slice(-9), {
          timestamp: now,
          action: 'expired'
        }]);
      }
    };

    handleGracePeriodChange();
  }, [isInGracePeriod, gracePeriodReason]);

  const handleManualGracePeriod = (reason: GracePeriodState['gracePeriodReason']) => {
    if (isInGracePeriod) {
      clearGracePeriod();
      setHistory(prev => [...prev.slice(-9), {
        timestamp: Date.now(),
        action: 'cleared'
      }]);
    } else {
      setGracePeriod(reason);
      logGracePeriodEvent(`Manual grace period activated (${reason})`, {
        trigger: 'debug-panel'
      }, 'info', proximitySettings);
    }
  };

  const handlePresetChange = async (presetName: keyof typeof GRACE_PERIOD_PRESETS) => {
    if (!proximitySettings) return;
    
    const updatedSettings = applyGracePeriodPreset(presetName, proximitySettings);
    console.log('🔧 Debug: Applying preset', presetName, updatedSettings);
    // Note: In a real implementation, this would call an update function
    // For debug purposes, we're just logging
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${Math.round(ms / 1000)}s`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getGracePeriodProgress = () => {
    if (!isInGracePeriod || !proximitySettings) return 0;
    
    const totalDuration = gracePeriodReason === 'initialization' 
      ? proximitySettings.grace_period_initialization
      : gracePeriodReason === 'movement'
      ? proximitySettings.grace_period_movement
      : proximitySettings.grace_period_app_resume;
    
    const elapsed = totalDuration - gracePeriodRemainingMs;
    return (elapsed / totalDuration) * 100;
  };

  const currentPreset = getGracePeriodPresetName(proximitySettings);
  const availablePresets = getAvailablePresets();

  // Format debug info as string instead of object
  const gracePeriodDebugInfo = gracePeriodState ? JSON.stringify({
    active: isInGracePeriod,
    reason: gracePeriodReason,
    remaining: gracePeriodRemainingMs,
    preset: currentPreset
  }, null, 2) : 'No debug info available';

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className={`fixed bottom-16 right-4 z-50 ${className}`}
        title="Show Grace Period Debug"
      >
        <Timer className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className={`fixed bottom-16 right-4 z-50 w-96 max-h-96 overflow-hidden ${className}`}>
      <Card className="bg-black/90 backdrop-blur-sm text-white border-white/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Grace Period Debug
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="text-white hover:bg-white/20"
            >
              ×
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Tabs defaultValue="state" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-white/10">
              <TabsTrigger value="state" className="text-xs">State</TabsTrigger>
              <TabsTrigger value="controls" className="text-xs">Controls</TabsTrigger>
              <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
              <TabsTrigger value="metrics" className="text-xs">Metrics</TabsTrigger>
            </TabsList>
            
            <TabsContent value="state" className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Status:</span>
                  <Badge variant={isInGracePeriod ? "default" : "secondary"}>
                    {isInGracePeriod ? "Active" : "Inactive"}
                  </Badge>
                </div>
                
                {isInGracePeriod && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Reason:</span>
                      <Badge variant="outline">{gracePeriodReason}</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Remaining:</span>
                      <span className="text-sm font-mono">
                        {formatDuration(gracePeriodRemainingMs)}
                      </span>
                    </div>
                    
                    <Progress 
                      value={getGracePeriodProgress()} 
                      className="h-2"
                    />
                  </>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Preset:</span>
                  <Badge variant="secondary">{currentPreset}</Badge>
                </div>
                
                <div className="text-xs text-white/70 font-mono">
                  <pre>{gracePeriodDebugInfo}</pre>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="controls" className="space-y-3">
              <div className="space-y-2">
                <span className="text-sm text-white/70">Manual Triggers:</span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={isInGracePeriod && gracePeriodReason === 'initialization' ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleManualGracePeriod('initialization')}
                    className="text-xs h-8"
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Init
                  </Button>
                  
                  <Button
                    variant={isInGracePeriod && gracePeriodReason === 'movement' ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleManualGracePeriod('movement')}
                    className="text-xs h-8"
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    Move
                  </Button>
                  
                  <Button
                    variant={isInGracePeriod && gracePeriodReason === 'app_resume' ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleManualGracePeriod('app_resume')}
                    className="text-xs h-8"
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Resume
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      clearGracePeriod();
                      setHistory(prev => [...prev.slice(-9), {
                        timestamp: Date.now(),
                        action: 'cleared'
                      }]);
                    }}
                    className="text-xs h-8"
                    disabled={!isInGracePeriod}
                  >
                    <Pause className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <span className="text-sm text-white/70">Quick Presets:</span>
                <div className="grid grid-cols-2 gap-1">
                  {availablePresets.slice(0, 4).map(preset => (
                    <Button
                      key={preset.key}
                      variant={currentPreset === preset.key ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePresetChange(preset.key)}
                      className="text-xs h-7"
                      title={preset.description}
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="history" className="space-y-3">
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {history.length === 0 ? (
                  <div className="text-xs text-white/50 text-center py-2">
                    No grace period activity yet
                  </div>
                ) : (
                  history.slice().reverse().map((entry, index) => (
                    <div key={index} className="flex items-center justify-between text-xs p-1 bg-white/5 rounded">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          entry.action === 'activated' ? 'bg-green-400' :
                          entry.action === 'cleared' ? 'bg-red-400' : 'bg-yellow-400'
                        }`} />
                        <span>{entry.action}</span>
                        {entry.reason && (
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            {entry.reason}
                          </Badge>
                        )}
                      </div>
                      <span className="text-white/70">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistory([])}
                className="w-full h-7 text-xs"
                disabled={history.length === 0}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Clear History
              </Button>
            </TabsContent>
            
            <TabsContent value="metrics" className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Activations:</span>
                  <span>{history.filter(h => h.action === 'activated').length}</span>
                </div>
                
                <div className="flex justify-between">
                  <span>Manual Clears:</span>
                  <span>{history.filter(h => h.action === 'cleared').length}</span>
                </div>
                
                <div className="flex justify-between">
                  <span>Natural Expires:</span>
                  <span>{history.filter(h => h.action === 'expired').length}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {['initialization', 'movement', 'app_resume'].map(reason => {
                  const count = history.filter(h => h.reason === reason).length;
                  return (
                    <div key={reason} className="text-center p-2 bg-white/10 rounded">
                      <div className="text-lg font-bold text-blue-400">{count}</div>
                      <div className="text-xs capitalize">{reason.replace('_', ' ')}</div>
                    </div>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => console.log('Grace Period Performance Report:', {
                  history,
                  currentState: gracePeriodState,
                  settings: proximitySettings,
                  preset: currentPreset
                })}
                className="w-full h-7 text-xs"
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                Log Performance Report
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default GracePeriodDebugPanel;
