import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

declare global {
  interface Window {
    CdvPurchase?: {
      store: any;
      ProductType: {
        PAID_SUBSCRIPTION: string;
        NON_CONSUMABLE: string;
        CONSUMABLE: string;
        FREE_SUBSCRIPTION: string;
        NON_RENEWING_SUBSCRIPTION: string;
      };
      Platform: {
        APPLE_APPSTORE: string;
        GOOGLE_PLAY: string;
        TEST: string;
      };
      ERROR_CODES?: {
        PAYMENT_CANCELLED: number;
        INVALID_PARAMETER: number;
      };
      DEBUG: number;
    };
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
    console.log('🍎 Initializing store after deviceready...');
    
    try {
      // Check if the CdvPurchase plugin is available
      if (!window.CdvPurchase || !window.CdvPurchase.store) {
        console.log('🍎 CdvPurchase.store not found. Plugin may not be properly installed.');
        updateState({ 
          isLoading: false, 
          isAvailable: false,
          error: 'CdvPurchase store not available. Please ensure plugin is properly installed.' 
        });
        return;
      }

      const store = window.CdvPurchase.store;
      console.log('🍎 Store object found, checking methods...');
      console.log('🍎 Store methods available:', Object.keys(store));
      console.log('🍎 Ready method:', typeof store.ready);
      console.log('🍎 Register method:', typeof store.register);

      // Verify essential methods exist
      if (typeof store.ready !== 'function' || typeof store.register !== 'function') {
        console.error('🍎 Essential store methods not available');
        updateState({ 
          isLoading: false, 
          isAvailable: false,
          error: 'Store methods not available. Plugin may not be fully initialized.' 
        });
        return;
      }

      // Configure the store
      console.log('🍎 Setting store verbosity...');
      store.verbosity = store.DEBUG;

      // Register product
      console.log('🍎 Registering product...');
      store.register({
        id: PRODUCT_ID,
        type: window.CdvPurchase.ProductType.PAID_SUBSCRIPTION,
        platform: window.CdvPurchase.Platform.APPLE_APPSTORE,
      });
      console.log('🍎 Product registered successfully');

      // Set up event handlers
      console.log('🍎 Setting up event handlers...');
      store.when(PRODUCT_ID).approved((product: any) => {
        console.log('🍎 Product approved:', product);
        handlePurchaseApproved(product);
      });

      store.when(PRODUCT_ID).verified((product: any) => {
        console.log('🍎 Product verified:', product);
        handlePurchaseVerified(product);
      });

      console.log('🍎 Product-specific handlers set up');

      // Global error handler for all store errors including cancellations
      console.log('🍎 Setting up global error handler...');
      store.error((error: any) => {
        console.error('🍎 Global Store Error:', error);
        updateState({ isLoading: false, isProcessing: false });

        let errorMessage = error.message || 'Store error occurred';
        
        // Check if it's a cancellation error
        if (error.code && window.CdvPurchase?.ERROR_CODES?.PAYMENT_CANCELLED && 
            error.code === window.CdvPurchase.ERROR_CODES.PAYMENT_CANCELLED) {
          errorMessage = 'Purchase cancelled by user';
          toast.error('Purchase cancelled');
        } else if (errorMessage.toLowerCase().includes('cancel')) {
          errorMessage = 'Purchase cancelled by user';
          toast.error('Purchase cancelled');
        } else {
          toast.error(`Store error: ${errorMessage}`);
        }
        
        updateState({ error: errorMessage });
      });

      console.log('🍎 All event handlers set up, calling store.initialize()...');

      // CRITICAL: Initialize store to start App Store connection
      await store.initialize();
      console.log('🍎 Store.initialize() completed, now calling store.ready()...');

      // Initialize store - call ready directly, don't wrap in Promise
      store.ready(() => {
        console.log('🍎 Store ready callback triggered');
        
        // Refresh store to get latest product info
        store.refresh();
        
        const products = store.products || [];
        console.log('🍎 Available products after ready:', products.length);
        
        if (products.length > 0) {
          products.forEach((product: any, index: number) => {
            console.log(`🍎 Product ${index}:`, {
              id: product.id,
              valid: product.valid,
              canPurchase: product.canPurchase,
              owned: product.owned,
              state: product.state,
              price: product.price
            });
          });
        } else {
          console.log('🍎 No products found after store ready, will check again after refresh');
        }

        updateState({ 
          isInitialized: true, 
          isLoading: false, 
          isAvailable: true,
          products: products,
          isPremiumActive: checkPremiumStatus(products)
        });
      });

      // Call store.ready() to start initialization
      console.log('🍎 Calling store.ready()...');
      store.ready();

      // Refresh store to process any pending transactions
      store.refresh();

      // After refresh, check if there are pending transactions that should be processed
      setTimeout(() => {
        const updatedProducts = store.products || [];
        const isPremium = checkPremiumStatus(updatedProducts);
        console.log('🍎 Post-refresh status check:', { isPremium, productsCount: updatedProducts.length });
        
        if (isPremium !== state.isPremiumActive) {
          updateState({ isPremiumActive: isPremium, products: updatedProducts });
        }
      }, 1000);

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
    
    // Check if user owns the subscription via the owned property
    console.log('🍎 Checking premium status for product:', {
      id: product.id,
      owned: product.owned,
      state: product.state,
      valid: product.valid
    });
    
    return product.owned || false;
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
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data, error } = await supabase.functions.invoke('validate-apple-receipt', {
        body: { receiptData, sandbox: true }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.valid) {
        throw new Error(data.error || 'Receipt validation failed');
      }

      console.log('🍎 Receipt validation successful:', data);
      return data;
      
    } catch (error: any) {
      console.error('🍎 Receipt validation error:', error);
      throw error;
    }
  };

  const updateSubscriptionInSupabase = async (product: any) => {
    try {
      console.log('🍎 Subscription already updated via receipt validation');
      // The validateReceipt function already updates the subscribers table
      // No additional action needed here
      
    } catch (error) {
      console.error('🍎 Error in updateSubscriptionInSupabase:', error);
    }
  };

  const purchaseSubscription = async () => {
    if (!state.isAvailable || state.isProcessing) {
      toast.error('Store not available or purchase in progress');
      return;
    }

    try {
      updateState({ isProcessing: true, error: null });
      
      const store = window.CdvPurchase?.store;
      if (!store) {
        throw new Error('Store not available');
      }
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
      
      const store = window.CdvPurchase?.store;
      if (!store) {
        throw new Error('Store not available');
      }
      
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
    console.log('🍎 Checking platform and store availability...');
    console.log('🍎 Platform:', Capacitor.getPlatform());
    console.log('🍎 Is native platform:', Capacitor.isNativePlatform());
    
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
      console.log('🍎 Apple payments only available on iOS, setting as unavailable');
      updateState({ 
        isLoading: false, 
        isAvailable: false,
        error: 'Apple payments only available on iOS' 
      });
      return;
    }

    const onDeviceReady = async () => {
      console.log('🍎 Device ready event fired, initializing store...');
      await initializeStore();
    };

    // Check if device is already ready
    if (document.readyState === 'complete') {
      console.log('🍎 Document already ready, checking for deviceready...');
      // Give a small delay to ensure Cordova is fully loaded
      setTimeout(onDeviceReady, 100);
    } else {
      console.log('🍎 Adding deviceready event listener...');
      document.addEventListener('deviceready', onDeviceReady, false);
    }

    return () => {
      document.removeEventListener('deviceready', onDeviceReady, false);
    };
  }, []);

  return {
    ...state,
    purchaseSubscription,
    restorePurchases,
  };
};