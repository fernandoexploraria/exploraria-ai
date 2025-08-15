import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProximityAlert, ProximitySettings, UserLocation } from '@/types/proximityAlerts';
import { useAuth } from '@/components/AuthProvider';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { Landmark } from '@/data/landmarks';

// Enhanced connection status tracking
interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'failed' | 'polling';
  lastConnectionTime: number | null;
  consecutiveFailures: number;
  isPollingActive: boolean;
  lastDataUpdate: number | null;
}

// Global state management for proximity settings with enhanced connection tracking
const globalProximityState = {
  settings: null as ProximitySettings | null,
  subscribers: new Set<(settings: ProximitySettings | null) => void>(),
  channel: null as any,
  isSubscribed: false,
  currentUserId: null as string | null,
  isLoading: false,
  // Phase 1: Retry state
  retryCount: 0,
  retryTimeout: null as NodeJS.Timeout | null,
  maxRetries: 5,
  // Phase 2: Enhanced connection management
  connectionStatus: {
    status: 'disconnected',
    lastConnectionTime: null,
    consecutiveFailures: 0,
    isPollingActive: false,
    lastDataUpdate: null
  } as ConnectionStatus,
  pollingInterval: null as NodeJS.Timeout | null,
  reconnectionAttemptTimeout: null as NodeJS.Timeout | null
};

const MINIMUM_GAP = 25; // minimum gap in meters between tiers
const NOTIFICATION_OUTER_GAP = 50; // minimum gap between notification and outer distance
const POLLING_INTERVAL = 30000; // 30 seconds base polling
const ACTIVE_POLLING_INTERVAL = 10000; // 10 seconds when changes detected
const RECONNECTION_ATTEMPT_INTERVAL = 120000; // 2 minutes
const CIRCUIT_BREAKER_THRESHOLD = 3; // Switch to polling after 3 consecutive failures

const notifySubscribers = (settings: ProximitySettings | null) => {
  console.log('📢 Notifying all subscribers with settings:', settings);
  globalProximityState.settings = settings;
  globalProximityState.connectionStatus.lastDataUpdate = Date.now();
  globalProximityState.subscribers.forEach(callback => callback(settings));
};

// Phase 2: Update connection status and notify subscribers
const updateConnectionStatus = (status: ConnectionStatus['status'], resetFailures = false) => {
  const now = Date.now();
  globalProximityState.connectionStatus.status = status;
  
  if (status === 'connected') {
    globalProximityState.connectionStatus.lastConnectionTime = now;
    if (resetFailures) {
      globalProximityState.connectionStatus.consecutiveFailures = 0;
    }
  } else if (status === 'failed') {
    globalProximityState.connectionStatus.consecutiveFailures++;
  } else if (status === 'polling') {
    globalProximityState.connectionStatus.isPollingActive = true;
  }
  
  
};

// Phase 2: Polling fallback mechanism
const startPollingFallback = async (userId: string) => {
  updateConnectionStatus('polling');
  
  const pollData = async () => {
    try {
      const { data, error } = await supabase
        .from('proximity_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        return;
      }

      if (data) {
        const settings: ProximitySettings = {
          id: data.id,
          user_id: data.user_id,
          notification_distance: data.notification_distance,
          outer_distance: data.outer_distance,
          card_distance: data.card_distance,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        
        // Check if data has changed by comparing updated_at
        const currentSettings = globalProximityState.settings;
        const hasChanged = !currentSettings || 
          new Date(settings.updated_at || '').getTime() !== new Date(currentSettings.updated_at || '').getTime();
        
        if (hasChanged) {
          console.log('📊 Polling detected changes, notifying subscribers');
          notifySubscribers(settings);
          
          // Switch to more frequent polling for a while
          if (globalProximityState.pollingInterval) {
            clearInterval(globalProximityState.pollingInterval);
            globalProximityState.pollingInterval = setInterval(pollData, ACTIVE_POLLING_INTERVAL);
            
            // Switch back to normal polling after 2 minutes
            setTimeout(() => {
              if (globalProximityState.pollingInterval) {
                clearInterval(globalProximityState.pollingInterval);
                globalProximityState.pollingInterval = setInterval(pollData, POLLING_INTERVAL);
              }
            }, RECONNECTION_ATTEMPT_INTERVAL);
          }
        }
      } else {
        notifySubscribers(null);
      }
    } catch (error) {
      console.error('❌ Polling failed:', error);
    }
  };

  // Start polling
  await pollData(); // Initial poll
  globalProximityState.pollingInterval = setInterval(pollData, POLLING_INTERVAL);
  
  // Attempt to reconnect to real-time every 2 minutes
  globalProximityState.reconnectionAttemptTimeout = setInterval(() => {
    console.log('🔄 Attempting to reconnect to real-time from polling mode...');
    attemptRealTimeReconnection(userId);
  }, RECONNECTION_ATTEMPT_INTERVAL);
};

// Phase 2: Stop polling fallback
const stopPollingFallback = () => {
  console.log('🛑 Stopping polling fallback');
  
  if (globalProximityState.pollingInterval) {
    clearInterval(globalProximityState.pollingInterval);
    globalProximityState.pollingInterval = null;
  }
  
  if (globalProximityState.reconnectionAttemptTimeout) {
    clearInterval(globalProximityState.reconnectionAttemptTimeout);
    globalProximityState.reconnectionAttemptTimeout = null;
  }
  
  globalProximityState.connectionStatus.isPollingActive = false;
};

// Phase 2: Attempt to reconnect to real-time
const attemptRealTimeReconnection = (userId: string) => {
  // Clean up existing channel
  if (globalProximityState.channel) {
    supabase.removeChannel(globalProximityState.channel);
    globalProximityState.channel = null;
    globalProximityState.isSubscribed = false;
  }
  
  // Reset retry count for fresh attempt
  globalProximityState.retryCount = 0;
  
  // Try to create new real-time subscription
  createProximitySettingsSubscription(userId, async () => {
    // On successful reconnection, stop polling
    if (globalProximityState.connectionStatus.status === 'connected') {
      stopPollingFallback();
    }
  });
};

// Phase 1: Add exponential backoff reconnection function (enhanced in Phase 2)
const reconnectWithBackoff = (userId: string, loadProximitySettingsFunc: () => Promise<void>) => {
  // Phase 2: Check if we should switch to polling instead
  if (globalProximityState.connectionStatus.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    console.log(`🚨 Circuit breaker triggered (${globalProximityState.connectionStatus.consecutiveFailures} failures), switching to polling fallback`);
    startPollingFallback(userId);
    return;
  }

  if (globalProximityState.retryCount >= globalProximityState.maxRetries) {
    console.error(`❌ Max retries (${globalProximityState.maxRetries}) exceeded for proximity settings subscription`);
    // Phase 2: Fall back to polling after max retries
    startPollingFallback(userId);
    return;
  }

  // Calculate exponential backoff delay: 1s, 2s, 4s, 8s, 16s, then cap at 30s
  const baseDelay = 1000; // 1 second
  const delay = Math.min(baseDelay * Math.pow(2, globalProximityState.retryCount), 30000);
  
  console.log(`🔄 Scheduling proximity settings reconnection attempt ${globalProximityState.retryCount + 1}/${globalProximityState.maxRetries} in ${delay}ms`);
  updateConnectionStatus('connecting');
  
  globalProximityState.retryTimeout = setTimeout(async () => {
    globalProximityState.retryCount++;
    
    // Clean up existing failed channel
    if (globalProximityState.channel) {
      console.log('🧹 Cleaning up failed proximity settings channel before retry');
      supabase.removeChannel(globalProximityState.channel);
      globalProximityState.channel = null;
      globalProximityState.isSubscribed = false;
    }
    
    // Create new subscription
    createProximitySettingsSubscription(userId, loadProximitySettingsFunc);
  }, delay);
};

// Phase 1: Extract subscription creation logic (enhanced in Phase 2)
const createProximitySettingsSubscription = (userId: string, loadProximitySettingsFunc: () => Promise<void>) => {
  console.log('📡 Creating new proximity settings subscription for user:', userId);
  updateConnectionStatus('connecting');
  
  // Clean up existing channel first
  if (globalProximityState.channel) {
    console.log('🧹 Cleaning up existing proximity settings channel before creating new one');
    supabase.removeChannel(globalProximityState.channel);
    globalProximityState.channel = null;
    globalProximityState.isSubscribed = false;
  }
  
  const channelName = `proximity-settings-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const channel = supabase.channel(channelName);
  
  // Store the channel reference immediately to prevent multiple subscriptions
  globalProximityState.channel = channel;
  
  // Configure the channel with event handlers
  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'proximity_settings',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('🔄 Real-time proximity settings update received:', payload);
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        const settings: ProximitySettings = {
          id: payload.new.id,
          user_id: payload.new.user_id,
          notification_distance: payload.new.notification_distance,
          outer_distance: payload.new.outer_distance,
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
  );

  // Subscribe to the channel
  channel.subscribe((status) => {
    console.log('📡 Proximity settings subscription status:', status);
    if (status === 'SUBSCRIBED') {
      globalProximityState.isSubscribed = true;
      // Phase 1: Reset retry count on successful connection
      globalProximityState.retryCount = 0;
      if (globalProximityState.retryTimeout) {
        clearTimeout(globalProximityState.retryTimeout);
        globalProximityState.retryTimeout = null;
      }
      // Phase 2: Update connection status and stop any polling
      updateConnectionStatus('connected', true);
      stopPollingFallback();
      console.log('✅ Proximity settings subscription successful, retry count reset');
      // Load initial data after successful subscription
      loadProximitySettingsFunc();
    } else if (status === 'CHANNEL_ERROR') {
      console.error('❌ Proximity settings channel subscription error');
      globalProximityState.isSubscribed = false;
      updateConnectionStatus('failed');
      // Phase 1: Trigger reconnection on channel error
      reconnectWithBackoff(userId, loadProximitySettingsFunc);
    } else if (status === 'TIMED_OUT') {
      console.error('⏰ Proximity settings channel subscription timed out');
      globalProximityState.isSubscribed = false;
      updateConnectionStatus('failed');
      // Phase 1: Trigger reconnection on timeout
      reconnectWithBackoff(userId, loadProximitySettingsFunc);
    }
  });
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

  // Get landmarks from TOP_LANDMARKS array (includes tour landmarks)
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
      // Phase 1: Reset retry state on user change
      globalProximityState.retryCount = 0;
      if (globalProximityState.retryTimeout) {
        clearTimeout(globalProximityState.retryTimeout);
        globalProximityState.retryTimeout = null;
      }
      // Phase 2: Stop polling and reset connection status
      stopPollingFallback();
      updateConnectionStatus('disconnected', true);
      globalProximityState.settings = null;
    }

    globalProximityState.currentUserId = user.id;

    // Only create subscription if none exists
    if (!globalProximityState.channel && !globalProximityState.isSubscribed && !globalProximityState.connectionStatus.isPollingActive) {
      // Phase 1: Use new subscription creation function
      createProximitySettingsSubscription(user.id, loadProximitySettings);
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
        last_triggered: item.last_triggered || undefined,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      setProximityAlerts(alerts);
    } catch (error) {
      console.error('Error in loadProximityAlerts:', error);
    }
  };


  const updateDistanceSetting = useCallback(async (distanceType: 'notification_distance' | 'outer_distance' | 'card_distance', distance: number) => {
    console.log('🎯 updateDistanceSetting called with:', { distanceType, distance, userId: user?.id });
    
    if (!user) {
      console.log('❌ No user available for updateDistanceSetting');
      throw new Error('No user available');
    }

    // Get current settings to validate against
    const currentSettings = globalProximityState.settings;
    
    if (!currentSettings) {
      console.log('❌ No current settings available for updateDistanceSetting');
      throw new Error('No proximity settings found');
    }

    const currentNotification = currentSettings.notification_distance;
    const currentOuter = currentSettings.outer_distance;
    const currentCard = currentSettings.card_distance;

    // Create the new distance configuration
    const newDistances = {
      notification_distance: distanceType === 'notification_distance' ? distance : currentNotification,
      outer_distance: distanceType === 'outer_distance' ? distance : currentOuter,
      card_distance: distanceType === 'card_distance' ? distance : currentCard,
    };

    // Enhanced validation with refined hierarchy: outer_distance ≥ notification_distance + 50m ≥ card_distance + 25m
    if (newDistances.outer_distance < newDistances.notification_distance + NOTIFICATION_OUTER_GAP) {
      const error = new Error(`Outer distance must be at least ${NOTIFICATION_OUTER_GAP}m greater than notification distance`);
      console.error('❌ Distance validation failed:', error.message);
      throw error;
    }

    if (newDistances.notification_distance < newDistances.card_distance + MINIMUM_GAP) {
      const error = new Error(`Notification distance must be at least ${MINIMUM_GAP}m greater than card distance`);
      console.error('❌ Distance validation failed:', error.message);
      throw error;
    }

    console.log('✅ Distance validation passed with minimum gaps:', newDistances);

    setIsSaving(true);
    try {
      console.log('💾 Making database request to update distance setting...');
      
      const updateData = {
        user_id: user.id,
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

  // Phase 2: Manual reconnection function
  const forceReconnect = useCallback(() => {
    if (!user?.id) return;
    
    console.log('🔄 Manual reconnection triggered');
    
    // Stop any existing polling
    stopPollingFallback();
    
    // Clean up existing connection
    if (globalProximityState.channel) {
      supabase.removeChannel(globalProximityState.channel);
      globalProximityState.channel = null;
      globalProximityState.isSubscribed = false;
    }
    
    // Reset connection state
    globalProximityState.retryCount = 0;
    updateConnectionStatus('connecting', true);
    
    // Attempt fresh connection
    createProximitySettingsSubscription(user.id, loadProximitySettings);
  }, [user?.id]);

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
        // Phase 1: Clean up retry state
        globalProximityState.retryCount = 0;
        if (globalProximityState.retryTimeout) {
          clearTimeout(globalProximityState.retryTimeout);
          globalProximityState.retryTimeout = null;
        }
        // Phase 2: Clean up polling and connection state
        stopPollingFallback();
        updateConnectionStatus('disconnected', true);
      }
    };
  }, []);

  return {
    proximityAlerts,
    proximitySettings,
    userLocation,
    isLoading,
    isSaving,
    // Phase 2: Connection status and manual controls
    connectionStatus: globalProximityState.connectionStatus,
    forceReconnect,
    // Keep these for compatibility
    combinedLandmarks,
    setProximityAlerts,
    setProximitySettings: notifySubscribers,
    setUserLocation: updateUserLocation,
    loadProximitySettings,
    loadProximityAlerts,
    
    updateDistanceSetting,
  };
};
