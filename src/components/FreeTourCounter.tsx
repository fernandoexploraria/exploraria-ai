
import React from 'react';
import { Button } from '@/components/ui/button';
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
    <div className="flex flex-col gap-2">
      <Button
        variant={hasReachedLimit ? "destructive" : "outline"}
        size="sm"
        className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full"
        disabled={hasReachedLimit}
      >
        {hasReachedLimit ? (
          <>
            <Lock className="mr-1 h-3 w-3" />
            <span>Free tours used</span>
          </>
        ) : (
          <>
            <Sparkles className="mr-1 h-3 w-3" />
            <span>{toursRemaining} free tours left</span>
          </>
        )}
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full"
        disabled
      >
        <Sparkles className="mr-1 h-3 w-3" />
        Subscribe for unlimited tours
      </Button>
    </div>
  );
};

export default FreeTourCounter;
