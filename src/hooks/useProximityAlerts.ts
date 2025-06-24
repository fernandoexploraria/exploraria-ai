
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProximityAlert, ProximitySettings, UserLocation } from '@/types/proximityAlerts';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useCombinedLandmarks } from '@/hooks/useCombinedLandmarks';
import { useSortedLandmarks } from '@/hooks/useSortedLandmarks';
import { formatDistance } from '@/utils/proximityUtils';

// Global state management for proximity settings
const globalProximityState = {
  settings: null as ProximitySettings | null,
  subscribers: new Set<(settings: ProximitySettings | null) => void>(),
  channel: null as any,
  isSubscribed: false,
  currentUserId: null as string | null,
  isLoading: false
};

const notifySubscribers = (settings: ProximitySettings | null) => {
  console.log('📢 Notifying all subscribers with settings:', settings);
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

  // Ref to track the previously closest landmark ID for persistence
  const previousClosestLandmarkIdRef = useRef<string | null>(null);

  // Get combined landmarks (top landmarks + tour landmarks)
  const combinedLandmarks = useCombinedLandmarks();

  // Get sorted landmarks within range using the default distance
  const defaultDistance = proximitySettings?.default_distance || 100;
  const sortedLandmarks = useSortedLandmarks(
    userLocation,
    combinedLandmarks,
    defaultDistance
  );

  // Core proximity detection logic - runs every time location or settings change
  useEffect(() => {
    // Only run if proximity is enabled and we have a location
    if (!proximitySettings?.is_enabled || !userLocation || !isMountedRef.current) {
      return;
    }

    console.log('🎯 Running proximity detection...');
    console.log(`📍 Current location: ${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}`);
    console.log(`📏 Default distance: ${defaultDistance}m`);
    console.log(`🗺️ Total landmarks: ${combinedLandmarks.length}`);
    console.log(`✅ Landmarks within range: ${sortedLandmarks.length}`);

    // Get the closest landmark (first in the sorted list, already filtered by distance)
    const closestLandmark = sortedLandmarks.length > 0 ? sortedLandmarks[0] : null;
    const currentClosestId = closestLandmark?.landmark.id || null;
    const previousClosestId = previousClosestLandmarkIdRef.current;

    console.log(`🏛️ Previous closest: ${previousClosestId || 'none'}`);
    console.log(`🏛️ Current closest: ${currentClosestId || 'none'}`);

    // Compare with persisted value and handle changes
    if (currentClosestId !== previousClosestId) {
      console.log('🔄 Closest landmark changed!');

      if (currentClosestId && closestLandmark) {
        // New landmark detected - send toast
        const distance = formatDistance(closestLandmark.distance);
        console.log(`🚨 Sending toast for ${closestLandmark.landmark.name} at ${distance}`);
        
        toast({
          title: "Landmark Nearby",
          description: `${closestLandmark.landmark.name} is ${distance} away`,
        });

        // Update persisted value
        previousClosestLandmarkIdRef.current = currentClosestId;
      } else {
        // No landmarks in range - clear persisted value (no toast sent)
        console.log('🚫 No landmarks in range, clearing persisted value');
        previousClosestLandmarkIdRef.current = null;
      }
    } else {
      // Same landmark or both null - no action needed
      console.log('✅ No change in closest landmark');
    }
  }, [userLocation, proximitySettings?.is_enabled, defaultDistance, sortedLandmarks, combinedLandmarks.length, toast]);

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
                default_distance: payload.new.default_distance,
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
          default_distance: data.default_distance,
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
          default_distance: globalProximityState.settings?.default_distance || 50,
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

  const updateDefaultDistance = useCallback(async (distance: number) => {
    console.log('🎯 updateDefaultDistance called with:', { distance, userId: user?.id });
    
    if (!user) {
      console.log('❌ No user available for updateDefaultDistance');
      throw new Error('No user available');
    }

    setIsSaving(true);
    try {
      console.log('💾 Making database request to update default distance...');
      // Use UPSERT to ensure settings are created or updated
      const { error } = await supabase
        .from('proximity_settings')
        .upsert({
          user_id: user.id,
          default_distance: distance,
          is_enabled: globalProximityState.settings?.is_enabled || false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('❌ Database error updating default distance:', error);
        throw error;
      }

      console.log('✅ Successfully updated default distance in database to:', distance);
      // The real-time subscription will update the state automatically
    } catch (error) {
      console.error('❌ Error in updateDefaultDistance:', error);
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
    setProximityAlerts,
    setProximitySettings: notifySubscribers,
    setUserLocation: updateUserLocation,
    loadProximitySettings,
    loadProximityAlerts,
    updateProximityEnabled,
    updateDefaultDistance,
  };
};
