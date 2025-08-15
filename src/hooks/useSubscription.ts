
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export interface SubscriptionData {
  subscribed: boolean;
  subscription_tier?: string | null;
  subscription_end?: string | null;
  cancel_at_period_end?: boolean;
  subscription_platform?: string | null;
}

export const useSubscription = () => {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, session } = useAuth();

  const checkSubscription = async () => {
    if (!user || !session) {
      setSubscriptionData(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // First, check what subscription platform this user has (if any)
      const { data: existingSubscriber } = await supabase
        .from('subscribers')
        .select('subscription_platform')
        .eq('user_id', user.id)
        .single();

      let subscriptionData = null;

      if (existingSubscriber?.subscription_platform === 'apple') {
        // TODO: Check Apple subscription status
        // const { data, error } = await supabase.functions.invoke('check-apple-subscription', {
        //   headers: {
        //     Authorization: `Bearer ${session.access_token}`,
        //   },
        // });
        
        // For now, just read from local database
        const { data: localData, error: localError } = await supabase
          .from('subscribers')
          .select('subscribed, subscription_tier, subscription_end, subscription_platform')
          .eq('user_id', user.id)
          .eq('subscription_platform', 'apple')
          .single();
          
        if (localError && localError.code !== 'PGRST116') {
          throw localError;
        }
        subscriptionData = localData || { subscribed: false, subscription_platform: 'apple' };
      } else {
        // Check Stripe subscription (default or explicit stripe platform)
        const { data, error } = await supabase.functions.invoke('check-subscription', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) {
          throw error;
        }
        subscriptionData = data;
      }

      setSubscriptionData(subscriptionData);
    } catch (err) {
      console.error('Error checking subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to check subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const createCheckout = async () => {
    if (!user || !session) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      // Open Stripe checkout in a new tab
      window.open(data.url, '_blank');
    } catch (err) {
      console.error('Error creating checkout:', err);
      throw err;
    }
  };

  const createSubscriptionIntent = async () => {
    if (!user || !session) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-intent', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (err) {
      console.error('Error creating subscription intent:', err);
      throw err;
    }
  };

  const openCustomerPortal = async () => {
    if (!user || !session) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      // Open customer portal in a new tab
      window.open(data.url, '_blank');
    } catch (err) {
      console.error('Error opening customer portal:', err);
      throw err;
    }
  };

  const cancelSubscriptionAtPeriodEnd = async () => {
    if (!user || !session) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription-at-period-end', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      // Refresh subscription data after cancellation
      await checkSubscription();
      
      return data;
    } catch (err) {
      console.error('Error cancelling subscription:', err);
      throw err;
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [user, session]);

  return {
    subscriptionData,
    isLoading,
    error,
    checkSubscription,
    createCheckout,
    createSubscriptionIntent,
    openCustomerPortal,
    cancelSubscriptionAtPeriodEnd,
  };
};
