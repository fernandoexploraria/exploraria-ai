
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProximityAlert, ProximitySettings, UserLocation } from '@/types/proximityAlerts';
import { getDefaultProximitySettings } from '@/utils/proximityUtils';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

// Debounce utility
const useDebounce = (callback: Function, delay: number) => {
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout>();

  const debouncedCallback = useCallback((...args: any[]) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    const newTimer = setTimeout(() => callback(...args), delay);
    setDebounceTimer(newTimer);
  }, [callback, delay, debounceTimer]);

  return debouncedCallback;
};

export const useProximityAlerts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);
  const [proximitySettings, setProximitySettings] = useState<ProximitySettings | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load proximity settings on user change
  useEffect(() => {
    if (user) {
      loadProximitySettings();
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
          unit: data.unit as 'metric' | 'imperial',
          notification_enabled: data.notification_enabled,
          sound_enabled: data.sound_enabled,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        setProximitySettings(settings);
      } else {
        // Create default settings if none exist
        const defaultSettings = getDefaultProximitySettings(user.id);
        setProximitySettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error in loadProximitySettings:', error);
    } finally {
      setIsLoading(false);
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
        unit: item.unit as 'metric' | 'imperial',
        last_triggered: item.last_triggered || undefined,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      setProximityAlerts(alerts);
    } catch (error) {
      console.error('Error in loadProximityAlerts:', error);
    }
  };

  const saveProximitySettings = async (settings: ProximitySettings) => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('proximity_settings')
        .upsert({
          ...settings,
          user_id: user.id,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error saving proximity settings:', error);
        toast({
          title: "Error",
          description: "Failed to save proximity settings. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setProximitySettings(settings);
      toast({
        title: "Settings saved",
        description: "Your proximity alert settings have been updated.",
      });
    } catch (error) {
      console.error('Error in saveProximitySettings:', error);
      toast({
        title: "Error",
        description: "Failed to save proximity settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Individual setting update functions
  const updateSetting = async (key: keyof ProximitySettings, value: any) => {
    if (!proximitySettings || !user) return;

    // Optimistic update
    const updatedSettings = {
      ...proximitySettings,
      [key]: value,
      updated_at: new Date().toISOString(),
    };
    setProximitySettings(updatedSettings);

    // Save to database
    await saveProximitySettings(updatedSettings);
  };

  // Debounced version for slider changes
  const debouncedUpdateSetting = useDebounce(updateSetting, 500);

  const updateIsEnabled = (enabled: boolean) => updateSetting('is_enabled', enabled);
  const updateDefaultDistance = (distance: number) => debouncedUpdateSetting('default_distance', distance);
  const updateUnit = (unit: 'metric' | 'imperial') => updateSetting('unit', unit);
  const updateNotificationEnabled = (enabled: boolean) => updateSetting('notification_enabled', enabled);
  const updateSoundEnabled = (enabled: boolean) => updateSetting('sound_enabled', enabled);

  const updateUserLocation = (location: UserLocation) => {
    setUserLocation(location);
  };

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
    saveProximitySettings,
    // Individual update functions
    updateIsEnabled,
    updateDefaultDistance,
    updateUnit,
    updateNotificationEnabled,
    updateSoundEnabled,
  };
};
