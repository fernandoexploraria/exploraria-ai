
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Lock, CreditCard, X, AlertTriangle } from 'lucide-react';
import { useTourStats } from '@/hooks/useTourStats';
import { useSubscription } from '@/hooks/useSubscription';
import { Capacitor } from '@capacitor/core';
import { SubscriptionDialog } from '@/components/subscription/SubscriptionDialog';
import { supabase } from '@/integrations/supabase/client';

const FreeTourCounter: React.FC = () => {
  const { tourStats, isLoading: tourLoading } = useTourStats();
  const { subscriptionData, isLoading: subLoading, createCheckout, createSubscriptionIntent, createAppleSubscription, openCustomerPortal, checkSubscription, cancelSubscriptionAtPeriodEnd } = useSubscription();
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [subscriptionClientSecret, setSubscriptionClientSecret] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [useEmbeddedFlow, setUseEmbeddedFlow] = useState(true); // Feature flag for embedded flow
  
  const FREE_TOUR_LIMIT = 3;
  const toursUsed = tourStats?.tour_count || 0;
  const toursRemaining = Math.max(0, FREE_TOUR_LIMIT - toursUsed);
  const hasReachedLimit = toursRemaining === 0;
  const isSubscribed = subscriptionData?.subscribed || false;
  const isCancelled = subscriptionData?.cancel_at_period_end || false;
  const subscriptionEnd = subscriptionData?.subscription_end;
  

  // Wait for both loading states to complete to prevent flickering
  const isLoading = tourLoading || subLoading;

  // Listen for subscription limit reached event
  useEffect(() => {
    const handleSubscriptionLimitReached = () => {
      setIsHighlighted(true);
      
      // Remove highlight after 8 seconds
      setTimeout(() => {
        setIsHighlighted(false);
      }, 8000);
    };

    window.addEventListener('subscription-limit-reached', handleSubscriptionLimitReached);
    
    return () => {
      window.removeEventListener('subscription-limit-reached', handleSubscriptionLimitReached);
    };
  }, []);

  const handleSubscribeClick = async () => {
    try {
      // Check if we should use Apple Pay (iOS + Apple payment processor)
      const isIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
      
      // Check payment processor preference via edge function
      const { data: config } = await supabase.functions.invoke('get-stripe-config');
      const useApplePay = isIOS && config?.paymentProcessor === 'APPLE';
      
      if (useApplePay) {
        // Use Apple Pay subscription - Replace with your App Store Connect product ID
        await createAppleSubscription('REPLACE_WITH_YOUR_PRODUCT_ID'); // e.g., 'com.yourcompany.exploraria.monthly'
      } else if (useEmbeddedFlow) {
        // Use embedded Stripe subscription flow
        const { client_secret, subscription_id } = await createSubscriptionIntent();
        setSubscriptionClientSecret(client_secret);
        setSubscriptionId(subscription_id);
        setSubscriptionDialogOpen(true);
      } else {
        // Use hosted Stripe checkout flow
        await createCheckout();
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
    }
  };

  const handleSubscriptionSuccess = async () => {
    // Refresh subscription data
    await checkSubscription();
    // Close dialog
    setSubscriptionDialogOpen(false);
    // Reset state
    setSubscriptionClientSecret(null);
    setSubscriptionId(null);
  };

  const handleManageClick = async () => {
    try {
      await openCustomerPortal();
    } catch (error) {
      console.error('Error opening customer portal:', error);
    }
  };

  const handleCancelClick = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You will retain access until the end of your current billing period.")) {
      return;
    }

    try {
      await cancelSubscriptionAtPeriodEnd();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert('Failed to cancel subscription. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Don't render anything while loading to prevent flickering
  if (isLoading) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Tour Counter - Only show if not subscribed */}
        {!isSubscribed && (
          <>
            {/* Mobile/Tablet Layout */}
            <Button
              variant="outline"
              size="sm"
              className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:hidden text-left"
            >
              {hasReachedLimit ? (
                <>
                  <Lock className="mr-1 h-3 w-3" />
                  <span>Free tours used ({toursUsed}/{FREE_TOUR_LIMIT})</span>
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 h-3 w-3" />
                  <span>{toursRemaining} free tours left</span>
                </>
              )}
            </Button>
            
            {/* Desktop Layout */}
            <Button
              variant="outline"
              className="bg-background/80 backdrop-blur-sm shadow-lg hidden lg:flex justify-start text-left"
            >
              {hasReachedLimit ? (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  <span>Free tours used ({toursUsed}/{FREE_TOUR_LIMIT})</span>
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  <span>{toursRemaining} free tours left</span>
                </>
              )}
            </Button>

            {/* Subscribe Buttons */}
            <Button
              variant="outline"
              size="sm"
              className={`bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:hidden text-left transition-all duration-500 ${
                isHighlighted ? 'ring-2 ring-primary animate-pulse bg-primary/10' : ''
              }`}
              onClick={handleSubscribeClick}
            >
              <CreditCard className="mr-1 h-3 w-3" />
              Subscribe
            </Button>
            
            <Button
              variant="outline"
              className={`bg-background/80 backdrop-blur-sm shadow-lg hidden lg:flex justify-start text-left transition-all duration-500 ${
                isHighlighted ? 'ring-2 ring-primary animate-pulse bg-primary/10' : ''
              }`}
              onClick={handleSubscribeClick}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Subscribe for $9.99/month
            </Button>
          </>
        )}

        {/* Subscription Management - Only show if subscribed */}
        {isSubscribed && (
          <>
            {/* Cancelled Subscription Warning */}
            {isCancelled && subscriptionEnd && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-orange-50/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:hidden text-left text-orange-700 border-orange-200"
                >
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  <span>Expires {formatDate(subscriptionEnd)}</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="bg-orange-50/80 backdrop-blur-sm shadow-lg hidden lg:flex justify-start text-left text-orange-700 border-orange-200"
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  <span>Subscription expires {formatDate(subscriptionEnd)}</span>
                </Button>
              </>
            )}

            {/* Manage Subscription Button */}
            {(
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:hidden text-left"
                  onClick={handleManageClick}
                >
                  <CreditCard className="mr-1 h-3 w-3" />
                  Manage
                </Button>
                
                <Button
                  variant="outline"
                  className="bg-background/80 backdrop-blur-sm shadow-lg hidden lg:flex justify-start text-left"
                  onClick={handleManageClick}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage Subscription
                </Button>
              </>
            )}

            {/* Cancel Subscription Button - Only show if not already cancelled */}
            {!isCancelled && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:hidden text-left text-red-600 hover:text-red-700"
                  onClick={handleCancelClick}
                >
                  <X className="mr-1 h-3 w-3" />
                  Cancel
                </Button>
                
                <Button
                  variant="outline"
                  className="bg-background/80 backdrop-blur-sm shadow-lg hidden lg:flex justify-start text-left text-red-600 hover:text-red-700"
                  onClick={handleCancelClick}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel Subscription
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {/* Subscription Dialog */}
      <SubscriptionDialog
        open={subscriptionDialogOpen}
        onOpenChange={setSubscriptionDialogOpen}
        clientSecret={subscriptionClientSecret}
        subscriptionId={subscriptionId}
        onSubscriptionSuccess={handleSubscriptionSuccess}
      />
    </>
  );
};

export default FreeTourCounter;
