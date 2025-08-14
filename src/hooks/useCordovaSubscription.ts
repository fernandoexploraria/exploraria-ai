import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

declare global {
  interface Window {
    CdvPurchase?: {
      store: {
        ready: () => Promise<void>;
        register: (product: any) => void;
        update: () => Promise<void>;
        order: (productId: string | any) => Promise<any>;
        when: (productId: string) => {
          approved: (callback: (product: any) => void) => any;
          verified: (callback: (product: any) => void) => any;
          error: (callback: (error: any) => void) => any;
        };
        get: (productId: string) => any;
        error: (callback: (error: any) => void) => any;
        verbosity: number;
      };
      ProductType: {
        PAID_SUBSCRIPTION: string;
      };
      Platform: {
        APPLE_APPSTORE: string;
      };
      DEBUG: number;
      ERROR: number;
    };
  }
}

interface CordovaSubscriptionState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  productInfo: any | null;
  isProductReady?: boolean;
}

export const useCordovaSubscription = () => {
  const [state, setState] = useState<CordovaSubscriptionState>({
    isInitialized: false,
    isLoading: false,
    error: null,
    productInfo: null
  });
  const { user, session } = useAuth();

  useEffect(() => {
    const onDeviceReady = async () => {
      if (!window.CdvPurchase) {
        console.warn('🍎 Cordova Purchase plugin (window.CdvPurchase) not available. Running in browser or plugin not installed correctly.');
        setState(prev => ({ ...prev, isInitialized: false, isLoading: false, error: 'Purchase plugin not available.' }));
        return;
      }

      await initializeStore();
    };

    // Add deviceready listener
    document.addEventListener('deviceready', onDeviceReady, false);

    // For testing in browser, call directly
    if (!window.CdvPurchase) {
      console.log('🍎 Cordova store not available (running in browser)');
      return;
    }

    // Cleanup listener
    return () => {
      document.removeEventListener('deviceready', onDeviceReady, false);
    };
  }, []);

  const initializeStore = async () => {
    if (!window.CdvPurchase) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const store = window.CdvPurchase.store;
      
      // Enable detailed logging
      store.verbosity = window.CdvPurchase.DEBUG;

      // Register the LEXPS0001 product
      store.register({
        id: 'LEXPS0001',
        type: window.CdvPurchase.ProductType.PAID_SUBSCRIPTION,
        platform: window.CdvPurchase.Platform.APPLE_APPSTORE,
      });

      // Set up event handlers
      store.when('LEXPS0001').approved((product: any) => {
        console.log('🍎 Product approved:', product);
        product.verify();
      });

      store.when('LEXPS0001').verified(async (product: any) => {
        console.log('🍎 Product verified:', product);
        try {
          await handleAppleReceipt(product);
          product.finish();
        } catch (err) {
          console.error('🍎 Error in handleAppleReceipt or finishing:', err);
          product.finish();
          setState(prev => ({ ...prev, error: 'Backend verification failed.' }));
        }
      });

      store.when('LEXPS0001').error((error: any) => {
        console.error('🍎 Product-specific error:', error);
        console.error('🍎 Error Message:', error?.message);
        console.error('🍎 Error Code:', error?.code);
        console.error('🍎 Error Stack:', error?.stack);
        console.error('🍎 Full Error Object (JSON):', JSON.stringify(error));
        setState(prev => ({ 
          ...prev, 
          error: error.message || 'Purchase failed',
          isLoading: false 
        }));
      });

      // Global error handler for the store
      store.error((error: any) => {
        console.error('🍎 Global Store Error:', error);
        console.error('🍎 Error Message:', error?.message);
        console.error('🍎 Error Code:', error?.code);
        console.error('🍎 Error Stack:', error?.stack);
        console.error('🍎 Full Error Object (JSON):', JSON.stringify(error));
        setState(prev => ({
          ...prev,
          error: error.message || 'Store error occurred',
          isLoading: false
        }));
      });

      // Initialize the store
      await store.ready();
      console.log('🍎 Cordova store is ready.');

      // Check for existing/pending transactions and clear them
      const existingProduct = store.get('LEXPS0001');
      if (existingProduct && existingProduct.transaction) {
        console.log('🍎 Found existing transaction, finishing it:', existingProduct.transaction);
        existingProduct.finish();
      }

      // Force an update to fetch product info
      await store.update();

      // Get product info after update
      const productInfo = store.get('LEXPS0001');
      console.log('🍎 Product info after update:', {
        id: productInfo?.id,
        valid: productInfo?.valid,
        canPurchase: productInfo?.canPurchase,
        price: productInfo?.price,
        state: productInfo?.state
      });
      
      setState(prev => ({ 
        ...prev, 
        isInitialized: true, 
        isLoading: false,
        productInfo,
        isProductReady: productInfo?.valid && productInfo?.canPurchase
      }));

      console.log('🍎 Cordova store initialized successfully and products refreshed.');
    } catch (error: any) {
      console.error('🍎 Failed to initialize Cordova store (outer catch):', error);
      console.error('🍎 Error Message:', error?.message);
      console.error('🍎 Error Code:', error?.code);
      console.error('🍎 Error Stack:', error?.stack);
      console.error('🍎 Full Error Object (JSON):', JSON.stringify(error));
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to initialize store',
        isLoading: false 
      }));
    }
  };

  const handleAppleReceipt = async (product: any) => {
    if (!user || !session) {
      throw new Error('User not authenticated');
    }

    try {
      const receiptData = product.transaction?.appStoreReceipt || product.receipt;
      if (!receiptData) {
        throw new Error('No receipt data available');
      }

      console.log('Sending receipt to backend for verification');
      const { data, error } = await supabase.functions.invoke('verify-apple-receipt', {
        body: { receiptData },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Receipt verification failed');
      }

      console.log('Apple subscription verified successfully:', data);
      return data;
    } catch (error) {
      console.error('Error verifying Apple receipt:', error);
      throw error;
    }
  };

  const purchaseSubscription = async () => {
    if (!window.CdvPurchase || !state.isInitialized) {
      throw new Error('Store not initialized or plugin not available.');
    }

    if (!user) {
      throw new Error('User not authenticated.');
    }

    if (!state.productInfo || !state.productInfo.valid || !state.productInfo.canPurchase) {
      throw new Error('Product is not valid or cannot be purchased.');
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      console.log('🍎 Starting Apple subscription purchase for: LEXPS0001');
      
      // Order the product using the product object from state
      await window.CdvPurchase.store.order(state.productInfo);
    } catch (error: any) {
      console.error('🍎 Error purchasing subscription (outer catch):', error);
      console.error('🍎 Error Message:', error?.message);
      console.error('🍎 Error Code:', error?.code);
      console.error('🍎 Error Stack:', error?.stack);
      console.error('🍎 Full Error Object (JSON):', JSON.stringify(error));
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Purchase failed',
        isLoading: false 
      }));
      throw error;
    }
  };

  const refreshProducts = async () => {
    if (!window.CdvPurchase) return;

    try {
      await window.CdvPurchase.store.update();
      const productInfo = window.CdvPurchase.store.get('LEXPS0001');
      setState(prev => ({ ...prev, productInfo }));
    } catch (error) {
      console.error('🍎 Error refreshing products:', error);
    }
  };

  return {
    ...state,
    purchaseSubscription,
    refreshProducts,
    isAvailable: !!window.CdvPurchase
  };
};