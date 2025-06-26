
import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Layers, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

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

interface StreetViewThumbnailProps {
  landmark: any;
  streetViewData: StreetViewData | MultiViewpointData | null;
  onClick: () => void;
  isSelected?: boolean;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const isMultiViewpointData = (data: any): data is MultiViewpointData => {
  return data && 'primary' in data && 'viewpoints' in data && 'metadata' in data;
};

const StreetViewThumbnail: React.FC<StreetViewThumbnailProps> = ({
  landmark,
  streetViewData,
  onClick,
  isSelected = false,
  className = "",
  showLabel = true,
  size = 'md'
}) => {
  const { isOnline } = useNetworkStatus();

  if (!streetViewData) {
    return (
      <div className={cn(
        "relative rounded-lg bg-gray-100 flex items-center justify-center text-gray-400",
        {
          'w-16 h-16': size === 'sm',
          'w-20 h-20': size === 'md',
          'w-24 h-24': size === 'lg'
        },
        className
      )}>
        <div className="text-center">
          <Eye className="w-4 h-4 mx-auto mb-1 opacity-50" />
          {showLabel && (
            <p className="text-xs truncate px-1">No View</p>
          )}
        </div>
      </div>
    );
  }

  const isMultiViewpoint = isMultiViewpointData(streetViewData);
  const displayData = isMultiViewpoint ? streetViewData.primary : streetViewData;
  const viewpointCount = isMultiViewpoint ? streetViewData.viewpoints.length : 1;
  
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-24 h-24'
  };

  return (
    <div className={cn("relative group", className)}>
      <Button
        variant="ghost"
        className={cn(
          "p-1 h-auto w-auto rounded-lg overflow-hidden transition-all duration-200",
          "hover:scale-105 hover:shadow-lg",
          isSelected && "ring-2 ring-blue-500 scale-105 shadow-lg"
        )}
        onClick={onClick}
      >
        <div className={cn(
          "relative rounded-md overflow-hidden bg-gray-100",
          sizeClasses[size]
        )}>
          {/* Street View Image */}
          <img
            src={displayData.imageUrl}
            alt={`Street View of ${landmark.name}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          
          {/* Multi-viewpoint indicator */}
          {isMultiViewpoint && (
            <div className="absolute top-1 right-1">
              <Badge
                variant="secondary"
                className="text-xs px-1 py-0 h-5 bg-black/60 text-white border-0"
              >
                <Layers className="w-3 h-3 mr-1" />
                {viewpointCount}
              </Badge>
            </div>
          )}

          {/* Connection status */}
          <div className="absolute bottom-1 right-1">
            {isOnline ? (
              <Wifi className="w-3 h-3 text-green-400 drop-shadow-sm" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-400 drop-shadow-sm" />
            )}
          </div>

          {/* Loading overlay for selected state */}
          {isSelected && (
            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </Button>

      {/* Label */}
      {showLabel && (
        <div className="mt-1 text-center">
          <p className={cn(
            "text-white text-xs font-medium truncate drop-shadow-sm",
            {
              'max-w-[64px]': size === 'sm',
              'max-w-[80px]': size === 'md',
              'max-w-[96px]': size === 'lg'
            }
          )}>
            {landmark.name}
          </p>
          {isMultiViewpoint && (
            <p className="text-white/70 text-xs drop-shadow-sm">
              {viewpointCount} views • {streetViewData.metadata.dataUsage}
            </p>
          )}
        </div>
      )}

      {/* Enhanced tooltip on hover */}
      <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
        {landmark.name}
        {isMultiViewpoint && ` • ${viewpointCount} viewpoints`}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black/80" />
      </div>
    </div>
  );
};

export default StreetViewThumbnail;
