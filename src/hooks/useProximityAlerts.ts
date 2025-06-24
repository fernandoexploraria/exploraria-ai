
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProximityAlert, ProximitySettings, UserLocation } from '@/types/proximityAlerts';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

export const useProximityAlerts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);
  const [proximitySettings, setProximitySettings] = useState<ProximitySettings | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isMountedRef = useRef(true);
  const channelRef = useRef<any>(null);

  // Load proximity settings on user change
  useEffect(() => {
    if (!user?.id) {
      setProximitySettings(null);
      setIsLoading(false);
      return;
    }

    loadProximitySettings();
    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        console.log('Cleaning up proximity settings subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]);

  // Load proximity alerts on user change
  useEffect(() => {
    if (user) {
      loadProximityAlerts();
    }
  }, [user]);

  const setupRealtimeSubscription = () => {
    if (!user?.id || channelRef.current) return;

    console.log('Setting up proximity settings subscription for user:', user.id);
    
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
            console.log('Setting proximity settings from real-time update:', settings);
            setProximitySettings(settings);
          } else if (payload.eventType === 'DELETE') {
            setProximitySettings(null);
          }
        }
      )
      .subscribe((status) => {
        console.log('Proximity settings subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Proximity settings subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Proximity settings channel subscription error');
        } else if (status === 'TIMED_OUT') {
          console.error('Proximity settings channel subscription timed out');
        }
      });

    channelRef.current = channel;
  };

  const loadProximitySettings = async () => {
    if (!user) return;

    console.log('Loading proximity settings for user:', user.id);
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
        setProximitySettings(settings);
      } else {
        console.log('No proximity settings found for user, will be auto-created on first update');
        setProximitySettings(null);
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
    if (!user) {
      console.error('No user found, cannot update proximity settings');
      return;
    }

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
      
      // Update local state immediately
      if (data && data[0]) {
        const updatedSettings: ProximitySettings = {
          id: data[0].id,
          user_id: data[0].user_id,
          is_enabled: data[0].is_enabled,
          default_distance: data[0].default_distance,
          created_at: data[0].created_at,
          updated_at: data[0].updated_at,
        };
        console.log('Setting updated proximity settings:', updatedSettings);
        setProximitySettings(updatedSettings);
      }
      
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
    setProximitySettings,
    setUserLocation: updateUserLocation,
    loadProximitySettings,
    loadProximityAlerts,
    updateProximityEnabled,
    updateDefaultDistance,
  };
};
