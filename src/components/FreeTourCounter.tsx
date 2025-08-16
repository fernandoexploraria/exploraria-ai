
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Lock, CreditCard, X, AlertTriangle, Apple, FileText, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApplePayments } from '@/hooks/useApplePayments';
import { useTourStats } from '@/hooks/useTourStats';
import { useSubscription } from '@/hooks/useSubscription';
import { usePaymentProcessor } from '@/hooks/usePaymentProcessor';

import { SubscriptionDialog } from '@/components/subscription/SubscriptionDialog';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

const FreeTourCounter: React.FC = () => {
  const { user } = useAuth();
  const { tourStats, isLoading: tourLoading } = useTourStats();
  const applePayments = useApplePayments();
  const { processor: paymentProcessor, isLoading: processorLoading } = usePaymentProcessor();
  
  console.log('🎯 FreeTourCounter Payment Processor:', paymentProcessor);
  console.log('🎯 FreeTourCounter Apple Payments state:', {
    isAvailable: applePayments.isAvailable,
    isLoading: applePayments.isLoading,
    isInitialized: applePayments.isInitialized,
    products: applePayments.products?.length || 0,
    isPremiumActive: applePayments.isPremiumActive,
    buttonShouldShow: applePayments.isAvailable && !applePayments.isLoading
  });
  
  const { subscriptionData, isLoading: subLoading, createCheckout, createSubscriptionIntent, openCustomerPortal, checkSubscription, cancelSubscriptionAtPeriodEnd } = useSubscription();
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
  const subscriptionPlatform = subscriptionData?.subscription_platform;
  
  
  // Wait for all loading states to complete to prevent flickering
  const isLoading = tourLoading || subLoading || processorLoading;

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
      // Mark user as Stripe platform user before checkout
      if (user?.email) {
        const { error } = await supabase
          .from('subscribers')
          .upsert({
            email: user.email,
            user_id: user.id,
            subscription_platform: 'stripe',
            subscribed: false,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'email' });
        
        if (error) {
          console.error('Error setting subscription platform:', error);
        }
      }

      if (useEmbeddedFlow) {
        // Use embedded subscription flow
        const { client_secret, subscription_id } = await createSubscriptionIntent();
        setSubscriptionClientSecret(client_secret);
        setSubscriptionId(subscription_id);
        setSubscriptionDialogOpen(true);
      } else {
        // Use hosted checkout flow (existing)
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

  const handleAppleSubscribeClick = async () => {
    try {
      await applePayments.purchaseSubscription();
      // Refresh subscription status after successful purchase
      await checkSubscription();
    } catch (error) {
      console.error('Apple subscription error:', error);
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

            {/* Subscribe Buttons - Conditional based on payment processor */}
            {paymentProcessor === 'stripe' ? (
              <>
                {/* Stripe Subscribe Buttons */}
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
            ) : paymentProcessor === 'apple' ? (
              <>
                {/* Apple Subscribe Buttons */}
                <Button
                  variant="outline"
                  size="sm"
                  className={`bg-green-100 border-green-300 text-green-800 hover:bg-green-200 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:hidden text-left transition-all duration-500 ${
                    isHighlighted ? 'ring-2 ring-green-500 animate-pulse bg-green-200' : ''
                  }`}
                  onClick={handleAppleSubscribeClick}
                  disabled={!applePayments.isAvailable || applePayments.isProcessing}
                >
                  {applePayments.isProcessing ? (
                    <div className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <CreditCard className="mr-1 h-3 w-3" />
                  )}
                  Subscribe for $9.99/month
                </Button>
                
                <Button
                  variant="outline"
                  className={`bg-green-100 border-green-300 text-green-800 hover:bg-green-200 backdrop-blur-sm shadow-lg hidden lg:flex justify-start text-left transition-all duration-500 ${
                    isHighlighted ? 'ring-2 ring-green-500 animate-pulse bg-green-200' : ''
                  }`}
                  onClick={handleAppleSubscribeClick}
                  disabled={!applePayments.isAvailable || applePayments.isProcessing}
                >
                  {applePayments.isProcessing ? (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  Subscribe for $9.99/month
                </Button>
                
                {/* Terms of Use and Privacy Policy Links - Apple only */}
                <div className="flex gap-2">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="text-xs px-2 py-1 h-6 text-foreground/80 hover:text-foreground bg-background/40 hover:bg-background/60 lg:hidden"
                  >
                    <Link to="/terms-of-use">
                      <FileText className="mr-1 h-3 w-3" />
                      Terms of Use
                    </Link>
                  </Button>
                  
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="text-xs px-2 py-1 h-6 text-foreground/80 hover:text-foreground bg-background/40 hover:bg-background/60 lg:hidden"
                  >
                    <Link to="/account-privacy-policy">
                      <Shield className="mr-1 h-3 w-3" />
                      Privacy Policy
                    </Link>
                  </Button>
                </div>
                
                <div className="hidden lg:flex gap-2">
                  <Button
                    asChild
                    variant="ghost"
                    className="text-sm px-3 py-2 h-8 text-foreground/80 hover:text-foreground bg-background/40 hover:bg-background/60"
                  >
                    <Link to="/terms-of-use">
                      <FileText className="mr-2 h-4 w-4" />
                      Terms of Use
                    </Link>
                  </Button>
                  
                  <Button
                    asChild
                    variant="ghost"
                    className="text-sm px-3 py-2 h-8 text-foreground/80 hover:text-foreground bg-background/40 hover:bg-background/60"
                  >
                    <Link to="/account-privacy-policy">
                      <Shield className="mr-2 h-4 w-4" />
                      Privacy Policy
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Fallback - show both options if processor is unknown */}
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

            {/* Platform-specific subscription management */}
            {subscriptionPlatform === 'stripe' ? (
              <>
                {/* Stripe Subscription Management */}
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
            ) : subscriptionPlatform === 'revenuecat' ? (
              <>
                {/* RevenueCat/Apple Subscription Management */}
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start w-full lg:hidden text-left text-muted-foreground"
                  disabled
                >
                  <Apple className="mr-1 h-3 w-3" />
                  Manage via App Store
                </Button>
                
                <Button
                  variant="outline"
                  className="bg-background/80 backdrop-blur-sm shadow-lg hidden lg:flex justify-start text-left text-muted-foreground"
                  disabled
                >
                  <Apple className="mr-2 h-4 w-4" />
                  Manage subscription in iOS Settings → Subscriptions
                </Button>
              </>
            ) : (
              <>
                {/* Fallback for unknown or legacy subscriptions */}
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
