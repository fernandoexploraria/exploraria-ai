import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    CdvPurchase?: {
      store: any;
      ProductType?: {
        PAID_SUBSCRIPTION: string;
      };
      Platform?: {
        APPLE_APPSTORE: string;
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

  const handleTransactionApproved = useCallback(async (transaction: any) => {
    try {
      console.log('🍎 Processing approved transaction:', transaction);
      setState(prev => ({ ...prev, isProcessing: true }));

      if (!user || !session) {
        throw new Error('User not authenticated. Please log in.');
      }

      // Use `appStoreReceipt` for a more reliable receipt.
      const receiptData = transaction.appStoreReceipt;
      if (!receiptData) {
        throw new Error('No receipt data found in transaction. Cannot validate.');
      }

      console.log('🍎 Validating receipt with server...');
      
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

      if (data?.isValid) {
        console.log('🍎 Receipt validation successful.');
        toast({
          title: "Subscription Activated! 🎉",
          description: "Your premium subscription is now active.",
        });
        
        // Finalize the transaction to signal that content has been delivered.
        transaction.finish();

        // Dispatch a custom event to notify other parts of the app to refresh user state
        window.dispatchEvent(new CustomEvent('subscription-updated'));
        
      } else {
        throw new Error(data?.error || 'Receipt validation failed on the server.');
      }
    } catch (error: any) {
      console.error('🍎 Transaction processing failed:', error);
      // It's important to finish the transaction on the client even if the backend
      // verification fails. This prevents the transaction from getting stuck.
      if (transaction && typeof transaction.finish === 'function') {
        transaction.finish();
      }

      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Transaction processing failed.' 
      }));
      toast({
        title: "Subscription Error",
        description: error instanceof Error ? error.message : 'Failed to process subscription.',
        variant: "destructive"
      });
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [user, session, toast]);

  const purchaseSubscription = useCallback(async () => {
    try {
      if (!state.isAvailable) throw new Error('Apple purchases not available.');
      if (!state.isProductReady) throw new Error('Product not ready yet. Please wait.');
      if (!user) throw new Error('Please log in to subscribe.');
      if (!window.CdvPurchase) throw new Error('Purchase plugin not available.');

      setState(prev => ({ ...prev, isProcessing: true, error: null }));

      const product = window.CdvPurchase.store.get(SUBSCRIPTION_PRODUCT_ID);

      if (!product || !product.valid || !product.canPurchase) {
        throw new Error(`Product ${SUBSCRIPTION_PRODUCT_ID} is not ready for purchase.`);
      }

      console.log('🍎 Initiating purchase for:', SUBSCRIPTION_PRODUCT_ID);
      window.CdvPurchase.store.order(product);

    } catch (error: any) {
      console.error('🍎 Purchase initiation failed:', error);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to start purchase.' 
      }));
      toast({
        title: "Purchase Error",
        description: error instanceof Error ? error.message : 'Failed to start purchase.',
        variant: "destructive"
      });
    }
  }, [state, user, toast]);

  const refreshProducts = useCallback(async () => {
    if (window.CdvPurchase?.store && state.isAvailable) {
      try {
        console.log('🍎 Refreshing product status...');
        setState(prev => ({ ...prev, isLoading: true }));
        await window.CdvPurchase.store.update();
      } catch (updateError) {
        console.warn('🍎 Product update failed:', updateError);
        setState(prev => ({ ...prev, error: 'Failed to refresh product data.' }));
      } finally {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, [state]);

  useEffect(() => {
    const initializePurchasePlugin = async () => {
      // Logic for deviceready listener
      const onDeviceReady = async () => {
        try {
          setState(prev => ({ ...prev, isLoading: true, error: null }));

          console.log('🍎 Starting Apple Purchase initialization...');
          console.log('🍎 Platform info:', {
            isNativePlatform: Capacitor.isNativePlatform(),
            platform: Capacitor.getPlatform(),
            isIOS: Capacitor.getPlatform() === 'ios'
          });

          if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
            console.log('🍎 Platform check failed - not iOS native');
            setState(prev => ({ ...prev, isAvailable: false, isLoading: false, error: 'Apple Pay subscriptions are only available on iOS' }));
            return;
          }

          if (!window.CdvPurchase) {
            setState(prev => ({ ...prev, isAvailable: false, isLoading: false, error: 'Purchase plugin not available' }));
            return;
          }

          console.log('🍎 Initializing Apple Purchase Plugin...');

          const { store } = window.CdvPurchase;
          store.verbosity = store.DEBUG;
          
          store.register({
            id: SUBSCRIPTION_PRODUCT_ID,
            type: window.CdvPurchase.ProductType?.PAID_SUBSCRIPTION,
          });

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

          store.when().approved((transaction: any) => {
            console.log('🍎 Product approved:', transaction);
            handleTransactionApproved(transaction);
          });
          
          store.when().finished((transaction: any) => {
            console.log('🍎 Product finished:', transaction);
            // The isProcessing state is managed in handleTransactionApproved's finally block now.
          });
          
          store.when().error((error: any) => {
            console.error('🍎 Purchase error:', error);
            const errorMessage = error instanceof Error ? error.message : (error?.message || 'Purchase failed');
            setState(prev => ({ ...prev, error: errorMessage }));
            toast({
              title: "Purchase Error",
              description: errorMessage,
              variant: "destructive"
            });
          });

          store.ready(() => {
            console.log('🍎 Store is ready');
            
            // Debug: Log all available products
            const products = store.products || [];
            console.log('🍎 Available products:', products.map(p => ({
              id: p.id,
              title: p.title,
              valid: p.valid,
              canPurchase: p.canPurchase
            })));
            
            const ourProduct = store.get(SUBSCRIPTION_PRODUCT_ID);
            console.log('🍎 Our product status:', {
              productId: SUBSCRIPTION_PRODUCT_ID,
              found: !!ourProduct,
              valid: ourProduct?.valid,
              canPurchase: ourProduct?.canPurchase,
              title: ourProduct?.title
            });

            setState(prev => ({ ...prev, isAvailable: true, isLoading: false }));
          });

          // The initialize() method will also refresh the products
          store.initialize();

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

      document.addEventListener('deviceready', onDeviceReady);

      return () => {
        // Cleanup listener on component unmount
        document.removeEventListener('deviceready', onDeviceReady);
      };
    };

    initializePurchasePlugin();
  }, [handleTransactionApproved, toast]);

  return {
    ...state,
    purchaseSubscription,
    refreshProducts,
  };
};