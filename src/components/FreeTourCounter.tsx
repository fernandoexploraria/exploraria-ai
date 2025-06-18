
import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Lock, CreditCard, X, AlertTriangle } from 'lucide-react';
import { useTourStats } from '@/hooks/useTourStats';
import { useSubscription } from '@/hooks/useSubscription';

const FreeTourCounter: React.FC = () => {
  const { tourStats, isLoading: tourLoading } = useTourStats();
  const { subscriptionData, isLoading: subLoading, createCheckout, openCustomerPortal } = useSubscription();
  
  const FREE_TOUR_LIMIT = 10;
  const toursUsed = tourStats?.tour_count || 0;
  const toursRemaining = Math.max(0, FREE_TOUR_LIMIT - toursUsed);
  const hasReachedLimit = toursRemaining === 0;
  const isSubscribed = subscriptionData?.subscribed || false;
  const isCancelled = subscriptionData?.cancel_at_period_end || false;
  const subscriptionEnd = subscriptionData?.subscription_end;

  const handleSubscribeClick = async () => {
    try {
      await createCheckout();
    } catch (error) {
      console.error('Error creating checkout:', error);
    }
  };

  const handleManageClick = async () => {
    try {
      await openCustomerPortal();
    } catch (error) {
      console.error('Error opening customer portal:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (tourLoading || subLoading) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Tour Counter Button - Mobile/Tablet Layout */}
      {!isSubscribed && (
        <Button
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:hidden text-left"
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
      )}
      
      {/* Tour Counter Button - Desktop Layout */}
      {!isSubscribed && (
        <Button
          variant="outline"
          className="bg-background/80 backdrop-blur-sm shadow-lg hidden lg:flex justify-start text-left"
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
      )}

      {/* Cancelled Subscription Warning - Mobile/Tablet Layout */}
      {isSubscribed && isCancelled && subscriptionEnd && (
        <Button
          variant="outline"
          size="sm"
          className="bg-orange-50/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:hidden text-left text-orange-700 border-orange-200"
        >
          <AlertTriangle className="mr-1 h-3 w-3" />
          <span>Expires {formatDate(subscriptionEnd)}</span>
        </Button>
      )}
      
      {/* Cancelled Subscription Warning - Desktop Layout */}
      {isSubscribed && isCancelled && subscriptionEnd && (
        <Button
          variant="outline"
          className="bg-orange-50/80 backdrop-blur-sm shadow-lg hidden lg:flex justify-start text-left text-orange-700 border-orange-200"
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          <span>Subscription expires {formatDate(subscriptionEnd)}</span>
        </Button>
      )}
      
      {/* Subscribe Button - Mobile/Tablet Layout */}
      {!isSubscribed && (
        <Button
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:hidden text-left"
          onClick={handleSubscribeClick}
        >
          <CreditCard className="mr-1 h-3 w-3" />
          Subscribe
        </Button>
      )}
      
      {/* Subscribe Button - Desktop Layout */}
      {!isSubscribed && (
        <Button
          variant="outline"
          className="bg-background/80 backdrop-blur-sm shadow-lg hidden lg:flex justify-start text-left"
          onClick={handleSubscribeClick}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Subscribe for $9.99/month
        </Button>
      )}

      {/* Manage Subscription Button - Mobile/Tablet Layout */}
      {isSubscribed && (
        <Button
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:hidden text-left"
          onClick={handleManageClick}
        >
          <CreditCard className="mr-1 h-3 w-3" />
          Manage
        </Button>
      )}
      
      {/* Manage Subscription Button - Desktop Layout */}
      {isSubscribed && (
        <Button
          variant="outline"
          className="bg-background/80 backdrop-blur-sm shadow-lg hidden lg:flex justify-start text-left"
          onClick={handleManageClick}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Manage Subscription
        </Button>
      )}

      {/* Cancel Subscription Button - Mobile/Tablet Layout (only show if not already cancelled) */}
      {isSubscribed && !isCancelled && (
        <Button
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:hidden text-left text-red-600 hover:text-red-700"
          onClick={handleManageClick}
        >
          <X className="mr-1 h-3 w-3" />
          Cancel
        </Button>
      )}
      
      {/* Cancel Subscription Button - Desktop Layout (only show if not already cancelled) */}
      {isSubscribed && !isCancelled && (
        <Button
          variant="outline"
          className="bg-background/80 backdrop-blur-sm shadow-lg hidden lg:flex justify-start text-left text-red-600 hover:text-red-700"
          onClick={handleManageClick}
        >
          <X className="mr-2 h-4 w-4" />
          Cancel Subscription
        </Button>
      )}
    </div>
  );
};

export default FreeTourCounter;
