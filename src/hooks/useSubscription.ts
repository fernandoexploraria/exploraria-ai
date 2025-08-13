
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Capacitor } from '@capacitor/core';

export interface SubscriptionData {
  subscribed: boolean;
  subscription_tier?: string | null;
  subscription_end?: string | null;
  cancel_at_period_end?: boolean;
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
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      setSubscriptionData(data);
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

  const createAppleSubscription = async (productId: string) => {
    if (!user || !session) {
      throw new Error('User not authenticated');
    }

    // Check if we're on iOS
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
      throw new Error('Apple Pay subscriptions are only available on iOS');
    }

    try {
      // Use global store object from cordova-plugin-purchase
      const store = (window as any).store;
      
      if (!store) {
        throw new Error('Cordova store plugin not available');
      }
      
      return new Promise((resolve, reject) => {
        // Initialize the store
        store.initialize();

        // Register the product
        store.register({
          id: productId,
          type: store.AUTO_RENEWING_SUBSCRIPTION,
        });

        // Handle purchase events
        store.when(productId).approved((product: any) => {
          console.log('Purchase approved:', product);
          
          // Validate the receipt with our backend
          validateAppleReceipt(product)
            .then(() => {
              product.verify();
              resolve(product);
            })
            .catch(reject);
        });

        store.when(productId).verified((product: any) => {
          console.log('Purchase verified:', product);
          product.finish();
          checkSubscription(); // Refresh subscription status
        });

        store.when(productId).error((error: any) => {
          console.error('Purchase error:', error);
          reject(new Error(error.message || 'Purchase failed'));
        });

        // Start the purchase
        store.order(productId);
      });
    } catch (err) {
      console.error('Error creating Apple subscription:', err);
      throw err;
    }
  };

  const validateAppleReceipt = async (product: any) => {
    if (!user || !session) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await supabase.functions.invoke('apple-receipt-validation', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          receiptData: product.receipt,
          transactionId: product.transactionId,
          originalTransactionId: product.originalTransactionId,
        },
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (err) {
      console.error('Error validating Apple receipt:', err);
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
    createAppleSubscription,
    openCustomerPortal,
    cancelSubscriptionAtPeriodEnd,
  };
};
