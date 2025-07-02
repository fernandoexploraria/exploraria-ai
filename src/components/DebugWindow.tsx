
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Activity, Database } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface DebugWindowProps {
  isVisible: boolean;
  onClose: () => void;
}

const DebugWindow: React.FC<DebugWindowProps> = ({ isVisible, onClose }) => {
  const { isOnline, effectiveType, downlink } = useNetworkStatus();

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-96 max-h-96 overflow-auto">
      <Card className="bg-black/90 backdrop-blur-sm text-white border-white/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Debug Information
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Database className="h-4 w-4" />
              Network Status
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Connection:</span>
                <Badge variant={isOnline ? "default" : "destructive"}>
                  {isOnline ? "Online" : "Offline"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Type:</span>
                <span>{effectiveType || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span>Speed:</span>
                <span>{downlink ? `${downlink} Mbps` : 'Unknown'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Street View Status</h3>
            <div className="text-sm text-green-400">
              ✅ Panorama-only strategy active
            </div>
            <div className="text-xs text-white/70">
              Static Street View components removed
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugWindow;
