
import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Lock, CreditCard } from 'lucide-react';
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
      {/* Tour Counter Button - Mobile/Tablet Layout */}
      <Button
        variant="outline"
        size="sm"
        className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:hidden"
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
      
      {/* Tour Counter Button - Desktop Layout */}
      <Button
        variant="outline"
        className="bg-background/80 backdrop-blur-sm shadow-lg hidden lg:flex"
      >
        {hasReachedLimit ? (
          <>
            <Lock className="mr-2 h-4 w-4" />
            <span>Free tours used</span>
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            <span>{toursRemaining} free tours left</span>
          </>
        )}
      </Button>
      
      {/* Subscribe Button - Mobile/Tablet Layout */}
      <Button
        variant="outline"
        size="sm"
        className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:hidden"
        disabled
      >
        <CreditCard className="mr-1 h-3 w-3" />
        Subscribe
      </Button>
      
      {/* Subscribe Button - Desktop Layout */}
      <Button
        variant="outline"
        className="bg-background/80 backdrop-blur-sm shadow-lg hidden lg:flex"
        disabled
      >
        <CreditCard className="mr-2 h-4 w-4" />
        Subscribe
      </Button>
    </div>
  );
};

export default FreeTourCounter;
