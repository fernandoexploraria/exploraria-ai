
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info, Wifi, WifiOff, Gauge, Image, RotateCw, X } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { cn } from '@/lib/utils';

interface StreetViewData {
  imageUrl: string;
  heading: number;
  pitch: number;
  fov: number;
  location: {
    lat: number;
    lng: number;
  };
  landmarkName: string;
  metadata: {
    status: string;
    copyright?: string;
  };
}

interface MultiViewpointData {
  primary: StreetViewData;
  viewpoints: StreetViewData[];
  metadata: {
    totalViews: number;
    recommendedView: number;
    dataUsage: string;
  };
}

interface StreetViewMetadataPanelProps {
  streetViewData: StreetViewData | MultiViewpointData;
  currentViewpoint: number;
  isVisible: boolean;
  onToggle: () => void;
  loadingState?: {
    isLoading: boolean;
    progress: number;
  };
  className?: string;
}

const isMultiViewpointData = (data: any): data is MultiViewpointData => {
  return data && 'primary' in data && 'viewpoints' in data && 'metadata' in data;
};

const StreetViewMetadataPanel: React.FC<StreetViewMetadataPanelProps> = ({
  streetViewData,
  currentViewpoint,
  isVisible,
  onToggle,
  loadingState,
  className = ""
}) => {
  const { isOnline, isSlowConnection, connectionType, effectiveType, downlink } = useNetworkStatus();

  const isMultiViewpoint = isMultiViewpointData(streetViewData);
  const currentStreetView = isMultiViewpoint 
    ? streetViewData.viewpoints[currentViewpoint]
    : streetViewData;

  const getNetworkQualityColor = () => {
    if (!isOnline) return 'text-red-500';
    if (isSlowConnection) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getNetworkQualityText = () => {
    if (!isOnline) return 'Offline';
    if (effectiveType === '4g') return 'Excellent';
    if (effectiveType === '3g') return 'Good';
    if (effectiveType === '2g') return 'Slow';
    return 'Unknown';
  };

  if (!isVisible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="fixed top-20 right-4 z-30 bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
        title="Show metadata"
      >
        <Info className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <div className={cn(
      "fixed top-20 right-4 z-30 bg-black/80 backdrop-blur-sm text-white rounded-lg p-4 min-w-64 max-w-80",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4" />
          <span className="font-medium text-sm">Street View Info</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-6 w-6 p-0 text-white hover:bg-white/20"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* Loading State */}
      {loadingState?.isLoading && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-xs">Loading viewpoints...</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-1">
            <div 
              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${loadingState.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Viewpoint Information */}
      <div className="space-y-3">
        {/* Multi-viewpoint Info */}
        {isMultiViewpoint && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RotateCw className="w-3 h-3" />
              <span className="text-xs font-medium">Multi-Viewpoint</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-white/70">Total Views:</span>
                <div className="font-medium">{streetViewData.metadata.totalViews}</div>
              </div>
              <div>
                <span className="text-white/70">Current:</span>
                <div className="font-medium">{currentViewpoint + 1} of {streetViewData.metadata.totalViews}</div>
              </div>
              <div className="col-span-2">
                <span className="text-white/70">Data Usage:</span>
                <div className="font-medium">{streetViewData.metadata.dataUsage}</div>
              </div>
            </div>
          </div>
        )}

        {/* Current Viewpoint Details */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Image className="w-3 h-3" />
            <span className="text-xs font-medium">Current View</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-white/70">Heading:</span>
              <div className="font-medium">{currentStreetView.heading}°</div>
            </div>
            <div>
              <span className="text-white/70">Pitch:</span>
              <div className="font-medium">{currentStreetView.pitch}°</div>
            </div>
            <div>
              <span className="text-white/70">FOV:</span>
              <div className="font-medium">{currentStreetView.fov}°</div>
            </div>
            <div>
              <span className="text-white/70">Status:</span>
              <Badge variant="outline" className="text-xs border-green-500 text-green-400">
                {currentStreetView.metadata.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Location Information */}
        <div>
          <div className="text-xs text-white/70 mb-1">Location:</div>
          <div className="text-xs font-mono">
            {currentStreetView.location.lat.toFixed(6)}, {currentStreetView.location.lng.toFixed(6)}
          </div>
        </div>

        {/* Network Status */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span className="text-xs font-medium">Network Status</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-white/70">Quality:</span>
              <div className={cn("font-medium", getNetworkQualityColor())}>
                {getNetworkQualityText()}
              </div>
            </div>
            <div>
              <span className="text-white/70">Type:</span>
              <div className="font-medium">{effectiveType || 'Unknown'}</div>
            </div>
            {downlink > 0 && (
              <>
                <div>
                  <span className="text-white/70">Speed:</span>
                  <div className="font-medium">{downlink.toFixed(1)} Mbps</div>
                </div>
                <div>
                  <span className="text-white/70">Connection:</span>
                  <div className="font-medium capitalize">{connectionType}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Attribution */}
        {currentStreetView.metadata.copyright && (
          <div>
            <div className="text-xs text-white/70 mb-1">Attribution:</div>
            <div className="text-xs text-white/90 bg-white/10 rounded p-1">
              {currentStreetView.metadata.copyright}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreetViewMetadataPanel;
