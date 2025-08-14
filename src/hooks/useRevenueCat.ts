import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Purchases, PurchasesOffering, PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

export interface RevenueCatState {
  isAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  isProcessing: boolean;
  offerings: PurchasesOffering[] | null;
  currentOffering: PurchasesOffering | null;
  packages: PurchasesPackage[] | null;
  isSubscribed: boolean;
}

export const useRevenueCat = () => {
  const [state, setState] = useState<RevenueCatState>({
    isAvailable: false,
    isLoading: true,
    error: null,
    isProcessing: false,
    offerings: null,
    currentOffering: null,
    packages: null,
    isSubscribed: false,
  });

  const { user } = useAuth();
  const { toast } = useToast();

  const checkSubscriptionStatus = useCallback(async () => {
    try {
      const { customerInfo } = await Purchases.getCustomerInfo();
      const isSubscribed = customerInfo.entitlements.active['premium'] !== undefined;
      
      setState(prev => ({ ...prev, isSubscribed }));
      
      console.log('🔄 RevenueCat subscription status:', { isSubscribed, entitlements: customerInfo.entitlements });
      
      return isSubscribed;
    } catch (error) {
      console.error('❌ Failed to check subscription status:', error);
      return false;
    }
  }, []);

  const initializeRevenueCat = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      if (!Capacitor.isNativePlatform()) {
        console.log('🔄 RevenueCat: Not on native platform');
        setState(prev => ({ 
          ...prev, 
          isAvailable: false, 
          isLoading: false, 
          error: 'RevenueCat is only available on native platforms' 
        }));
        return;
      }

      // Fetch RevenueCat API key from Supabase edge function
      console.log('🔑 Fetching RevenueCat configuration...');
      const { data: configData, error: configError } = await supabase.functions.invoke('get-revenuecat-config');
      
      if (configError || !configData?.publicKey) {
        throw new Error(configError?.message || 'Failed to get RevenueCat configuration');
      }

      const apiKey = configData.publicKey;
      console.log('✅ RevenueCat API key fetched successfully');

      await Purchases.configure({
        apiKey,
        appUserID: user?.id || undefined, // Optional: link to your user system
      });

      console.log('✅ RevenueCat configured successfully');

      // Fetch available offerings
      const offerings = await Purchases.getOfferings();
      console.log('📦 RevenueCat offerings:', offerings);

      const currentOffering = offerings.current;
      const packages = currentOffering?.availablePackages || null;

      if (!currentOffering || !packages || packages.length === 0) {
        console.warn('⚠️ No offerings or packages found. Make sure you have configured products in RevenueCat dashboard.');
      }

      setState(prev => ({
        ...prev,
        isAvailable: true,
        isLoading: false,
        offerings: offerings.all ? Object.values(offerings.all) : null,
        currentOffering,
        packages,
      }));

      // Check initial subscription status
      await checkSubscriptionStatus();

    } catch (error: any) {
      console.error('❌ RevenueCat initialization failed:', error);
      setState(prev => ({
        ...prev,
        isAvailable: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize RevenueCat',
      }));
    }
  }, [user, checkSubscriptionStatus]);

  const purchasePackage = useCallback(async (packageToPurchase: PurchasesPackage) => {
    try {
      setState(prev => ({ ...prev, isProcessing: true, error: null }));

      console.log('🛒 Starting purchase for package:', packageToPurchase.identifier);

      const { customerInfo } = await Purchases.purchasePackage({ aPackage: packageToPurchase });
      
      console.log('✅ Purchase completed:', customerInfo);

      // Check if the user now has the premium entitlement
      const isSubscribed = customerInfo.entitlements.active['premium'] !== undefined;
      
      setState(prev => ({ ...prev, isSubscribed, isProcessing: false }));

      if (isSubscribed) {
        toast({
          title: "Subscription Activated! 🎉",
          description: "Your premium subscription is now active.",
        });

        // Dispatch event to notify other parts of the app
        window.dispatchEvent(new CustomEvent('subscription-updated'));
      } else {
        throw new Error('Purchase completed but subscription not activated');
      }

    } catch (error: any) {
      console.error('❌ Purchase failed:', error);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Purchase failed' 
      }));
      
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : 'Failed to complete purchase',
        variant: "destructive"
      });
    }
  }, [toast]);

  const restorePurchases = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isProcessing: true, error: null }));

      console.log('🔄 Restoring purchases...');
      
      const { customerInfo } = await Purchases.restorePurchases();
      const isSubscribed = customerInfo.entitlements.active['premium'] !== undefined;
      
      setState(prev => ({ ...prev, isSubscribed, isProcessing: false }));

      if (isSubscribed) {
        toast({
          title: "Purchases Restored! 🎉",
          description: "Your subscription has been restored.",
        });
        
        window.dispatchEvent(new CustomEvent('subscription-updated'));
      } else {
        toast({
          title: "No Active Subscription",
          description: "No active subscription found to restore.",
        });
      }

    } catch (error: any) {
      console.error('❌ Restore failed:', error);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to restore purchases' 
      }));
      
      toast({
        title: "Restore Failed",
        description: error instanceof Error ? error.message : 'Failed to restore purchases',
        variant: "destructive"
      });
    }
  }, [toast]);

  // Initialize when component mounts or user changes
  useEffect(() => {
    initializeRevenueCat();
  }, [initializeRevenueCat]);

  return {
    ...state,
    purchasePackage,
    restorePurchases,
    checkSubscriptionStatus,
    refresh: initializeRevenueCat,
  };
};