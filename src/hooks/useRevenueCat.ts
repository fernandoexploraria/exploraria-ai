import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

// RevenueCat Purchases types
interface RevenueCatProduct {
  identifier: string;
  description: string;
  title: string;
  price: number;
  priceString: string;
  currencyCode: string;
}

interface RevenueCatSubscriptionInfo {
  isActive: boolean;
  willRenew: boolean;
  periodType: string;
  latestPurchaseDate: string;
  originalPurchaseDate: string;
  expirationDate: string;
  store: string;
  productIdentifier: string;
}

interface RevenueCatCustomerInfo {
  activeSubscriptions: string[];
  allExpirationDates: Record<string, string>;
  allPurchaseDates: Record<string, string>;
  entitlements: {
    active: Record<string, RevenueCatSubscriptionInfo>;
    all: Record<string, RevenueCatSubscriptionInfo>;
  };
  firstSeen: string;
  latestExpirationDate: string;
  originalAppUserId: string;
  originalApplicationVersion: string;
  originalPurchaseDate: string;
  requestDate: string;
}

declare global {
  interface Window {
    Purchases: {
      configure: (apiKey: string) => Promise<void>;
      setLogLevel: (level: string) => void;
      getProducts: (productIds: string[]) => Promise<RevenueCatProduct[]>;
      purchaseProduct: (product: RevenueCatProduct) => Promise<{
        customerInfo: RevenueCatCustomerInfo;
        productIdentifier: string;
      }>;
      getCustomerInfo: () => Promise<RevenueCatCustomerInfo>;
      logIn: (appUserId: string) => Promise<{
        customerInfo: RevenueCatCustomerInfo;
        created: boolean;
      }>;
      logOut: () => Promise<RevenueCatCustomerInfo>;
      isConfigured: () => boolean;
    };
  }
}

export const useRevenueCat = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<RevenueCatProduct[]>([]);
  const [customerInfo, setCustomerInfo] = useState<RevenueCatCustomerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // RevenueCat product IDs - you'll need to configure these in RevenueCat dashboard
  const PRODUCT_IDS = ['premium_monthly']; // Replace with your actual product ID

  // Initialize RevenueCat
  useEffect(() => {
    const initializeRevenueCat = async () => {
      try {
        // Load RevenueCat SDK
        if (!window.Purchases) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@revenuecat/purchases-js@latest/dist/purchases.min.js';
          script.onload = async () => {
            await configureRevenueCat();
          };
          document.head.appendChild(script);
        } else {
          await configureRevenueCat();
        }
      } catch (err) {
        console.error('Failed to initialize RevenueCat:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize RevenueCat');
      }
    };

    const configureRevenueCat = async () => {
      try {
        console.log('🍎 RevenueCat: Starting configuration...');
        
        // Get RevenueCat public API key from Supabase
        const { data, error } = await supabase.functions.invoke('get-revenuecat-config');
        
        if (error || !data?.publicApiKey) {
          console.error('🍎 RevenueCat: Failed to get config:', error);
          throw new Error('Failed to get RevenueCat configuration');
        }
        
        console.log('🍎 RevenueCat: Got API key, configuring...');
        
        // Configure with public API key
        await window.Purchases.configure(data.publicApiKey);
        
        // Set log level for debugging
        window.Purchases.setLogLevel('DEBUG');
        
        // Log in user if authenticated
        if (user?.id) {
          console.log('🍎 RevenueCat: Logging in user:', user.id);
          await window.Purchases.logIn(user.id);
        }
        
        console.log('🍎 RevenueCat: Configuration complete!');
        setIsInitialized(true);
        
        // Load products and customer info
        await loadProducts();
        await loadCustomerInfo();
      } catch (err) {
        console.error('Failed to configure RevenueCat:', err);
        setError(err instanceof Error ? err.message : 'Failed to configure RevenueCat');
      }
    };

    initializeRevenueCat();
  }, [user?.id]);

  const loadProducts = async () => {
    if (!window.Purchases?.isConfigured()) {
      console.log('🍎 RevenueCat: Not configured, skipping product load');
      return;
    }
    
    try {
      console.log('🍎 RevenueCat: Loading products:', PRODUCT_IDS);
      const products = await window.Purchases.getProducts(PRODUCT_IDS);
      console.log('🍎 RevenueCat: Products loaded:', products);
      setProducts(products);
    } catch (err) {
      console.error('🍎 RevenueCat: Failed to load products:', err);
      setError(err instanceof Error ? err.message : 'Failed to load products');
    }
  };

  const loadCustomerInfo = async () => {
    if (!window.Purchases?.isConfigured()) return;
    
    try {
      const customerInfo = await window.Purchases.getCustomerInfo();
      setCustomerInfo(customerInfo);
    } catch (err) {
      console.error('Failed to load customer info:', err);
      setError(err instanceof Error ? err.message : 'Failed to load customer info');
    }
  };

  const purchaseProduct = async (productId: string) => {
    if (!window.Purchases?.isConfigured()) {
      throw new Error('RevenueCat not initialized');
    }
    
    const product = products.find(p => p.identifier === productId);
    if (!product) {
      throw new Error('Product not found');
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.Purchases.purchaseProduct(product);
      
      // Update customer info
      setCustomerInfo(result.customerInfo);
      
      // Refresh subscription status
      await loadCustomerInfo();
      
      return result;
    } catch (err) {
      console.error('Purchase failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Purchase failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const restorePurchases = async () => {
    if (!window.Purchases?.isConfigured()) {
      throw new Error('RevenueCat not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      const customerInfo = await window.Purchases.getCustomerInfo();
      setCustomerInfo(customerInfo);
      return customerInfo;
    } catch (err) {
      console.error('Restore failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Restore failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user has active subscription
  const hasActiveSubscription = () => {
    if (!customerInfo) return false;
    return Object.keys(customerInfo.entitlements.active).length > 0;
  };

  // Get subscription info
  const getSubscriptionInfo = () => {
    if (!customerInfo || !hasActiveSubscription()) return null;
    
    const activeEntitlements = customerInfo.entitlements.active;
    const entitlementKey = Object.keys(activeEntitlements)[0];
    return activeEntitlements[entitlementKey];
  };

  return {
    isInitialized,
    isLoading,
    products,
    customerInfo,
    error,
    purchaseProduct,
    restorePurchases,
    hasActiveSubscription: hasActiveSubscription(),
    subscriptionInfo: getSubscriptionInfo(),
    loadCustomerInfo,
  };
};