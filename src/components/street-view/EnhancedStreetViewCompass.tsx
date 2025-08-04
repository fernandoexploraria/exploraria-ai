
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Navigation, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDemoMode } from '@/hooks/useDemoMode';

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

interface EnhancedStreetViewCompassProps {
  viewpoints: StreetViewData[];
  currentViewpoint: number;
  onViewpointChange: (index: number) => void;
  strategy?: string;
  loadingViewpoints?: Set<number>;
  className?: string;
}

const getCompassDirection = (heading: number): string => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(heading / 45) % 8;
  return directions[index];
};

const getStrategyColor = (strategy?: string) => {
  switch (strategy) {
    case 'single': return 'border-blue-500';
    case 'cardinal': return 'border-green-500';
    case 'smart': return 'border-purple-500';
    case 'all': return 'border-orange-500';
    default: return 'border-white/30';
  }
};

const EnhancedStreetViewCompass: React.FC<EnhancedStreetViewCompassProps> = ({
  viewpoints,
  currentViewpoint,
  onViewpointChange,
  strategy = 'single',
  loadingViewpoints = new Set(),
  className = ""
}) => {
  const [showPreviews, setShowPreviews] = useState(false);
  const { isDemoMode } = useDemoMode();

  if (viewpoints.length <= 1) return null;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Strategy Indicator - only show in demo mode */}
      {isDemoMode && (
        <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-white text-xs">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", getStrategyColor(strategy))} />
            <span className="capitalize">{strategy} Strategy</span>
            <span className="text-white/70">({viewpoints.length} views)</span>
          </div>
        </div>
      )}

      {/* Main Compass */}
      <div className="relative">
        {/* Compass Background */}
        <div className={cn(
          "w-24 h-24 rounded-full border-2 bg-black/20 backdrop-blur-sm flex items-center justify-center transition-colors duration-200",
          getStrategyColor(strategy)
        )}>
          <Navigation className="w-6 h-6 text-white/60" />
        </div>
        
        {/* Viewpoint Indicators */}
        {viewpoints.map((viewpoint, index) => {
          const angle = (viewpoint.heading - 90) * (Math.PI / 180);
          const radius = 42;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          
          const isActive = index === currentViewpoint;
          const isLoading = loadingViewpoints.has(index);
          
          return (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              className={cn(
                "absolute w-7 h-7 p-0 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200",
                {
                  'bg-blue-500 text-white scale-125 shadow-lg': isActive,
                  'bg-white/20 text-white hover:bg-white/30 hover:scale-110': !isActive,
                  'animate-pulse': isLoading
                }
              )}
              style={{
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
              }}
              onClick={() => onViewpointChange(index)}
              disabled={isLoading}
              title={`${getCompassDirection(viewpoint.heading)} (${viewpoint.heading}°)${isLoading ? ' - Loading...' : ''}`}
            >
              {isLoading ? (
                <div className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="text-xs font-medium">
                  {getCompassDirection(viewpoint.heading)}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {/* Current Heading Display */}
      <div className="bg-black/60 backdrop-blur-sm rounded px-3 py-1 text-white text-sm">
        <div className="flex items-center gap-2">
          <Navigation className="w-3 h-3" style={{ transform: `rotate(${viewpoints[currentViewpoint]?.heading || 0}deg)` }} />
          <span>
            {viewpoints[currentViewpoint]?.heading}° {getCompassDirection(viewpoints[currentViewpoint]?.heading)}
          </span>
        </div>
      </div>

      {/* Preview Toggle */}
      {viewpoints.length > 2 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPreviews(!showPreviews)}
          className="bg-black/50 hover:bg-black/70 text-white text-xs px-2 py-1 h-auto"
        >
          <Eye className="w-3 h-3 mr-1" />
          {showPreviews ? 'Hide' : 'Show'} Previews
        </Button>
      )}

      {/* Viewpoint Previews */}
      {showPreviews && viewpoints.length > 2 && (
        <div className="flex gap-2 bg-black/60 backdrop-blur-sm rounded-lg p-2">
          {viewpoints.map((viewpoint, index) => (
            <Button
              key={index}
              variant="ghost"
              className={cn(
                "w-12 h-12 p-0 rounded overflow-hidden border-2 transition-all duration-200",
                {
                  'border-blue-500 scale-110': index === currentViewpoint,
                  'border-white/30 hover:border-white/50': index !== currentViewpoint
                }
              )}
              onClick={() => onViewpointChange(index)}
              title={`View ${index + 1}: ${getCompassDirection(viewpoint.heading)}`}
            >
              <img
                src={viewpoint.imageUrl}
                alt={`Preview ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {loadingViewpoints.has(index) && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnhancedStreetViewCompass;
