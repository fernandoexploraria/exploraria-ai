import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProximityAlert, ProximitySettings, UserLocation, GracePeriodState, MovementDetectionResult } from '@/types/proximityAlerts';
import { useAuth } from '@/components/AuthProvider';
import { TOP_LANDMARKS } from '@/data/topLandmarks';
import { Landmark } from '@/data/landmarks';
import { getGracePeriodConstants, getMovementConstants } from '@/utils/smartGracePeriod';

// Grace period constants - enhanced for smart logic
const INITIALIZATION_GRACE_PERIOD = 15000; // 15 seconds
const MOVEMENT_GRACE_PERIOD = 8000; // 8 seconds for movement-triggered grace
const APP_RESUME_GRACE_PERIOD = 5000; // 5 seconds when app resumes from background
const LOCATION_SETTLING_GRACE_PERIOD = 5000; // 5 seconds for location to stabilize

// Movement detection constants
const SIGNIFICANT_MOVEMENT_THRESHOLD = 150; // meters - clear grace period if user moves this distance
const MOVEMENT_CHECK_INTERVAL = 10000; // 10 seconds between movement checks
const BACKGROUND_DETECTION_THRESHOLD = 30000; // 30 seconds - consider app backgrounded after this

// Enhanced connection status tracking
interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'failed' | 'polling';
  lastConnectionTime: number | null;
  consecutiveFailures: number;
  isPollingActive: boolean;
  lastDataUpdate: number | null;
}

// Calculate distance between two coordinates
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Global state management for proximity settings with enhanced grace period and movement tracking
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
  reconnectionAttemptTimeout: null as NodeJS.Timeout | null,
  // Enhanced grace period state with smart logic
  gracePeriodState: {
    initializationTimestamp: null,
    gracePeriodActive: false,
    gracePeriodReason: null,
    lastMovementCheck: null,
    backgroundedAt: null,
    resumedAt: null
  } as GracePeriodState,
  // Movement tracking for smart grace period
  lastLocationForMovement: null as UserLocation | null,
  movementCheckInterval: null as NodeJS.Timeout | null,
};

// Enhanced grace period helper functions with configurable settings
const isInGracePeriod = (settings: ProximitySettings | null = null): boolean => {
  const state = globalProximityState.gracePeriodState;
  if (!state.initializationTimestamp || !state.gracePeriodActive) return false;
  
  // Check if grace period is globally disabled
  if (settings && !settings.grace_period_enabled) return false;
  
  const now = Date.now();
  const elapsed = now - state.initializationTimestamp;
  
  const gracePeriodConstants = getGracePeriodConstants(settings);
  let gracePeriodDuration = gracePeriodConstants.INITIALIZATION;
  
  if (state.gracePeriodReason === 'movement') {
    gracePeriodDuration = gracePeriodConstants.MOVEMENT;
  } else if (state.gracePeriodReason === 'app_resume') {
    gracePeriodDuration = gracePeriodConstants.APP_RESUME;
  }
  
  const isActive = elapsed < gracePeriodDuration;
  
  if (!isActive && state.gracePeriodActive) {
    // Grace period naturally expired
    console.log(`🕐 Grace period naturally expired (${state.gracePeriodReason}, ${elapsed}ms elapsed)`);
    clearGracePeriod();
  }
  
  return isActive;
};

const setGracePeriod = (reason: GracePeriodState['gracePeriodReason'], timestamp?: number) => {
  const now = timestamp || Date.now();
  console.log(`🕐 Setting grace period (${reason}) at ${new Date(now).toISOString()}`);
  
  globalProximityState.gracePeriodState = {
    ...globalProximityState.gracePeriodState,
    initializationTimestamp: now,
    gracePeriodActive: true,
    gracePeriodReason: reason
  };
  
  // Save to localStorage with reason
  try {
    localStorage.setItem('proximity_grace_period_state', JSON.stringify({
      timestamp: now,
      reason: reason,
      backgroundedAt: globalProximityState.gracePeriodState.backgroundedAt
    }));
  } catch (error) {
    console.error('Failed to save grace period state:', error);
  }
};

const clearGracePeriod = () => {
  const previousReason = globalProximityState.gracePeriodState.gracePeriodReason;
  console.log(`🕐 Clearing grace period (was: ${previousReason})`);
  
  globalProximityState.gracePeriodState = {
    initializationTimestamp: null,
    gracePeriodActive: false,
    gracePeriodReason: null,
    lastMovementCheck: null,
    backgroundedAt: null,
    resumedAt: null
  };
  
  // Remove from localStorage
  try {
    localStorage.removeItem('proximity_grace_period_state');
  } catch (error) {
    console.error('Failed to clear grace period state:', error);
  }
};

const getGracePeriodRemainingMs = (): number => {
  const state = globalProximityState.gracePeriodState;
  if (!state.initializationTimestamp) return 0;
  
  const now = Date.now();
  const elapsed = now - state.initializationTimestamp;
  
  let gracePeriodDuration = INITIALIZATION_GRACE_PERIOD;
  if (state.gracePeriodReason === 'movement') {
    gracePeriodDuration = MOVEMENT_GRACE_PERIOD;
  } else if (state.gracePeriodReason === 'app_resume') {
    gracePeriodDuration = APP_RESUME_GRACE_PERIOD;
  }
  
  return Math.max(0, gracePeriodDuration - elapsed);
};

// Smart movement detection for grace period management with configurable threshold
const checkForSignificantMovement = (currentLocation: UserLocation, settings: ProximitySettings | null = null): MovementDetectionResult => {
  const lastLocation = globalProximityState.lastLocationForMovement;
  const now = Date.now();
  
  if (!lastLocation) {
    // First location check
    globalProximityState.lastLocationForMovement = currentLocation;
    globalProximityState.gracePeriodState.lastMovementCheck = now;
    return {
      significantMovement: false,
      distance: 0,
      timeSinceLastCheck: 0,
      shouldClearGracePeriod: false
    };
  }
  
  const distance = calculateDistance(
    lastLocation.latitude, lastLocation.longitude,
    currentLocation.latitude, currentLocation.longitude
  );
  
  const timeSinceLastCheck = now - (globalProximityState.gracePeriodState.lastMovementCheck || now);
  const movementConstants = getMovementConstants(settings);
  const significantMovement = distance >= movementConstants.SIGNIFICANT_THRESHOLD;
  
  // Update tracking state
  globalProximityState.lastLocationForMovement = currentLocation;
  globalProximityState.gracePeriodState.lastMovementCheck = now;
  
  // Determine if grace period should be cleared
  const shouldClearGracePeriod = significantMovement && isInGracePeriod(settings);
  
  if (significantMovement) {
    console.log(`🚶 Significant movement detected: ${Math.round(distance)}m in ${Math.round(timeSinceLastCheck/1000)}s (threshold: ${movementConstants.SIGNIFICANT_THRESHOLD}m)`);
    if (shouldClearGracePeriod) {
      console.log(`🕐 Clearing grace period due to significant movement`);
    }
  }
  
  return {
    significantMovement,
    distance,
    timeSinceLastCheck,
    shouldClearGracePeriod
  };
};

// Smart app backgrounding detection
const handleAppVisibilityChange = () => {
  const now = Date.now();
  const isVisible = !document.hidden;
  
  if (isVisible) {
    // App resumed from background
    const backgroundedAt = globalProximityState.gracePeriodState.backgroundedAt;
    if (backgroundedAt) {
      const backgroundDuration = now - backgroundedAt;
      console.log(`📱 App resumed after ${Math.round(backgroundDuration/1000)}s in background`);
      
      // Set resume grace period if app was backgrounded for a reasonable time
      if (backgroundDuration >= BACKGROUND_DETECTION_THRESHOLD) {
        globalProximityState.gracePeriodState.resumedAt = now;
        setGracePeriod('app_resume');
      }
      
      globalProximityState.gracePeriodState.backgroundedAt = null;
    }
  } else {
    // App went to background
    console.log(`📱 App backgrounded at ${new Date(now).toISOString()}`);
    globalProximityState.gracePeriodState.backgroundedAt = now;
  }
};

// Load enhanced grace period state from localStorage
const loadGracePeriodState = () => {
  try {
    const saved = localStorage.getItem('proximity_grace_period_state');
    if (saved) {
      const state = JSON.parse(saved);
      if (state.timestamp && state.reason) {
        globalProximityState.gracePeriodState = {
          initializationTimestamp: state.timestamp,
          gracePeriodActive: true,
          gracePeriodReason: state.reason,
          lastMovementCheck: null,
          backgroundedAt: state.backgroundedAt || null,
          resumedAt: null
        };
        
        // Check if still in grace period
        if (isInGracePeriod()) {
          const remaining = getGracePeriodRemainingMs();
          console.log(`🕐 Restored grace period (${state.reason}), remaining: ${remaining}ms`);
        } else {
          // Grace period expired, clear it
          clearGracePeriod();
        }
      }
    }
  } catch (error) {
    console.error('Failed to load grace period state:', error);
    clearGracePeriod();
  }
};

// Initialize smart grace period state on module load
loadGracePeriodState();

// Set up app visibility change listener for smart backgrounding detection
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', handleAppVisibilityChange);
}

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
  
  console.log(`🔗 Connection status updated to: ${status}`, globalProximityState.connectionStatus);
};

const startPollingFallback = async (userId: string) => {
  console.log('🔄 Starting polling fallback for proximity settings');
  updateConnectionStatus('polling');
  
  const pollData = async () => {
    try {
      console.log('📊 Polling proximity settings...');
      const { data, error } = await supabase
        .from('proximity_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Polling error:', error);
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
          initialization_timestamp: data.initialization_timestamp,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        
        const currentSettings = globalProximityState.settings;
        const hasChanged = !currentSettings || 
          new Date(settings.updated_at || '').getTime() !== new Date(currentSettings.updated_at || '').getTime();
        
        if (hasChanged) {
          console.log('📊 Polling detected changes, notifying subscribers');
          notifySubscribers(settings);
          
          if (globalProximityState.pollingInterval) {
            clearInterval(globalProximityState.pollingInterval);
            globalProximityState.pollingInterval = setInterval(pollData, ACTIVE_POLLING_INTERVAL);
            
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

  await pollData();
  globalProximityState.pollingInterval = setInterval(pollData, POLLING_INTERVAL);
  
  globalProximityState.reconnectionAttemptTimeout = setInterval(() => {
    console.log('🔄 Attempting to reconnect to real-time from polling mode...');
    attemptRealTimeReconnection(userId);
  }, RECONNECTION_ATTEMPT_INTERVAL);
};

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

const attemptRealTimeReconnection = (userId: string) => {
  if (globalProximityState.channel) {
    supabase.removeChannel(globalProximityState.channel);
    globalProximityState.channel = null;
    globalProximityState.isSubscribed = false;
  }
  
  globalProximityState.retryCount = 0;
  
  createProximitySettingsSubscription(userId, async () => {
    if (globalProximityState.connectionStatus.status === 'connected') {
      stopPollingFallback();
    }
  });
};

const reconnectWithBackoff = (userId: string, loadProximitySettingsFunc: () => Promise<void>) => {
  if (globalProximityState.connectionStatus.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    console.log(`🚨 Circuit breaker triggered (${globalProximityState.connectionStatus.consecutiveFailures} failures), switching to polling fallback`);
    startPollingFallback(userId);
    return;
  }

  if (globalProximityState.retryCount >= globalProximityState.maxRetries) {
    console.error(`❌ Max retries (${globalProximityState.maxRetries}) exceeded for proximity settings subscription`);
    startPollingFallback(userId);
    return;
  }

  const baseDelay = 1000;
  const delay = Math.min(baseDelay * Math.pow(2, globalProximityState.retryCount), 30000);
  
  console.log(`🔄 Scheduling proximity settings reconnection attempt ${globalProximityState.retryCount + 1}/${globalProximityState.maxRetries} in ${delay}ms`);
  updateConnectionStatus('connecting');
  
  globalProximityState.retryTimeout = setTimeout(async () => {
    globalProximityState.retryCount++;
    
    if (globalProximityState.channel) {
      console.log('🧹 Cleaning up failed proximity settings channel before retry');
      supabase.removeChannel(globalProximityState.channel);
      globalProximityState.channel = null;
      globalProximityState.isSubscribed = false;
    }
    
    createProximitySettingsSubscription(userId, loadProximitySettingsFunc);
  }, delay);
};

const createProximitySettingsSubscription = (userId: string, loadProximitySettingsFunc: () => Promise<void>) => {
  console.log('📡 Creating new proximity settings subscription for user:', userId);
  updateConnectionStatus('connecting');
  
  const channelName = `proximity-settings-${userId}`;
  
  const channel = supabase
    .channel(channelName)
    .on(
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
            is_enabled: payload.new.is_enabled,
            notification_distance: payload.new.notification_distance,
            outer_distance: payload.new.outer_distance,
            card_distance: payload.new.card_distance,
            initialization_timestamp: payload.new.initialization_timestamp,
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
        globalProximityState.retryCount = 0;
        if (globalProximityState.retryTimeout) {
          clearTimeout(globalProximityState.retryTimeout);
          globalProximityState.retryTimeout = null;
        }
        updateConnectionStatus('connected', true);
        stopPollingFallback();
        console.log('✅ Proximity settings subscription successful, retry count reset');
        loadProximitySettingsFunc();
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Proximity settings channel subscription error');
        globalProximityState.isSubscribed = false;
        updateConnectionStatus('failed');
        reconnectWithBackoff(userId, loadProximitySettingsFunc);
      } else if (status === 'TIMED_OUT') {
        console.error('⏰ Proximity settings channel subscription timed out');
        globalProximityState.isSubscribed = false;
        updateConnectionStatus('failed');
        reconnectWithBackoff(userId, loadProximitySettingsFunc);
      }
    });

  globalProximityState.channel = channel;
};

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

  const combinedLandmarks = TOP_LANDMARKS.map(convertTopLandmarkToLandmark);

  const handleLocationUpdate = useCallback((location: UserLocation) => {
    setUserLocation(location);
    
    const currentSettings = globalProximityState.settings;
    const movementResult = checkForSignificantMovement(location, currentSettings);
    if (movementResult.shouldClearGracePeriod) {
      clearGracePeriod();
    } else if (movementResult.significantMovement && !isInGracePeriod(currentSettings)) {
      console.log(`🚶 Setting movement grace period due to ${Math.round(movementResult.distance)}m movement`);
      setGracePeriod('movement');
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setProximitySettings(null);
      return;
    }

    const updateSettings = (settings: ProximitySettings | null) => {
      if (isMountedRef.current) {
        console.log('🔄 Component received settings update:', settings);
        setProximitySettings(settings);
      }
    };
    
    globalProximityState.subscribers.add(updateSettings);
    
    if (globalProximityState.settings && globalProximityState.currentUserId === user.id) {
      console.log('🔄 Setting initial state from global state:', globalProximityState.settings);
      setProximitySettings(globalProximityState.settings);
    }

    return () => {
      globalProximityState.subscribers.delete(updateSettings);
    };
  }, [user]);

  useEffect(() => {
    if (!user?.id) {
      setProximitySettings(null);
      setIsLoading(false);
      return;
    }

    if (globalProximityState.currentUserId && globalProximityState.currentUserId !== user.id) {
      console.log('👤 User changed, cleaning up previous proximity settings subscription');
      if (globalProximityState.channel) {
        supabase.removeChannel(globalProximityState.channel);
        globalProximityState.channel = null;
        globalProximityState.isSubscribed = false;
      }
      globalProximityState.retryCount = 0;
      if (globalProximityState.retryTimeout) {
        clearTimeout(globalProximityState.retryTimeout);
        globalProximityState.retryTimeout = null;
      }
      stopPollingFallback();
      updateConnectionStatus('disconnected', true);
      globalProximityState.settings = null;
    }

    globalProximityState.currentUserId = user.id;

    if (!globalProximityState.channel && !globalProximityState.isSubscribed && !globalProximityState.connectionStatus.isPollingActive) {
      createProximitySettingsSubscription(user.id, loadProximitySettings);
    } else if (globalProximityState.isSubscribed && globalProximityState.currentUserId === user.id) {
      console.log('📡 Subscription already exists for current user, loading data');
      if (!globalProximityState.settings) {
        loadProximitySettings();
      }
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [user?.id]);

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
        const settings: ProximitySettings = {
          id: data.id,
          user_id: data.user_id,
          is_enabled: data.is_enabled,
          notification_distance: data.notification_distance,
          outer_distance: data.outer_distance,
          card_distance: data.card_distance,
          initialization_timestamp: data.initialization_timestamp,
          // Map new grace period configuration fields
          grace_period_initialization: data.grace_period_initialization,
          grace_period_movement: data.grace_period_movement,
          grace_period_app_resume: data.grace_period_app_resume,
          significant_movement_threshold: data.significant_movement_threshold,
          grace_period_enabled: data.grace_period_enabled,
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
      
      const currentSettings = globalProximityState.settings;
      
      const updateData: any = {
        user_id: user.id,
        is_enabled: enabled,
        updated_at: new Date().toISOString(),
      };

      if (currentSettings) {
        updateData.notification_distance = currentSettings.notification_distance;
        updateData.outer_distance = currentSettings.outer_distance;
        updateData.card_distance = currentSettings.card_distance;
      }

      if (enabled && (!currentSettings || !currentSettings.is_enabled)) {
        const initTimestamp = Date.now();
        setGracePeriod('initialization', initTimestamp);
        updateData.initialization_timestamp = initTimestamp;
        console.log('🕐 Proximity enabled - starting initialization grace period');
      } else if (!enabled) {
        clearGracePeriod();
        updateData.initialization_timestamp = null;
        console.log('🕐 Proximity disabled - clearing grace period');
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

      console.log('✅ Successfully updated proximity enabled status in database to:', enabled);
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
      console.log('❌ No user available for updateDistanceSetting');
      throw new Error('No user available');
    }

    const currentSettings = globalProximityState.settings;
    
    if (!currentSettings) {
      console.log('❌ No current settings available for updateDistanceSetting');
      throw new Error('No proximity settings found');
    }

    const currentNotification = currentSettings.notification_distance;
    const currentOuter = currentSettings.outer_distance;
    const currentCard = currentSettings.card_distance;

    const newDistances = {
      notification_distance: distanceType === 'notification_distance' ? distance : currentNotification,
      outer_distance: distanceType === 'outer_distance' ? distance : currentOuter,
      card_distance: distanceType === 'card_distance' ? distance : currentCard,
    };

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
        console.error('❌ Database error updating distance setting:', error);
        throw error;
      }

      console.log('✅ Successfully updated distance setting in database:', distanceType, distance);
    } catch (error) {
      console.error('❌ Error in updateDistanceSetting:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const updateUserLocation = useCallback((location: UserLocation) => {
    handleLocationUpdate(location);
  }, [handleLocationUpdate]);

  const forceReconnect = useCallback(() => {
    if (!user?.id) return;
    
    console.log('🔄 Manual reconnection triggered');
    
    stopPollingFallback();
    
    if (globalProximityState.channel) {
      supabase.removeChannel(globalProximityState.channel);
      globalProximityState.channel = null;
      globalProximityState.isSubscribed = false;
    }
    
    globalProximityState.retryCount = 0;
    updateConnectionStatus('connecting', true);
    
    createProximitySettingsSubscription(user.id, loadProximitySettings);
  }, [user?.id]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      const subscriberCount = globalProximityState.subscribers.size;
      if (subscriberCount === 0 && globalProximityState.channel) {
        console.log('🧹 No more proximity settings subscribers, cleaning up global subscription');
        supabase.removeChannel(globalProximityState.channel);
        globalProximityState.channel = null;
        globalProximityState.isSubscribed = false;
        globalProximityState.currentUserId = null;
        globalProximityState.settings = null;
        globalProximityState.retryCount = 0;
        if (globalProximityState.retryTimeout) {
          clearTimeout(globalProximityState.retryTimeout);
          globalProximityState.retryTimeout = null;
        }
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
    connectionStatus: globalProximityState.connectionStatus,
    forceReconnect,
    isInGracePeriod: isInGracePeriod(globalProximityState.settings),
    gracePeriodRemainingMs: getGracePeriodRemainingMs(),
    gracePeriodReason: globalProximityState.gracePeriodState.gracePeriodReason,
    gracePeriodState: globalProximityState.gracePeriodState,
    initializationTimestamp: globalProximityState.gracePeriodState.initializationTimestamp,
    gracePeriodActive: globalProximityState.gracePeriodState.gracePeriodActive,
    clearGracePeriod,
    setGracePeriod: (reason: GracePeriodState['gracePeriodReason']) => setGracePeriod(reason),
    checkForSignificantMovement: (location: UserLocation) => checkForSignificantMovement(location, globalProximityState.settings),
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
