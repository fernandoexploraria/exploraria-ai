
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Maximize2, Navigation, Info } from 'lucide-react';
import StreetViewKeyboardHelp from './street-view/StreetViewKeyboardHelp';

interface StreetViewNavigationControlsProps {
  onPrevious?: () => void;
  onNext?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;
  onFullscreen?: () => void;
  onShowOnMap?: () => void;
  onToggleInfo?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  currentIndex?: number;
  totalCount?: number;
  isMultiViewpoint?: boolean;
  isInfoVisible?: boolean;
  className?: string;
}

const StreetViewNavigationControls: React.FC<StreetViewNavigationControlsProps> = ({
  onPrevious,
  onNext,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFullscreen,
  onShowOnMap,
  onToggleInfo,
  hasPrevious = false,
  hasNext = false,
  currentIndex = 0,
  totalCount = 0,
  isMultiViewpoint = false,
  isInfoVisible = false,
  className = ""
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Navigation Controls */}
      {totalCount > 1 && (
        <div className="flex items-center gap-1 bg-black/20 backdrop-blur-sm rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="h-8 w-8 p-0 text-white hover:bg-white/20 disabled:opacity-50"
            title="Previous landmark (← or Shift+Space)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-white text-sm px-2 min-w-[60px] text-center">
            {currentIndex + 1} / {totalCount}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onNext}
            disabled={!hasNext}
            className="h-8 w-8 p-0 text-white hover:bg-white/20 disabled:opacity-50"
            title="Next landmark (→ or Space)"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* View Controls */}
      <div className="flex items-center gap-1 bg-black/20 backdrop-blur-sm rounded-lg p-1">
        {onZoomIn && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onZoomIn}
            className="h-8 w-8 p-0 text-white hover:bg-white/20"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        )}
        
        {onZoomOut && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onZoomOut}
            className="h-8 w-8 p-0 text-white hover:bg-white/20"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
        )}
        
        {onResetView && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetView}
            className="h-8 w-8 p-0 text-white hover:bg-white/20"
            title="Reset view (R)"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Additional Controls */}
      <div className="flex items-center gap-1 bg-black/20 backdrop-blur-sm rounded-lg p-1">
        {onToggleInfo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleInfo}
            className={`h-8 w-8 p-0 text-white hover:bg-white/20 ${isInfoVisible ? 'bg-white/20' : ''}`}
            title="Toggle information (I)"
          >
            <Info className="h-4 w-4" />
          </Button>
        )}
        
        {onShowOnMap && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowOnMap}
            className="h-8 w-8 p-0 text-white hover:bg-white/20"
            title="Show on map (M)"
          >
            <Navigation className="h-4 w-4" />
          </Button>
        )}
        
        {onFullscreen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onFullscreen}
            className="h-8 w-8 p-0 text-white hover:bg-white/20"
            title="Fullscreen (F)"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        )}

        {/* Keyboard Help */}
        <StreetViewKeyboardHelp 
          isMultiViewpoint={isMultiViewpoint}
          className="h-8 w-8 p-0"
        />
      </div>
    </div>
  );
};

export default StreetViewNavigationControls;
