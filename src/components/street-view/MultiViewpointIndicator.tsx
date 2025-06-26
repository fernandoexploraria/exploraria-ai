
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Layers, Eye, Navigation, Zap, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MultiViewpointIndicatorProps {
  strategy: 'single' | 'cardinal' | 'smart' | 'all';
  viewpointCount: number;
  dataUsage?: string;
  className?: string;
  variant?: 'compact' | 'detailed';
  isLoading?: boolean;
}

const MultiViewpointIndicator: React.FC<MultiViewpointIndicatorProps> = ({
  strategy,
  viewpointCount,
  dataUsage,
  className = "",
  variant = 'compact',
  isLoading = false
}) => {
  const strategyConfig = {
    single: {
      icon: Eye,
      label: 'Single View',
      color: 'bg-blue-500',
      description: 'Standard Street View'
    },
    cardinal: {
      icon: Navigation,
      label: 'Cardinal',
      color: 'bg-green-500',
      description: '4-direction coverage'
    },
    smart: {
      icon: Zap,
      label: 'Smart',
      color: 'bg-purple-500',
      description: 'Optimized viewpoints'
    },
    all: {
      icon: Globe,
      label: 'Complete',
      color: 'bg-orange-500',
      description: 'Full 360° coverage'
    }
  };

  const config = strategyConfig[strategy];
  const Icon = config.icon;

  if (variant === 'compact') {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "text-xs px-2 py-1 h-6 bg-black/60 text-white border-0 backdrop-blur-sm",
          isLoading && "animate-pulse",
          className
        )}
      >
        <Icon className="w-3 h-3 mr-1" />
        {viewpointCount}
        {strategy !== 'single' && <Layers className="w-3 h-3 ml-1" />}
      </Badge>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white",
      isLoading && "animate-pulse",
      className
    )}>
      <div className={cn("p-1 rounded", config.color)}>
        <Icon className="w-3 h-3" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{config.label}</span>
          <Badge variant="outline" className="text-xs border-white/30 text-white/90">
            {viewpointCount} {viewpointCount === 1 ? 'view' : 'views'}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-white/70 mt-1">
          <span>{config.description}</span>
          {dataUsage && (
            <>
              <span>•</span>
              <span>{dataUsage}</span>
            </>
          )}
        </div>
      </div>

      {strategy !== 'single' && (
        <div className="flex items-center text-white/60">
          <Layers className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};

export default MultiViewpointIndicator;
