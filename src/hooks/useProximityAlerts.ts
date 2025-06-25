import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProximityAlert, ProximitySettings, UserLocation } from '@/types/proximityAlerts';
import { useAuth } from '@/components/AuthProvider';
import { useCombinedLandmarks } from '@/hooks/useCombinedLandmarks';

// Global state management for proximity settings
const globalProximityState = {
  settings: null as ProximitySettings | null,
  subscribers: new Set<(settings: ProximitySettings | null) => void>(),
  channel: null as any,
  isSubscribed: false,
  currentUserId: null as string | null,
  isLoading: false
};

const MINIMUM_GAP = 25; // minimum gap in meters between tiers

const notifySubscribers = (settings: ProximitySettings | null) => {
  console.log('📢 Notifying all subscribers with settings:', settings);
  globalProximityState.settings = settings;
  globalProximityState.subscribers.forEach(callback => callback(settings));
};

export const useProximityAlerts = (tourLandmarks: any[] = []) => {
  const { user } = useAuth();
  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);
  const [proximitySettings, setProximitySettings] = useState<ProximitySettings | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isMountedRef = useRef(true);

  // Get combined landmarks (top landmarks + tour landmarks) - pass tour landmarks as parameter
  const combinedLandmarks = useCombinedLandmarks(tourLandmarks);

  // Subscribe to global proximity settings state
  useEffect(() => {
    if (!user) {
      setProximitySettings(null);
      return;
    }

    // Add this component as a subscriber
    const updateSettings = (settings: ProximitySettings | null) => {
      if (isMountedRef.current) {
        console.log('🔄 Component received settings update:', settings);
        setProximitySettings(settings);
      }
    };
    
    globalProximityState.subscribers.add(updateSettings);
    
    // Set initial state if already available and for the same user
    if (globalProximityState.settings && globalProximityState.currentUserId === user.id) {
      console.log('🔄 Setting initial state from global state:', globalProximityState.settings);
      setProximitySettings(globalProximityState.settings);
    }

    return () => {
      globalProximityState.subscribers.delete(updateSettings);
    };
  }, [user]);

  // Set up real-time subscription for proximity settings
  useEffect(() => {
    if (!user?.id) {
      setProximitySettings(null);
      setIsLoading(false);
      return;
    }

    // If user changed, clean up previous subscription
    if (globalProximityState.currentUserId && globalProximityState.currentUserId !== user.id) {
      console.log('👤 User changed, cleaning up previous proximity settings subscription');
      if (globalProximityState.channel) {
        supabase.removeChannel(globalProximityState.channel);
        globalProximityState.channel = null;
        globalProximityState.isSubscribed = false;
      }
      globalProximityState.settings = null;
    }

    globalProximityState.currentUserId = user.id;

    // Only create subscription if none exists
    if (!globalProximityState.channel && !globalProximityState.isSubscribed) {
      console.log('📡 Creating new proximity settings subscription for user:', user.id);
      
      const channelName = `proximity-settings-${user.id}`;
      
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'proximity_settings',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🔄 Real-time proximity settings update received:', payload);
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              const settings: ProximitySettings = {
                id: payload.new.id,
                user_id: payload.new.user_id,
                is_enabled: payload.new.is_enabled,
                toast_distance: payload.new.toast_distance,
                route_distance: payload.new.route_distance,
                card_distance: payload.new.card_distance,
                created_at: payload.new.created_at,
                updated_at: payload.new.updated_at,
              };
              console.log('🔄 Parsed settings from real-time update:', settings);
              notifySubscribers(settings);
            } else if (payload.eventType === 'DELETE') {
              console.log('🗑️ Settings deleted via real-time update');
              notifySubscribers(null);
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Proximity settings subscription status:', status);
          if (status === 'SUBSCRIBED') {
            globalProximityState.isSubscribed = true;
            // Load initial data after successful subscription
            loadProximitySettings();
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Proximity settings channel subscription error');
            globalProximityState.isSubscribed = false;
          } else if (status === 'TIMED_OUT') {
            console.error('⏰ Proximity settings channel subscription timed out');
            globalProximityState.isSubscribed = false;
          }
        });

      globalProximityState.channel = channel;
    } else if (globalProximityState.isSubscribed && globalProximityState.currentUserId === user.id) {
      // If subscription already exists for this user, just load data
      console.log('📡 Subscription already exists for current user, loading data');
      if (!globalProximityState.settings) {
        loadProximitySettings();
      }
    }

    return () => {
      // Don't clean up the global subscription here - let it persist
      isMountedRef.current = false;
    };
  }, [user?.id]);

  // Load proximity alerts on user change
  useEffect(() => {
    if (user) {
      loadProximityAlerts();
    }
  }, [user]);

  const loadProximitySettings = async () => {
    if (!user || globalProximityState.isLoading) return;

    globalProximityState.isLoading = true;
    setIsLoading(true);
    
    try {
      console.log('📥 Loading proximity settings for user:', user.id);
      const { data, error } = await supabase
        .from('proximity_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('❌ Error loading proximity settings:', error);
        return;
      }

      if (data) {
        // Cast the data to match our interface types
        const settings: ProximitySettings = {
          id: data.id,
          user_id: data.user_id,
          is_enabled: data.is_enabled,
          toast_distance: data.toast_distance,
          route_distance: data.route_distance,
          card_distance: data.card_distance,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        console.log('📥 Loaded proximity settings:', settings);
        notifySubscribers(settings);
      } else {
        console.log('📭 No proximity settings found for user');
        notifySubscribers(null);
      }
    } catch (error) {
      console.error('❌ Error in loadProximitySettings:', error);
    } finally {
      globalProximityState.isLoading = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const loadProximityAlerts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('proximity_alerts')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading proximity alerts:', error);
        return;
      }

      // Cast the data to match our interface types
      const alerts: ProximityAlert[] = (data || []).map(item => ({
        id: item.id,
        user_id: item.user_id,
        landmark_id: item.landmark_id,
        distance: item.distance,
        is_enabled: item.is_enabled,
        last_triggered: item.last_triggered || undefined,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      setProximityAlerts(alerts);
    } catch (error) {
      console.error('Error in loadProximityAlerts:', error);
    }
  };

  const updateProximityEnabled = useCallback(async (enabled: boolean) => {
    console.log('🎯 updateProximityEnabled function called with:', { enabled, userId: user?.id });
    
    if (!user) {
      console.log('❌ No user available for updateProximityEnabled');
      throw new Error('No user available');
    }

    console.log('📡 updateProximityEnabled proceeding with user:', user.id);
    setIsSaving(true);
    
    try {
      console.log('💾 Making database request to update proximity enabled status...');
      // Use UPSERT to ensure settings are created or updated
      const { error } = await supabase
        .from('proximity_settings')
        .upsert({
          user_id: user.id,
          is_enabled: enabled,
          toast_distance: globalProximityState.settings?.toast_distance || 100,
          route_distance: globalProximityState.settings?.route_distance || 250,
          card_distance: globalProximityState.settings?.card_distance || 50,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('❌ Database error updating proximity enabled status:', error);
        throw error;
      }

      console.log('✅ Successfully updated proximity enabled status in database to:', enabled);
      // The real-time subscription will update the state automatically
    } catch (error) {
      console.error('❌ Error in updateProximityEnabled:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const updateDistanceSetting = useCallback(async (distanceType: 'toast_distance' | 'route_distance' | 'card_distance', distance: number) => {
    console.log('🎯 updateDistanceSetting called with:', { distanceType, distance, userId: user?.id });
    
    if (!user) {
      console.log('❌ No user available for updateDistanceSetting');
      throw new Error('No user available');
    }

    // Get current settings to validate against
    const currentSettings = globalProximityState.settings;
    const currentToast = currentSettings?.toast_distance || 100;
    const currentRoute = currentSettings?.route_distance || 250;
    const currentCard = currentSettings?.card_distance || 50;

    // Create the new distance configuration
    const newDistances = {
      toast_distance: distanceType === 'toast_distance' ? distance : currentToast,
      route_distance: distanceType === 'route_distance' ? distance : currentRoute,
      card_distance: distanceType === 'card_distance' ? distance : currentCard,
    };

    // Enhanced validation with minimum gap requirement
    if (newDistances.toast_distance < newDistances.route_distance + MINIMUM_GAP) {
      const error = new Error(`Toast distance must be at least ${MINIMUM_GAP}m greater than route distance`);
      console.error('❌ Distance validation failed:', error.message);
      throw error;
    }

    if (newDistances.route_distance < newDistances.card_distance + MINIMUM_GAP) {
      const error = new Error(`Route distance must be at least ${MINIMUM_GAP}m greater than card distance`);
      console.error('❌ Distance validation failed:', error.message);
      throw error;
    }

    if (newDistances.toast_distance < newDistances.card_distance + (2 * MINIMUM_GAP)) {
      const error = new Error(`Toast distance must be at least ${2 * MINIMUM_GAP}m greater than card distance`);
      console.error('❌ Distance validation failed:', error.message);
      throw error;
    }

    console.log('✅ Distance validation passed with minimum gaps:', newDistances);

    setIsSaving(true);
    try {
      console.log('💾 Making database request to update distance setting...');
      
      const updateData = {
        user_id: user.id,
        is_enabled: currentSettings?.is_enabled || false,
        toast_distance: newDistances.toast_distance,
        route_distance: newDistances.route_distance,
        card_distance: newDistances.card_distance,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('proximity_settings')
        .upsert(updateData, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('❌ Database error updating distance setting:', error);
        throw error;
      }

      console.log('✅ Successfully updated distance setting in database:', distanceType, distance);
      // The real-time subscription will update the state automatically
    } catch (error) {
      console.error('❌ Error in updateDistanceSetting:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const updateUserLocation = (location: UserLocation) => {
    setUserLocation(location);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Clean up global subscription if no more subscribers
      const subscriberCount = globalProximityState.subscribers.size;
      if (subscriberCount === 0 && globalProximityState.channel) {
        console.log('🧹 No more proximity settings subscribers, cleaning up global subscription');
        supabase.removeChannel(globalProximityState.channel);
        globalProximityState.channel = null;
        globalProximityState.isSubscribed = false;
        globalProximityState.currentUserId = null;
        globalProximityState.settings = null;
      }
    };
  }, []);

  return {
    proximityAlerts,
    proximitySettings,
    userLocation,
    isLoading,
    isSaving,
    // Keep these for compatibility
    combinedLandmarks,
    setProximityAlerts,
    setProximitySettings: notifySubscribers,
    setUserLocation: updateUserLocation,
    loadProximitySettings,
    loadProximityAlerts,
    updateProximityEnabled,
    updateDistanceSetting,
  };
};
