
import React from 'react';
import StreetViewThumbnail from './StreetViewThumbnail';
import { Loader2, MapPin } from 'lucide-react';
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

interface ThumbnailData {
  landmark: any;
  streetViewData: StreetViewData | MultiViewpointData | null;
}

interface StreetViewThumbnailGridProps {
  thumbnails: ThumbnailData[];
  onThumbnailClick: (index: number) => void;
  selectedIndex?: number;
  className?: string;
  isLoading?: boolean;
  loadingStates?: { [key: number]: boolean };
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  maxItems?: number;
}

const StreetViewThumbnailGrid: React.FC<StreetViewThumbnailGridProps> = ({
  thumbnails,
  onThumbnailClick,
  selectedIndex,
  className = "",
  isLoading = false,
  loadingStates = {},
  size = 'md',
  showLabels = true,
  maxItems
}) => {
  const displayThumbnails = maxItems ? thumbnails.slice(0, maxItems) : thumbnails;
  const hasMore = maxItems && thumbnails.length > maxItems;

  if (isLoading && displayThumbnails.length === 0) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <div className="text-center text-white/70">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading Street Views...</p>
        </div>
      </div>
    );
  }

  if (displayThumbnails.length === 0) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <div className="text-center text-white/70">
          <MapPin className="w-6 h-6 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No Street Views available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3", className)}>
      {/* Thumbnails */}
      {displayThumbnails.map((thumbnail, index) => (
        <div key={`${thumbnail.landmark.id}-${index}`} className="relative">
          <StreetViewThumbnail
            landmark={thumbnail.landmark}
            streetViewData={thumbnail.streetViewData}
            onClick={() => onThumbnailClick(index)}
            isSelected={selectedIndex === index}
            size={size}
            showLabel={showLabels}
            className={cn(
              "transition-all duration-200",
              loadingStates[index] && "opacity-50"
            )}
          />
          
          {/* Individual loading state */}
          {loadingStates[index] && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      ))}

      {/* Show more indicator */}
      {hasMore && (
        <div className={cn(
          "flex items-center justify-center rounded-lg bg-white/10 text-white/70 border border-white/20",
          {
            'w-16 h-16': size === 'sm',
            'w-20 h-20': size === 'md',
            'w-24 h-24': size === 'lg'
          }
        )}>
          <div className="text-center">
            <div className="text-xs font-medium">
              +{thumbnails.length - maxItems!}
            </div>
            <div className="text-xs opacity-70">more</div>
          </div>
        </div>
      )}

      {/* Global loading indicator */}
      {isLoading && displayThumbnails.length > 0 && (
        <div className={cn(
          "flex items-center justify-center rounded-lg bg-white/10 text-white/70 border border-white/20",
          {
            'w-16 h-16': size === 'sm',
            'w-20 h-20': size === 'md',
            'w-24 h-24': size === 'lg'
          }
        )}>
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      )}
    </div>
  );
};

export default StreetViewThumbnailGrid;
