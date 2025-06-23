
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProximitySettings, UserLocation } from '@/types/proximityAlerts';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useProximityDetection } from './useProximityDetection';
import { useNotificationHistory } from './useNotificationHistory';

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

export const useProximityAlerts = (isLocationTracking: boolean = false) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [proximitySettings, setProximitySettings] = useState<ProximitySettings | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isMountedRef = useRef(true);

  // Initialize proximity detection
  const { checkProximity } = useProximityDetection({ 
    proximitySettings, 
    isLocationTracking 
  });

  // Get notification history
  const { notifications, isLoading: notificationsLoading } = useNotificationHistory();

  // Subscribe to global proximity settings state
  useEffect(() => {
    if (!user) {
      setProximitySettings(null);
      return;
    }

    const updateSettings = (settings: ProximitySettings | null) => {
      if (isMountedRef.current) {
        setProximitySettings(settings);
      }
    };
    
    globalProximityState.subscribers.add(updateSettings);
    
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

    if (globalProximityState.currentUserId && globalProximityState.currentUserId !== user.id) {
      console.log('User changed, cleaning up previous proximity settings subscription');
      if (globalProximityState.channel) {
        supabase.removeChannel(globalProximityState.channel);
        globalProximityState.channel = null;
        globalProximityState.isSubscribed = false;
      }
    }

    globalProximityState.currentUserId = user.id;

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
      loadProximitySettings();
    }

    return () => {
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

  const updateProximityEnabled = async (enabled: boolean) => {
    if (!user || !proximitySettings) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('proximity_settings')
        .update({
          is_enabled: enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating proximity enabled status:', error);
        toast({
          title: "Error",
          description: "Failed to update proximity settings. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    } catch (error) {
      console.error('Error in updateProximityEnabled:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const updateDefaultDistance = async (distance: number) => {
    if (!user || !proximitySettings) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('proximity_settings')
        .update({
          default_distance: distance,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating default distance:', error);
        toast({
          title: "Error",
          description: "Failed to update default distance. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    } catch (error) {
      console.error('Error in updateDefaultDistance:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const updateUserLocation = useCallback((location: UserLocation) => {
    setUserLocation(location);
    // Trigger proximity check when location updates
    if (proximitySettings?.is_enabled && isLocationTracking) {
      checkProximity(location);
    }
  }, [proximitySettings, isLocationTracking, checkProximity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    proximitySettings,
    userLocation,
    notifications,
    isLoading,
    isSaving,
    notificationsLoading,
    setUserLocation: updateUserLocation,
    loadProximitySettings,
    updateProximityEnabled,
    updateDefaultDistance,
    checkProximity,
  };
};
