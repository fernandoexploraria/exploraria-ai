import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    CdvPurchase?: {
      store: any;
      APPLE_APPSTORE?: any;
      PAID_SUBSCRIPTION?: any;
      ProductType?: {
        PAID_SUBSCRIPTION: any;
      };
      Platform?: {
        APPLE_APPSTORE: any;
      };
    };
  }
}

export interface ApplePurchaseState {
  isAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  isProcessing: boolean;
  isProductReady: boolean;
  product: any | null;
}

const SUBSCRIPTION_PRODUCT_ID = 'LEXPS0001';

export const useApplePurchase = () => {
  const [state, setState] = useState<ApplePurchaseState>({
    isAvailable: false,
    isLoading: true,
    error: null,
    isProcessing: false,
    isProductReady: false,
    product: null,
  });

  const { user, session } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    initializePurchasePlugin();
    
    // No cleanup needed for store.when() - it manages its own listeners
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

      const { store } = window.CdvPurchase;

      // Initialize the store
      store.initialize([
        window.CdvPurchase.Platform?.APPLE_APPSTORE || 'APPLE_APPSTORE'
      ]);

      // Register the subscription product
      store.register({
        id: SUBSCRIPTION_PRODUCT_ID,
        type: window.CdvPurchase.ProductType?.PAID_SUBSCRIPTION || 'PAID_SUBSCRIPTION'
      });

      // CRITICAL: Listen for productUpdated event to know when products are ready
      store.when().productUpdated((product: any) => {
        console.log('🍎 Product updated:', product);
        if (product.id === SUBSCRIPTION_PRODUCT_ID) {
          console.log('🍎 Our product updated:', {
            id: product.id,
            state: product.state,
            valid: product.valid,
            canPurchase: product.canPurchase,
            title: product.title,
            price: product.price
          });
          
          setState(prev => ({ 
            ...prev, 
            isProductReady: product.valid && product.canPurchase,
            product: product 
          }));
        }
      });

      // Set up event handlers using the correct cordova-plugin-purchase API
      store.when().approved((product: any) => {
        console.log('🍎 Product approved:', product);
        handleTransactionApproved(product);
      });

      store.when().finished((product: any) => {
        console.log('🍎 Product finished:', product);
        setState(prev => ({ ...prev, isProcessing: false }));
      });

      // Error handling
      store.error((error: any) => {
        console.error('🍎 Purchase error:', error);
        const errorMessage = error instanceof Error ? error.message : (error?.message || 'Purchase failed');
        setState(prev => ({ ...prev, isProcessing: false, error: errorMessage }));
        toast({
          title: "Purchase Error",
          description: errorMessage,
          variant: "destructive"
        });
      });

      // Wait for store to be ready
      store.ready(() => {
        console.log('🍎 Store is ready');
        
        // Debug: Log all available products
        const products = window.CdvPurchase.store.products || [];
        console.log('🍎 Available products:', products.map(p => ({
          id: p.id,
          title: p.title,
          valid: p.valid,
          canPurchase: p.canPurchase
        })));
        
        // Check if our product is available
        const ourProduct = window.CdvPurchase.store.get(SUBSCRIPTION_PRODUCT_ID);
        console.log('🍎 Our product status:', {
          productId: SUBSCRIPTION_PRODUCT_ID,
          found: !!ourProduct,
          valid: ourProduct?.valid,
          canPurchase: ourProduct?.canPurchase,
          title: ourProduct?.title
        });
        
        setState(prev => ({ 
          ...prev, 
          isAvailable: true, 
          isLoading: false,
          error: null 
        }));
      });

      // Use store.update() instead of deprecated refresh()
      try {
        await store.update();
      } catch (updateError) {
        console.warn('🍎 Store update failed:', updateError);
      }

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

      if (!state.isProductReady) {
        throw new Error('Product not ready yet - please wait for App Store to load product details');
      }

      if (!user) {
        throw new Error('Please log in to subscribe');
      }

      if (!window.CdvPurchase) {
        throw new Error('Purchase plugin not available');
      }

      setState(prev => ({ ...prev, isProcessing: true, error: null }));
      
      // Debug: Check product availability before ordering
      const product = window.CdvPurchase.store.get(SUBSCRIPTION_PRODUCT_ID);
      console.log('🍎 Pre-purchase product check:', {
        productId: SUBSCRIPTION_PRODUCT_ID,
        found: !!product,
        valid: product?.valid,
        canPurchase: product?.canPurchase,
        title: product?.title,
        allProducts: window.CdvPurchase.store.products?.map(p => p.id) || []
      });
      
      if (!product) {
        throw new Error(`Product ${SUBSCRIPTION_PRODUCT_ID} not found in store`);
      }
      
      if (!product.valid) {
        throw new Error(`Product ${SUBSCRIPTION_PRODUCT_ID} is not valid`);
      }
      
      if (!product.canPurchase) {
        throw new Error(`Product ${SUBSCRIPTION_PRODUCT_ID} cannot be purchased`);
      }
      
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

  const refreshProducts = async () => {
    if (window.CdvPurchase?.store && state.isAvailable) {
      try {
        await window.CdvPurchase.store.update();
      } catch (updateError) {
        console.warn('🍎 Product update failed:', updateError);
      }
    }
  };

  return {
    ...state,
    purchaseSubscription,
    refreshProducts,
  };
};