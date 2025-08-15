import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

declare global {
  interface Window {
    store?: any;
  }
}

interface ApplePaymentsState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  isProcessing: boolean;
  products: any[];
  isPremiumActive: boolean;
  isAvailable: boolean;
}

const PRODUCT_ID = 'LEXPS0001'; // Your Apple subscription product ID

export const useApplePayments = () => {
  const [state, setState] = useState<ApplePaymentsState>({
    isInitialized: false,
    isLoading: true,
    error: null,
    isProcessing: false,
    products: [],
    isPremiumActive: false,
    isAvailable: false,
  });

  const updateState = (updates: Partial<ApplePaymentsState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const initializeStore = async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
      console.log('Apple payments only available on iOS');
      updateState({ 
        isLoading: false, 
        isAvailable: false,
        error: 'Apple payments only available on iOS' 
      });
      return;
    }

    try {
      const { store } = window;
      
      if (!store) {
        throw new Error('Cordova store plugin not available');
      }

      console.log('🍎 Initializing Apple Store...');

      // Configure the store
      store.verbosity = store.DEBUG;

      // Register product
      store.register({
        id: PRODUCT_ID,
        type: store.PAID_SUBSCRIPTION,
      });

      // Set up event handlers
      store.when(PRODUCT_ID).approved((product: any) => {
        console.log('🍎 Product approved:', product);
        handlePurchaseApproved(product);
      });

      store.when(PRODUCT_ID).verified((product: any) => {
        console.log('🍎 Product verified:', product);
        handlePurchaseVerified(product);
      });

      store.when(PRODUCT_ID).owned((product: any) => {
        console.log('🍎 Product owned:', product);
        updateState({ isPremiumActive: true });
      });

      store.when(PRODUCT_ID).cancelled((product: any) => {
        console.log('🍎 Purchase cancelled:', product);
        updateState({ isProcessing: false });
        toast.error('Purchase cancelled');
      });

      store.when(PRODUCT_ID).error((error: any) => {
        console.error('🍎 Purchase error:', error);
        updateState({ isProcessing: false, error: error.message });
        toast.error(`Purchase error: ${error.message}`);
      });

      // Initialize store
      await new Promise((resolve, reject) => {
        store.ready(() => {
          console.log('🍎 Store ready');
          const products = store.products || [];
          updateState({ 
            isInitialized: true, 
            isLoading: false, 
            isAvailable: true,
            products: products,
            isPremiumActive: checkPremiumStatus(products)
          });
          resolve(true);
        });

        store.error((error: any) => {
          console.error('🍎 Store error:', error);
          updateState({ error: error.message, isLoading: false });
          reject(error);
        });
      });

      // Refresh store
      store.refresh();

    } catch (error: any) {
      console.error('🍎 Store initialization error:', error);
      updateState({ 
        error: error.message, 
        isLoading: false, 
        isAvailable: false 
      });
      toast.error(`Store initialization failed: ${error.message}`);
    }
  };

  const checkPremiumStatus = (products: any[]) => {
    const product = products.find(p => p.id === PRODUCT_ID);
    if (!product) return false;
    
    // Check if user owns the subscription
    return product.owned && product.state === 'approved';
  };

  const handlePurchaseApproved = async (product: any) => {
    console.log('🍎 Handling approved purchase:', product);
    
    try {
      // Validate receipt with Apple
      await validateReceipt(product.transaction.appStoreReceipt);
      
      // Finish the transaction
      product.finish();
      
      updateState({ 
        isProcessing: false, 
        isPremiumActive: true 
      });
      
      toast.success('Subscription activated!');
      
    } catch (error: any) {
      console.error('🍎 Receipt validation error:', error);
      updateState({ isProcessing: false, error: error.message });
      toast.error('Receipt validation failed');
    }
  };

  const handlePurchaseVerified = async (product: any) => {
    console.log('🍎 Purchase verified:', product);
    
    // Update our backend with the subscription
    await updateSubscriptionInSupabase(product);
  };

  const validateReceipt = async (receiptData: string) => {
    console.log('🍎 Validating receipt...');
    
    // For now, just log the receipt - you can implement server-side validation later
    console.log('🍎 Receipt data:', receiptData);
    
    // TODO: Send receipt to your backend for validation with Apple's servers
    // This would typically involve calling your edge function that validates with Apple
    
    return true; // Simplified for now
  };

  const updateSubscriptionInSupabase = async (product: any) => {
    try {
      console.log('🍎 Updating subscription in Supabase...');
      
      // TODO: Call your edge function to update subscription status
      // This would update the subscribers table with Apple subscription data
      
      console.log('🍎 Subscription updated in Supabase');
      
    } catch (error) {
      console.error('🍎 Error updating subscription in Supabase:', error);
    }
  };

  const purchaseSubscription = async () => {
    if (!state.isAvailable || state.isProcessing) {
      toast.error('Store not available or purchase in progress');
      return;
    }

    try {
      updateState({ isProcessing: true, error: null });
      
      const { store } = window;
      const product = store.products.find((p: any) => p.id === PRODUCT_ID);
      
      if (!product) {
        throw new Error('Product not found');
      }

      if (!product.canPurchase) {
        throw new Error('Product cannot be purchased');
      }

      console.log('🍎 Starting purchase for:', product);
      toast.loading('Processing purchase...');
      
      // Trigger purchase
      store.order(PRODUCT_ID);
      
    } catch (error: any) {
      console.error('🍎 Purchase error:', error);
      updateState({ isProcessing: false, error: error.message });
      toast.error(`Purchase failed: ${error.message}`);
    }
  };

  const restorePurchases = async () => {
    if (!state.isAvailable) {
      toast.error('Store not available');
      return;
    }

    try {
      updateState({ isProcessing: true, error: null });
      console.log('🍎 Restoring purchases...');
      
      const { store } = window;
      
      await new Promise((resolve) => {
        store.refresh();
        setTimeout(resolve, 3000); // Give it time to process
      });
      
      const products = store.products || [];
      const isPremium = checkPremiumStatus(products);
      
      updateState({ 
        isProcessing: false, 
        isPremiumActive: isPremium,
        products: products
      });
      
      if (isPremium) {
        toast.success('Purchases restored successfully!');
      } else {
        toast.info('No active subscriptions found');
      }
      
    } catch (error: any) {
      console.error('🍎 Restore error:', error);
      updateState({ isProcessing: false, error: error.message });
      toast.error(`Restore failed: ${error.message}`);
    }
  };

  useEffect(() => {
    initializeStore();
  }, []);

  return {
    ...state,
    purchaseSubscription,
    restorePurchases,
  };
};