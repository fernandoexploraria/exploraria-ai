import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    cordova: any;
    store: any;
  }
}

export const useCordovaSubscription = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { user, session } = useAuth();
  const { toast } = useToast();

  const isCordovaAvailable = typeof window !== 'undefined' && window.cordova;

  useEffect(() => {
    if (isCordovaAvailable) {
      initializeCordovaStore();
    }
  }, [isCordovaAvailable]);

  const initializeCordovaStore = () => {
    if (!window.store) {
      console.log('[CORDOVA] Store plugin not available');
      return;
    }

    // Configure the store
    window.store.verbosity = window.store.DEBUG;

    // Register the product
    window.store.register({
      id: 'LEXPS0001',
      type: window.store.PAID_SUBSCRIPTION,
    });

    // Handle purchase events
    window.store.when('LEXPS0001').approved((order: any) => {
      console.log('[CORDOVA] Purchase approved:', order);
      handlePurchaseApproved(order);
    });

    window.store.when('LEXPS0001').verified((order: any) => {
      console.log('[CORDOVA] Purchase verified:', order);
      order.finish();
    });

    window.store.when('LEXPS0001').error((error: any) => {
      console.error('[CORDOVA] Purchase error:', error);
      toast({
        title: "Purchase Failed",
        description: error.message || "An error occurred during purchase",
        variant: "destructive",
      });
      setIsLoading(false);
    });

    window.store.when('LEXPS0001').cancelled(() => {
      console.log('[CORDOVA] Purchase cancelled');
      toast({
        title: "Purchase Cancelled",
        description: "You cancelled the subscription purchase",
      });
      setIsLoading(false);
    });

    // Refresh store
    window.store.refresh();
    setIsInitialized(true);
    console.log('[CORDOVA] Store initialized');
  };

  const handlePurchaseApproved = async (order: any) => {
    try {
      console.log('[CORDOVA] Processing approved purchase:', order);
      
      if (!user || !session) {
        throw new Error('User not authenticated');
      }

      // Get the receipt data
      const receiptData = order.transaction.appStoreReceipt || order.receipt;
      if (!receiptData) {
        throw new Error('No receipt data available');
      }

      console.log('[CORDOVA] Sending receipt for verification');

      // Send receipt to our backend for verification
      const { data, error } = await supabase.functions.invoke('verify-apple-receipt', {
        body: {
          receiptData: receiptData,
          isProduction: false // Start with sandbox
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast({
          title: "Subscription Activated!",
          description: "Your Apple subscription is now active. Enjoy unlimited Smart Tours!",
        });
        
        // Trigger subscription refresh
        window.dispatchEvent(new CustomEvent('subscription-updated'));
      } else {
        throw new Error(data.error || 'Receipt verification failed');
      }

    } catch (error) {
      console.error('[CORDOVA] Error processing purchase:', error);
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Failed to verify purchase",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const purchaseSubscription = async () => {
    if (!isCordovaAvailable) {
      toast({
        title: "Apple Pay Not Available",
        description: "Apple Pay subscriptions are only available on iOS devices",
        variant: "destructive",
      });
      return;
    }

    if (!isInitialized) {
      toast({
        title: "Store Not Ready",
        description: "Please wait for the store to initialize",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to subscribe",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log('[CORDOVA] Starting purchase for LEXPS0001');

      // Check if product is available
      const product = window.store.get('LEXPS0001');
      if (!product) {
        throw new Error('Product LEXPS0001 not found');
      }

      if (!product.canPurchase) {
        throw new Error('Product cannot be purchased at this time');
      }

      // Initiate purchase
      window.store.order('LEXPS0001');
      
      toast({
        title: "Purchase Started",
        description: "Processing your Apple subscription...",
      });

    } catch (error) {
      console.error('[CORDOVA] Purchase initiation failed:', error);
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : "Failed to start purchase",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const restorePurchases = async () => {
    if (!isCordovaAvailable || !isInitialized) {
      return;
    }

    try {
      console.log('[CORDOVA] Restoring purchases');
      window.store.refresh();
      
      toast({
        title: "Restoring Purchases",
        description: "Checking for previous purchases...",
      });
    } catch (error) {
      console.error('[CORDOVA] Restore failed:', error);
      toast({
        title: "Restore Failed",
        description: "Failed to restore purchases",
        variant: "destructive",
      });
    }
  };

  return {
    isLoading,
    isInitialized,
    isCordovaAvailable,
    purchaseSubscription,
    restorePurchases,
  };
};