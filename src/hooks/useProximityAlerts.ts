

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProximityAlert, ProximitySettings, UserLocation } from '@/types/proximityAlerts';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

// Global state management for proximity settings
const globalProximityState = {
  settings: null as ProximitySettings | null,
  subscribers: new Set<(settings: ProximitySettings | null) => void>(),
  channel: null as any,
  isSubscribed: false,
  currentUserId: null as string | null
};

const notifySubscribers = (settings: ProximitySettings | null) => {
  globalProximityState.settings = settings;
  globalProximityState.subscribers.forEach(callback => callback(settings));
};

export const useProximityAlerts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);
  const [proximitySettings, setProximitySettings] = useState<ProximitySettings | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isMountedRef = useRef(true);

  // Subscribe to global proximity settings state
  useEffect(() => {
    if (!user) {
      setProximitySettings(null);
      return;
    }

    // Add this component as a subscriber
    const updateSettings = (settings: ProximitySettings | null) => {
      if (isMountedRef.current) {
        setProximitySettings(settings);
      }
    };
    
    globalProximityState.subscribers.add(updateSettings);
    
    // Set initial state if already available
    if (globalProximityState.settings && globalProximityState.currentUserId === user.id) {
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
      console.log('User changed, cleaning up previous proximity settings subscription');
      if (globalProximityState.channel) {
        supabase.removeChannel(globalProximityState.channel);
        globalProximityState.channel = null;
        globalProximityState.isSubscribed = false;
      }
    }

    globalProximityState.currentUserId = user.id;

    // Only create subscription if none exists
    if (!globalProximityState.channel && !globalProximityState.isSubscribed) {
      console.log('Creating new proximity settings subscription for user:', user.id);
      
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
            console.log('Real-time proximity settings update:', payload);
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              const settings: ProximitySettings = {
                id: payload.new.id,
                user_id: payload.new.user_id,
                is_enabled: payload.new.is_enabled,
                default_distance: payload.new.default_distance,
                created_at: payload.new.created_at,
                updated_at: payload.new.updated_at,
              };
              console.log('Notifying all subscribers with updated settings:', settings);
              notifySubscribers(settings);
            } else if (payload.eventType === 'DELETE') {
              notifySubscribers(null);
            }
          }
        )
        .subscribe((status) => {
          console.log('Proximity settings subscription status:', status);
          if (status === 'SUBSCRIBED') {
            globalProximityState.isSubscribed = true;
            // Load initial data after successful subscription
            loadProximitySettings();
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Proximity settings channel subscription error');
            globalProximityState.isSubscribed = false;
          } else if (status === 'TIMED_OUT') {
            console.error('Proximity settings channel subscription timed out');
            globalProximityState.isSubscribed = false;
          }
        });

      globalProximityState.channel = channel;
    } else if (globalProximityState.isSubscribed) {
      // If subscription already exists, just load data
      loadProximitySettings();
    }

    return () => {
      // Don't clean up the global subscription here - let it persist
      // Only clean up when the last subscriber unmounts
      const subscriberCount = globalProximityState.subscribers.size;
      if (subscriberCount === 0 && globalProximityState.channel) {
        console.log('No more proximity settings subscribers, cleaning up global subscription');
        supabase.removeChannel(globalProximityState.channel);
        globalProximityState.channel = null;
        globalProximityState.isSubscribed = false;
        globalProximityState.currentUserId = null;
        globalProximityState.settings = null;
      }
    };
  }, [user?.id]);

  // Load proximity alerts on user change
  useEffect(() => {
    if (user) {
      loadProximityAlerts();
    }
  }, [user]);

  const loadProximitySettings = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('proximity_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading proximity settings:', error);
        return;
      }

      if (data) {
        // Cast the data to match our interface types
        const settings: ProximitySettings = {
          id: data.id,
          user_id: data.user_id,
          is_enabled: data.is_enabled,
          default_distance: data.default_distance,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        console.log('Loaded proximity settings:', settings);
        notifySubscribers(settings);
      } else {
        // Since we now auto-create settings via trigger, this should rarely happen
        // But keep as fallback for existing users or edge cases
        console.log('No proximity settings found for user, they should be auto-created on signup');
        notifySubscribers(null);
      }
    } catch (error) {
      console.error('Error in loadProximitySettings:', error);
    } finally {
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
    if (!user) return;

    console.log('updateProximityEnabled called with:', enabled, 'for user:', user.id);
    setIsSaving(true);
    
    try {
      // Use upsert to handle both update and insert cases
      const { data, error } = await supabase
        .from('proximity_settings')
        .upsert({
          user_id: user.id,
          is_enabled: enabled,
          default_distance: proximitySettings?.default_distance ?? 50,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        })
        .select();

      if (error) {
        console.error('Error updating proximity enabled status:', error);
        toast({
          title: "Error",
          description: "Failed to update proximity settings. Please try again.",
          variant: "destructive",
        });
        throw error;
      }

      console.log('Proximity enabled status updated successfully:', enabled);
      console.log('Database response:', data);
      
      // Force reload settings to ensure we have the latest state
      await loadProximitySettings();
      
    } catch (error) {
      console.error('Error in updateProximityEnabled:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [user, proximitySettings, toast]);

  const updateDefaultDistance = useCallback(async (distance: number) => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Use upsert to handle both update and insert cases
      const { error } = await supabase
        .from('proximity_settings')
        .upsert({
          user_id: user.id,
          default_distance: distance,
          is_enabled: proximitySettings?.is_enabled ?? false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating default distance:', error);
        toast({
          title: "Error",
          description: "Failed to update default distance. Please try again.",
          variant: "destructive",
        });
        throw error;
      }

      console.log('Default distance updated successfully:', distance);
      // The real-time subscription will update the state automatically
    } catch (error) {
      console.error('Error in updateDefaultDistance:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [user, proximitySettings, toast]);

  const updateUserLocation = useCallback((location: UserLocation) => {
    setUserLocation(location);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    proximityAlerts,
    proximitySettings,
    userLocation,
    isLoading,
    isSaving,
    setProximityAlerts,
    setProximitySettings: notifySubscribers,
    setUserLocation: updateUserLocation,
    loadProximitySettings,
    loadProximityAlerts,
    updateProximityEnabled,
    updateDefaultDistance,
  };
};

