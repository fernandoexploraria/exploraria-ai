
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Loader2, Image, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingState {
  isLoading: boolean;
  progress: number;
  currentStep?: string;
  viewpointsLoaded?: number;
  totalViewpoints?: number;
}

interface StreetViewLoadingOverlayProps {
  loadingState: LoadingState;
  strategy?: string;
  className?: string;
}

const StreetViewLoadingOverlay: React.FC<StreetViewLoadingOverlayProps> = ({
  loadingState,
  strategy = 'single',
  className = ""
}) => {
  const { isLoading, progress, currentStep, viewpointsLoaded = 0, totalViewpoints = 1 } = loadingState;

  if (!isLoading) return null;

  const getStrategyDescription = (strategy: string) => {
    switch (strategy) {
      case 'single': return 'Loading single viewpoint...';
      case 'cardinal': return 'Loading cardinal directions...';
      case 'smart': return 'Loading smart viewpoints...';
      case 'all': return 'Loading all viewpoints...';
      default: return 'Loading Street View...';
    }
  };

  return (
    <div className={cn(
      "absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-20",
      className
    )}>
      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 max-w-sm w-full mx-4 text-white">
        {/* Header */}
        <div className="flex items-center justify-center mb-4">
          <div className="relative">
            <Image className="w-8 h-8 text-white/60" />
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute -top-1 -right-1" />
          </div>
        </div>

        {/* Strategy Info */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-medium mb-1">Street View Loading</h3>
          <p className="text-sm text-white/70">{getStrategyDescription(strategy)}</p>
        </div>

        {/* Progress */}
        <div className="space-y-3">
          <Progress value={progress} className="h-2" />
          
          <div className="flex justify-between text-xs text-white/70">
            <span>{Math.round(progress)}% Complete</span>
            <span>{viewpointsLoaded}/{totalViewpoints} Views</span>
          </div>

          {/* Current Step */}
          {currentStep && (
            <div className="flex items-center gap-2 text-xs text-white/90">
              <RotateCw className="w-3 h-3 animate-spin" />
              <span>{currentStep}</span>
            </div>
          )}
        </div>

        {/* Viewpoint Loading Indicators */}
        {totalViewpoints > 1 && (
          <div className="mt-4">
            <div className="text-xs text-white/70 mb-2">Viewpoints:</div>
            <div className="flex gap-1">
              {Array.from({ length: totalViewpoints }, (_, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex-1 h-1 rounded-full transition-colors duration-300",
                    {
                      'bg-blue-500': index < viewpointsLoaded,
                      'bg-blue-500/50 animate-pulse': index === viewpointsLoaded,
                      'bg-white/20': index > viewpointsLoaded
                    }
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {/* Network Info */}
        <div className="mt-4 text-xs text-white/60 text-center">
          Loading optimized for your connection...
        </div>
      </div>
    </div>
  );
};

export default StreetViewLoadingOverlay;
