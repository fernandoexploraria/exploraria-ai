
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Lock } from 'lucide-react';
import { useTourStats } from '@/hooks/useTourStats';

const FreeTourCounter: React.FC = () => {
  const { tourStats, isLoading } = useTourStats();
  
  const FREE_TOUR_LIMIT = 10;
  const toursUsed = tourStats?.tour_count || 0;
  const toursRemaining = Math.max(0, FREE_TOUR_LIMIT - toursUsed);
  const hasReachedLimit = toursRemaining === 0;

  if (isLoading) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant={hasReachedLimit ? "destructive" : "secondary"}
        size="sm"
        className="flex items-center gap-2 bg-white/90 backdrop-blur-sm shadow-lg"
        disabled={hasReachedLimit}
      >
        {hasReachedLimit ? (
          <>
            <Lock className="w-4 h-4" />
            <span>Free tours used</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            <span>{toursRemaining} free tours left</span>
          </>
        )}
      </Button>
      
      <Badge variant="outline" className="text-xs bg-white/90 backdrop-blur-sm">
        Subscribe for unlimited tours
      </Badge>
    </div>
  );
};

export default FreeTourCounter;
