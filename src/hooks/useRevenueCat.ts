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
    console.log('🍎 RevenueCat Customer Info Updated:', customerInfo);
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
    console.log('🍎 Starting RevenueCat configuration...');
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    // Check if running on native iOS platform
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
      console.warn('🍎 RevenueCat for iOS is only available on native iOS devices. Subscription functionality will be limited.');
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

      console.log('🍎 Got API key, configuring RevenueCat...');

      // Set debug logs for development
      Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

      // Configure RevenueCat with user ID
      const appUserID = user?.id;
      console.log('🍎 Configuring RevenueCat with appUserID:', appUserID);

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
      console.log('🍎 Fetched Offerings:', offerings);

      if (offerings.current) {
        setState(prev => ({
          ...prev,
          currentOffering: offerings.current,
          isAvailable: true,
          isInitialized: true,
        }));
      } else {
        setState(prev => ({
          ...prev,
          isAvailable: false,
          error: 'No active offerings found. Please check your RevenueCat dashboard configuration.',
        }));
      }

      // Get initial customer info
      const { customerInfo: initialCustomerInfo } = await Purchases.getCustomerInfo();
      handleCustomerInfoUpdate(initialCustomerInfo);

      console.log('🍎 RevenueCat configuration complete!');

    } catch (e: any) {
      console.error('🍎 Failed to initialize RevenueCat:', e);
      setState(prev => ({
        ...prev,
        isAvailable: false,
        error: e.message || 'Failed to initialize subscription system.',
      }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user, handleCustomerInfoUpdate]);

  // Purchase subscription
  const purchaseSubscription = useCallback(async () => {
    try {
      console.log('🍎 Starting purchase process...');
      
      if (!state.isAvailable) throw new Error('Subscription system not available.');
      if (!state.currentOffering) throw new Error('No current offering found to purchase from.');
      const pkg = state.currentOffering.availablePackages.find((p: any) => p.identifier === PACKAGE_IDENTIFIER);
      if (!pkg) throw new Error('Subscription package not found.');
      if (!user) throw new Error('Please log in to purchase a subscription.');

      setState(prev => ({ ...prev, isProcessing: true, error: null }));
      console.log('🍎 Initiating purchase for package:', pkg.identifier);

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      console.log('🍎 Purchase completed for package:', pkg.identifier);
      handleCustomerInfoUpdate(customerInfo);

    } catch (e: any) {
      console.error('🍎 Purchase failed:', e);
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
      console.log('🍎 Restoring purchases...');

      const { customerInfo } = await Purchases.restorePurchases();
      console.log('🍎 Purchases restored. Customer Info:', customerInfo);
      handleCustomerInfoUpdate(customerInfo);

      if (customerInfo.entitlements.active && customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID]) {
        toast({ title: "Purchases Restored", description: "Your premium subscription has been restored!", variant: "default" });
      } else {
        toast({ title: "No Active Purchases", description: "No active subscriptions found to restore.", variant: "default" });
      }
    } catch (e: any) {
      console.error('🍎 Restore failed:', e);
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
    console.log('🍎 useRevenueCat useEffect triggered, user:', user?.id);
    configureRevenueCat();

    return () => {
      console.log('🍎 Cleaning up RevenueCat listeners');
      // Note: RevenueCat Capacitor plugin handles cleanup automatically
    };
  }, [configureRevenueCat]);

  return {
    ...state,
    purchaseSubscription,
    restorePurchases,
  };
};