
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProximityAlert, ProximitySettings, UserLocation } from '@/types/proximityAlerts';
import { useAuth } from '@/components/AuthProvider';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { Landmark } from '@/data/landmarks';

// Simplified state management - no complex real-time subscriptions
const globalProximityState = {
  settings: null as ProximitySettings | null,
  subscribers: new Set<(settings: ProximitySettings | null) => void>(),
  currentUserId: null as string | null,
  isLoading: false,
};

const MINIMUM_GAP = 25; // minimum gap in meters between tiers
const NOTIFICATION_OUTER_GAP = 50; // minimum gap between notification and outer distance

const notifySubscribers = (settings: ProximitySettings | null) => {
  console.log('📢 Notifying proximity subscribers:', settings);
  globalProximityState.settings = settings;
  globalProximityState.subscribers.forEach(callback => callback(settings));
};

// Convert TopLandmark to Landmark format
const convertTopLandmarkToLandmark = (topLandmark: any): Landmark => {
  return {
    id: `top-${topLandmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: topLandmark.name,
    coordinates: topLandmark.coordinates,
    description: topLandmark.description
  };
};

export const useProximityAlerts = () => {
  const { user } = useAuth();
  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);
  const [proximitySettings, setProximitySettings] = useState<ProximitySettings | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isMountedRef = useRef(true);

  // Get landmarks from TOP_LANDMARKS array
  const combinedLandmarks = TOP_LANDMARKS.map(convertTopLandmarkToLandmark);

  // Subscribe to global proximity settings state
  useEffect(() => {
    if (!user) {
      setProximitySettings(null);
      return;
    }

    // Add this component as a subscriber
    const updateSettings = (settings: ProximitySettings | null) => {
      if (isMountedRef.current) {
        console.log('🔄 Component received proximity settings:', settings);
        setProximitySettings(settings);
      }
    };
    
    globalProximityState.subscribers.add(updateSettings);
    
    // Set initial state if already available and for the same user
    if (globalProximityState.settings && globalProximityState.currentUserId === user.id) {
      console.log('🔄 Setting initial proximity state:', globalProximityState.settings);
      setProximitySettings(globalProximityState.settings);
    }

    return () => {
      globalProximityState.subscribers.delete(updateSettings);
    };
  }, [user]);

  // Load proximity settings (simplified - no complex real-time)
  useEffect(() => {
    if (!user?.id) {
      setProximitySettings(null);
      setIsLoading(false);
      return;
    }

    // If user changed, reset state
    if (globalProximityState.currentUserId && globalProximityState.currentUserId !== user.id) {
      console.log('👤 User changed, resetting proximity settings');
      globalProximityState.settings = null;
    }

    globalProximityState.currentUserId = user.id;

    // Load settings if not already loaded for this user
    if (!globalProximityState.settings || globalProximityState.currentUserId !== user.id) {
      loadProximitySettings();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [user?.id]);

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
        const settings: ProximitySettings = {
          id: data.id,
          user_id: data.user_id,
          is_enabled: data.is_enabled,
          notification_distance: data.notification_distance,
          outer_distance: data.outer_distance,
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

  const updateProximityEnabled = useCallback(async (enabled: boolean) => {
    console.log('🎯 updateProximityEnabled called with:', { enabled, userId: user?.id });
    
    if (!user) {
      console.log('❌ No user available for updateProximityEnabled');
      throw new Error('No user available');
    }

    setIsSaving(true);
    
    try {
      const currentSettings = globalProximityState.settings;
      
      const updateData: any = {
        user_id: user.id,
        is_enabled: enabled,
        updated_at: new Date().toISOString(),
      };

      // Use current settings or defaults
      if (currentSettings) {
        updateData.notification_distance = currentSettings.notification_distance;
        updateData.outer_distance = currentSettings.outer_distance;
        updateData.card_distance = currentSettings.card_distance;
      } else {
        // Use default values
        updateData.notification_distance = 100;
        updateData.outer_distance = 250;
        updateData.card_distance = 50;
      }

      const { error } = await supabase
        .from('proximity_settings')
        .upsert(updateData, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('❌ Database error updating proximity enabled status:', error);
        throw error;
      }

      console.log('✅ Successfully updated proximity enabled status to:', enabled);
      
      // Manually update the global state since we're not using real-time
      const updatedSettings = { ...updateData, id: currentSettings?.id };
      notifySubscribers(updatedSettings);
      
    } catch (error) {
      console.error('❌ Error in updateProximityEnabled:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const updateDistanceSetting = useCallback(async (distanceType: 'notification_distance' | 'outer_distance' | 'card_distance', distance: number) => {
    console.log('🎯 updateDistanceSetting called with:', { distanceType, distance, userId: user?.id });
    
    if (!user) {
      throw new Error('No user available');
    }

    const currentSettings = globalProximityState.settings;
    
    if (!currentSettings) {
      throw new Error('No proximity settings found');
    }

    // Validation logic
    const newDistances = {
      notification_distance: distanceType === 'notification_distance' ? distance : currentSettings.notification_distance,
      outer_distance: distanceType === 'outer_distance' ? distance : currentSettings.outer_distance,
      card_distance: distanceType === 'card_distance' ? distance : currentSettings.card_distance,
    };

    if (newDistances.outer_distance < newDistances.notification_distance + NOTIFICATION_OUTER_GAP) {
      throw new Error(`Outer distance must be at least ${NOTIFICATION_OUTER_GAP}m greater than notification distance`);
    }

    if (newDistances.notification_distance < newDistances.card_distance + MINIMUM_GAP) {
      throw new Error(`Notification distance must be at least ${MINIMUM_GAP}m greater than card distance`);
    }

    setIsSaving(true);
    try {
      const updateData = {
        user_id: user.id,
        is_enabled: currentSettings.is_enabled,
        notification_distance: newDistances.notification_distance,
        outer_distance: newDistances.outer_distance,
        card_distance: newDistances.card_distance,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('proximity_settings')
        .upsert(updateData, {
          onConflict: 'user_id'
        });

      if (error) {
        throw error;
      }

      console.log('✅ Successfully updated distance setting:', distanceType, distance);
      
      // Manually update the global state
      const updatedSettings = { ...updateData, id: currentSettings.id };
      notifySubscribers(updatedSettings);
      
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
      if (subscriberCount === 0) {
        console.log('🧹 No more proximity subscribers, cleaning up global state');
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
    // Simplified connection status - always healthy in basic mode
    connectionStatus: {
      status: 'connected' as const,
      lastConnectionTime: Date.now(),
      consecutiveFailures: 0,
      isPollingActive: false,
      lastDataUpdate: Date.now()
    },
    forceReconnect: () => {}, // No-op in simplified mode
    combinedLandmarks,
    setProximityAlerts,
    setProximitySettings: notifySubscribers,
    setUserLocation: updateUserLocation,
    loadProximitySettings,
    updateProximityEnabled,
    updateDistanceSetting,
  };
};
