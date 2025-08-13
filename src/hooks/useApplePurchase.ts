import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    CdvPurchase?: {
      store: {
        when: (event?: string) => {
          approved: (callback: (transaction: any) => void) => any;
          finished: (callback: (transaction: any) => void) => any;
          error: (callback: (error: any) => void) => any;
        };
        ready: (callback: () => void) => void;
        initialize: (platform: string[]) => void;
        register: (product: { id: string; type: string }) => void;
        refresh: () => void;
        order: (productId: string) => void;
      };
    };
  }
}

export interface ApplePurchaseState {
  isAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  isProcessing: boolean;
}

const SUBSCRIPTION_PRODUCT_ID = 'LEXPS0001';

export const useApplePurchase = () => {
  const [state, setState] = useState<ApplePurchaseState>({
    isAvailable: false,
    isLoading: true,
    error: null,
    isProcessing: false,
  });

  const { user, session } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    initializePurchasePlugin();
  }, []);

  const initializePurchasePlugin = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Check if running on iOS native platform
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
        setState(prev => ({ 
          ...prev, 
          isAvailable: false, 
          isLoading: false,
          error: 'Apple Pay subscriptions are only available on iOS' 
        }));
        return;
      }

      // Check if cordova-plugin-purchase is available
      if (!window.CdvPurchase) {
        setState(prev => ({ 
          ...prev, 
          isAvailable: false, 
          isLoading: false,
          error: 'Purchase plugin not available' 
        }));
        return;
      }

      console.log('🍎 Initializing Apple Purchase Plugin...');

      // Initialize the store
      window.CdvPurchase.store.initialize(['AppleAppStore']);

      // Register the subscription product
      window.CdvPurchase.store.register({
        id: SUBSCRIPTION_PRODUCT_ID,
        type: 'paid subscription'
      });

      // Set up event handlers
      window.CdvPurchase.store.when()
        .approved((transaction: any) => {
          console.log('🍎 Transaction approved:', transaction);
          handleTransactionApproved(transaction);
        })
        .finished((transaction: any) => {
          console.log('🍎 Transaction finished:', transaction);
          setState(prev => ({ ...prev, isProcessing: false }));
        })
        .error((error: any) => {
          console.error('🍎 Purchase error:', error);
          setState(prev => ({ ...prev, isProcessing: false, error: error.message || 'Purchase failed' }));
          toast({
            title: "Purchase Error",
            description: error.message || 'Failed to complete purchase',
            variant: "destructive"
          });
        });

      // Wait for store to be ready
      window.CdvPurchase.store.ready(() => {
        console.log('🍎 Store is ready');
        setState(prev => ({ 
          ...prev, 
          isAvailable: true, 
          isLoading: false,
          error: null 
        }));
      });

      // Refresh store to get latest product info
      window.CdvPurchase.store.refresh();

    } catch (error) {
      console.error('🍎 Failed to initialize purchase plugin:', error);
      setState(prev => ({ 
        ...prev, 
        isAvailable: false, 
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize purchases' 
      }));
    }
  };

  const handleTransactionApproved = async (transaction: any) => {
    try {
      console.log('🍎 Processing approved transaction:', transaction);
      
      if (!user || !session) {
        throw new Error('User not authenticated');
      }

      // Extract receipt data
      const receiptData = transaction.receipt || transaction.transactionReceipt;
      if (!receiptData) {
        throw new Error('No receipt data found in transaction');
      }

      console.log('🍎 Validating receipt with server...');

      // Validate receipt with our backend
      const { data, error } = await supabase.functions.invoke('verify-apple-receipt', {
        body: {
          receiptData,
          productId: SUBSCRIPTION_PRODUCT_ID,
          transactionId: transaction.transactionId,
          originalTransactionId: transaction.originalTransactionId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data.isValid) {
        console.log('🍎 Receipt validation successful');
        toast({
          title: "Subscription Activated!",
          description: "Your premium subscription is now active.",
        });
        
        // Dispatch event to refresh subscription status
        window.dispatchEvent(new CustomEvent('subscription-updated'));
      } else {
        throw new Error(data.error || 'Receipt validation failed');
      }

    } catch (error) {
      console.error('🍎 Transaction processing failed:', error);
      setState(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Transaction processing failed' }));
      toast({
        title: "Subscription Error",
        description: error instanceof Error ? error.message : 'Failed to process subscription',
        variant: "destructive"
      });
    }
  };

  const purchaseSubscription = async () => {
    try {
      if (!state.isAvailable) {
        throw new Error('Apple purchases not available');
      }

      if (!user) {
        throw new Error('Please log in to subscribe');
      }

      if (!window.CdvPurchase) {
        throw new Error('Purchase plugin not available');
      }

      setState(prev => ({ ...prev, isProcessing: true, error: null }));
      
      console.log('🍎 Initiating purchase for:', SUBSCRIPTION_PRODUCT_ID);
      
      // Trigger the purchase
      window.CdvPurchase.store.order(SUBSCRIPTION_PRODUCT_ID);

    } catch (error) {
      console.error('🍎 Purchase initiation failed:', error);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to start purchase' 
      }));
      toast({
        title: "Purchase Error",
        description: error instanceof Error ? error.message : 'Failed to start purchase',
        variant: "destructive"
      });
    }
  };

  const refreshProducts = () => {
    if (window.CdvPurchase && state.isAvailable) {
      window.CdvPurchase.store.refresh();
    }
  };

  return {
    ...state,
    purchaseSubscription,
    refreshProducts,
  };
};