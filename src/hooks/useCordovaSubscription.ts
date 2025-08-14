import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

declare global {
  interface Window {
    store?: {
      ready: () => Promise<void>;
      register: (product: any) => void;
      refresh: () => Promise<void>;
      order: (productId: string) => Promise<any>;
      when: (productId: string) => {
        approved: (callback: (product: any) => void) => any;
        verified: (callback: (product: any) => void) => any;
        error: (callback: (error: any) => void) => any;
      };
      get: (productId: string) => any;
      PAID: string;
      VALID: string;
      ERROR: string;
    };
  }
}

interface CordovaSubscriptionState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  productInfo: any | null;
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
    if (!window.store) {
      console.log('Cordova store not available (running in browser)');
      return;
    }

    initializeStore();
  }, []);

  const initializeStore = async () => {
    if (!window.store) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Register the LEXPS0001 product
      window.store.register({
        id: 'LEXPS0001',
        type: window.store.PAID,
      });

      // Set up event handlers
      window.store.when('LEXPS0001').approved((product: any) => {
        console.log('Product approved:', product);
        product.verify();
      });

      window.store.when('LEXPS0001').verified(async (product: any) => {
        console.log('Product verified:', product);
        await handleAppleReceipt(product);
        product.finish();
      });

      window.store.when('LEXPS0001').error((error: any) => {
        console.error('Product error:', error);
        setState(prev => ({ 
          ...prev, 
          error: error.message || 'Purchase failed',
          isLoading: false 
        }));
      });

      // Initialize the store
      await window.store.ready();
      
      // Get product info
      const productInfo = window.store.get('LEXPS0001');
      
      setState(prev => ({ 
        ...prev, 
        isInitialized: true, 
        isLoading: false,
        productInfo 
      }));

      console.log('Cordova store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Cordova store:', error);
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
    if (!window.store || !state.isInitialized) {
      throw new Error('Store not initialized');
    }

    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      console.log('Starting Apple subscription purchase');
      
      await window.store.order('LEXPS0001');
    } catch (error) {
      console.error('Error purchasing subscription:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Purchase failed',
        isLoading: false 
      }));
      throw error;
    }
  };

  const refreshProducts = async () => {
    if (!window.store) return;

    try {
      await window.store.refresh();
      const productInfo = window.store.get('LEXPS0001');
      setState(prev => ({ ...prev, productInfo }));
    } catch (error) {
      console.error('Error refreshing products:', error);
    }
  };

  return {
    ...state,
    purchaseSubscription,
    refreshProducts,
    isAvailable: !!window.store
  };
};