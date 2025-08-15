import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

import { Purchases, PurchasesOfferings, PurchasesPackage, LOG_LEVEL, CustomerInfo } from '@revenuecat/purchases-capacitor';

// Product ID from App Store Connect
const SUBSCRIPTION_PRODUCT_ID = 'LEXPS0001';

export interface RevenueCatState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  isProcessing: boolean;
  currentOffering: any | null;
  isPremiumActive: boolean;
  customerInfo: any | null;
  isAvailable: boolean;
}

const PREMIUM_ENTITLEMENT_ID = 'premium_access';
const PACKAGE_IDENTIFIER = 'monthly';

export const useRevenueCat = () => {
  const [state, setState] = useState<RevenueCatState>({
    isInitialized: false,
    isLoading: true,
    error: null,
    isProcessing: false,
    currentOffering: null,
    isPremiumActive: false,
    customerInfo: null,
    isAvailable: false,
  });

  const { user } = useAuth();
  const { toast } = useToast();

  // Customer info update handler
  const handleCustomerInfoUpdate = useCallback((customerInfo: CustomerInfo) => {
    const hasPremium = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;

    setState(prev => ({
      ...prev,
      isPremiumActive: hasPremium,
      customerInfo: customerInfo,
      error: null,
    }));

    if (hasPremium) {
      toast({
        title: "Subscription Status",
        description: "Your premium subscription is active!",
        variant: "default"
      });
    }
  }, [toast]);

  // RevenueCat configuration
  const configureRevenueCat = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    // Check if running on native iOS platform
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
      setState(prev => ({
        ...prev,
        isAvailable: false,
        isLoading: false,
        error: 'Subscriptions are only available on iOS devices.',
      }));
      return;
    }

    try {
      // Fetch public API key from Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('get-revenuecat-config');
      if (error || !data?.publicApiKey) {
        throw new Error('Failed to get RevenueCat public API key from backend.');
      }

      // Set debug logs for better troubleshooting
      Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

      // Configure RevenueCat with user ID
      const appUserID = user?.id;

      if (appUserID) {
        await Purchases.configure({
          apiKey: data.publicApiKey,
          appUserID: appUserID,
        });
      } else {
        await Purchases.configure({
          apiKey: data.publicApiKey,
        });
      }

      // Add customer info listener
      Purchases.addCustomerInfoUpdateListener(handleCustomerInfoUpdate);

      // Fetch offerings
      const offerings = await Purchases.getOfferings();

      if (offerings.current) {
        setState(prev => ({
          ...prev,
          currentOffering: offerings.current,
          isAvailable: true,
        }));
      } else {
        setState(prev => ({
          ...prev,
          isAvailable: false,
          error: 'No active offerings found. Check RevenueCat dashboard configuration.',
        }));
      }

      // Get initial customer info
      const { customerInfo: initialCustomerInfo } = await Purchases.getCustomerInfo();
      handleCustomerInfoUpdate(initialCustomerInfo);

      

    } catch (e: any) {
      // Handle errors silently in production
      setState(prev => ({
        ...prev,
        isAvailable: false,
        error: e.message || 'Failed to initialize subscription system.',
      }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false, isInitialized: true })); // Ensure isInitialized is set
    }
  }, [user, handleCustomerInfoUpdate]);

  // Purchase subscription
  const purchaseSubscription = useCallback(async () => {
    try {
      if (!state.isAvailable) throw new Error('Subscription system not available.');
      if (!state.currentOffering) throw new Error('No current offering found to purchase from.');

      // Debug: Log the current offering structure
      console.log('🔍 Current offering:', state.currentOffering);
      console.log('🔍 Available packages:', state.currentOffering.availablePackages);

      // Try different ways to find the package
      const pkg = state.currentOffering.availablePackages?.find((p: any) => p.identifier === '$rc_monthly') ||
                  state.currentOffering.availablePackages?.find((p: any) => p.identifier === 'monthly') ||
                  state.currentOffering.availablePackages?.[0]; // fallback to first package

      console.log('🔍 Found package:', pkg);
      
      if (!pkg) throw new Error('Monthly subscription package not found.');
      if (!user) throw new Error('Please log in to purchase a subscription.');

      setState(prev => ({ ...prev, isProcessing: true, error: null }));

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      handleCustomerInfoUpdate(customerInfo);

    } catch (e: any) {
      if (e.code === 1) { // PURCHASE_CANCELED error code
        toast({ title: "Purchase Canceled", description: "You cancelled the purchase process.", variant: "default" });
      } else {
        toast({
          title: "Purchase Error",
          description: e.message || 'Failed to complete purchase.',
          variant: "destructive"
        });
      }
      setState(prev => ({ ...prev, error: e.message || 'Purchase failed.' }));
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [state.isAvailable, state.currentOffering, user, toast, handleCustomerInfoUpdate]);

  // Restore purchases
  const restorePurchases = useCallback(async () => {
    try {
      if (!state.isAvailable) throw new Error('Subscription system not available.');
      if (!user) throw new Error('Please log in to restore purchases.');

      setState(prev => ({ ...prev, isProcessing: true, error: null }));

      const { customerInfo } = await Purchases.restorePurchases();
      handleCustomerInfoUpdate(customerInfo);

      if (customerInfo.entitlements.active && customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID]) {
        toast({ title: "Purchases Restored", description: "Your premium subscription has been restored!", variant: "default" });
      } else {
        toast({ title: "No Active Purchases", description: "No active subscriptions found to restore.", variant: "default" });
      }
    } catch (e: any) {
      toast({
        title: "Restore Error",
        description: e.message || 'Failed to restore purchases.',
        variant: "destructive"
      });
      setState(prev => ({ ...prev, error: e.message || 'Restore failed.' }));
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [state.isAvailable, user, toast, handleCustomerInfoUpdate]);

  useEffect(() => {
    configureRevenueCat();

    return () => {
      // Note: RevenueCat Capacitor plugin handles cleanup automatically
    };
  }, [configureRevenueCat]);

  return {
    ...state,
    purchaseSubscription,
    restorePurchases,
  };
};