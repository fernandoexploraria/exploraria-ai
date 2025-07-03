import { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider'; 
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useProximityAlertsValidation } from '@/hooks/useProximityAlertsValidation';
import { trackGracePeriodActivation } from '@/utils/gracePeriodHistory';
import { proximityEnabledDebouncer } from '@/utils/proximityEnabledDebouncer';
import { 
  shouldActivateGracePeriod, 
  shouldClearGracePeriodOnMovement,
  calculateDistance, 
  getGracePeriodConstants,
  getMovementConstants,
  logGracePeriodEvent
} from '@/utils/smartGracePeriod';
import { ProximitySettings, GracePeriodState, ProximityAlert } from '@/types/proximityAlerts';

interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'polling' | 'failed' | 'disconnected';
  lastDataUpdate: number | null;
  consecutiveFailures: number;
}

interface EnabledCallTracker {
  lastValue: boolean | null;
  lastTimestamp: number | null;
  callCount: number;
  source: string | null;
}

const DEFAULT_PROXIMITY_SETTINGS: Omit<ProximitySettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  is_enabled: false,
  notification_distance: 100,
  outer_distance: 250,
  card_distance: 50,
  grace_period_initialization: 15000,
  grace_period_movement: 8000,
  grace_period_app_resume: 5000,
  significant_movement_threshold: 150,
  grace_period_enabled: true,
  location_settling_grace_period: 5000,
};

export const useProximityAlerts = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { userLocation } = useLocationTracking();
  const { validateAndCorrectSettings, handleDatabaseError } = useProximityAlertsValidation();
  
  // Connection status state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'connecting',
    lastDataUpdate: null,
    consecutiveFailures: 0
  });

  // Enhanced call tracking refs
  const lastEnabledCallRef = useRef<EnabledCallTracker>({
    lastValue: null,
    lastTimestamp: null,
    callCount: 0,
    source: null
  });
  
  const enabledCallHistoryRef = useRef<Array<{
    value: boolean;
    timestamp: number;
    source: string;
    processed: boolean;
  }>>([]);
  
  const rapidCallDetectionRef = useRef<{
    windowStart: number;
    callCount: number;
    lastWarning: number;
  }>({
    windowStart: Date.now(),
    callCount: 0,
    lastWarning: 0
  });
  
  // Multi-source update prevention flags (enhanced for Step 2.3.1)
  const isUpdatingFromGeolocateControl = useRef<boolean>(false);
  const geolocateEventInProgress = useRef<boolean>(false);
  
  // Grace period state management
  const [gracePeriodState, setGracePeriodState] = useState<GracePeriodState>({
    isInGracePeriod: false,
    gracePeriodReason: null,
    initializationTimestamp: null,
    lastMovementTimestamp: null,
    lastAppResumeTimestamp: null,
  });

  // Proximity alerts state
  const [proximityAlerts, setProximityAlerts] = useState<ProximityAlert[]>([]);

  // Refs for tracking state without causing re-renders
  const lastLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const appBackgroundedAtRef = useRef<number | null>(null);
  const proximityWasEnabledRef = useRef<boolean>(false);

  // Enhanced call tracking functions with GeolocateControl awareness
  const trackEnabledCall = useCallback((enabled: boolean, source: string) => {
    const now = Date.now();
    const tracker = lastEnabledCallRef.current;
    
    // Detect if this is a GeolocateControl event
    const isGeolocateEvent = source.includes('GeolocateControl');
    if (isGeolocateEvent) {
      isUpdatingFromGeolocateControl.current = true;
      // Reset after a short delay to allow event processing
      setTimeout(() => {
        isUpdatingFromGeolocateControl.current = false;
      }, 1000);
    }
    
    // Update call tracker
    tracker.lastValue = enabled;
    tracker.lastTimestamp = now;
    tracker.callCount++;
    tracker.source = source;
    
    // Add to call history
    const history = enabledCallHistoryRef.current;
    history.push({
      value: enabled,
      timestamp: now,
      source,
      processed: false
    });
    
    // Keep only last 10 calls
    if (history.length > 10) {
      history.shift();
    }
    
    // Update rapid call detection
    const rapid = rapidCallDetectionRef.current;
    if (now - rapid.windowStart > 1000) {
      // Reset window
      rapid.windowStart = now;
      rapid.callCount = 1;
    } else {
      rapid.callCount++;
    }
    
    // Log warning for rapid calls (but be more lenient for GeolocateControl events)
    const rapidThreshold = isGeolocateEvent ? 6 : 3; // Higher threshold for geolocate events
    if (rapid.callCount > rapidThreshold && now - rapid.lastWarning > 5000) {
      console.warn('🚨 [ProximityAlerts] Rapid updateProximityEnabled calls detected:', {
        callsInLastSecond: rapid.callCount,
        source,
        isGeolocateEvent,
        recentHistory: history.slice(-5)
      });
      rapid.lastWarning = now;
    }
    
    // Log structured call information
    console.group('📞 [ProximityAlerts] updateProximityEnabled Call');
    console.log('📋 Call Details:', {
      enabled,
      source,
      isGeolocateEvent,
      timestamp: new Date(now).toISOString().slice(11, 23),
      callCount: tracker.callCount,
      timeSinceLastCall: tracker.lastTimestamp ? now - tracker.lastTimestamp : 'N/A'
    });
    console.log('📊 Recent History:', history.slice(-3));
    console.log('⚡ Rapid Detection:', {
      callsInWindow: rapid.callCount,
      windowDuration: now - rapid.windowStart,
      threshold: rapidThreshold
    });
    console.groupEnd();
  }, []);

  // Enhanced duplicate call detection with GeolocateControl awareness
  const checkForDuplicateCall = useCallback((enabled: boolean, source: string): boolean => {
    const tracker = lastEnabledCallRef.current;
    const now = Date.now();
    
    // More lenient duplicate detection for GeolocateControl events
    const isGeolocateEvent = source.includes('GeolocateControl');
    const duplicateWindow = isGeolocateEvent ? 100 : 500; // Shorter window for geolocate events
    
    // Check for exact duplicate within the appropriate window
    if (tracker.lastValue === enabled && 
        tracker.lastTimestamp && 
        now - tracker.lastTimestamp < duplicateWindow) {
      
      console.warn('🔄 [ProximityAlerts] Duplicate call detected and skipped:', {
        enabled,
        source,
        isGeolocateEvent,
        timeSinceLastCall: now - tracker.lastTimestamp,
        lastSource: tracker.source
      });
      
      return true; // Is duplicate
    }
    
    return false; // Not duplicate
  }, []);

  // Auto-create proximity settings for authenticated users
  const createDefaultProximitySettings = useCallback(async () => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('proximity_settings')
        .upsert({
          user_id: user.id,
          ...DEFAULT_PROXIMITY_SETTINGS,
        }, { onConflict: 'user_id' })
        .select('*')
        .single();

      if (error) throw error;
      
      console.log('✅ Created default proximity settings for user');
      return data as ProximitySettings;
    } catch (error) {
      console.error('❌ Failed to create default proximity settings:', error);
      throw error;
    }
  }, [user]);

  // Fetch proximity settings from Supabase
  const { data: proximitySettings, isLoading, error, refetch } = useQuery<ProximitySettings | null>({
    queryKey: ['proximitySettings', user?.id],
    queryFn: async () => {
      if (!user) {
        console.log('👤 No authenticated user, skipping proximity settings fetch');
        return null;
      }

      try {
        setConnectionStatus(prev => ({ ...prev, status: 'connecting' }));

        const { data, error } = await supabase
          .from('proximity_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching proximity settings:', error);
          setConnectionStatus(prev => ({
            ...prev,
            status: 'failed',
            consecutiveFailures: prev.consecutiveFailures + 1
          }));
          throw error;
        }

        // If no settings exist, create default ones
        if (!data) {
          console.log('📝 No proximity settings found, creating defaults');
          const defaultSettings = await createDefaultProximitySettings();
          
          setConnectionStatus(prev => ({
            ...prev,
            status: 'connected',
            lastDataUpdate: Date.now(),
            consecutiveFailures: 0
          }));

          return defaultSettings;
        }

        setConnectionStatus(prev => ({
          ...prev,
          status: 'connected',
          lastDataUpdate: Date.now(),
          consecutiveFailures: 0
        }));

        return data as ProximitySettings;
      } catch (err) {
        setConnectionStatus(prev => ({
          ...prev,
          status: 'failed',
          consecutiveFailures: prev.consecutiveFailures + 1
        }));
        throw err;
      }
    },
    enabled: !!user, // Only run query when user is authenticated
    retry: 3,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  // Fetch proximity alerts
  useEffect(() => {
    const fetchProximityAlerts = async () => {
      if (!user) {
        setProximityAlerts([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('proximity_alerts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching proximity alerts:', error);
          return;
        }

        setProximityAlerts(data || []);
      } catch (err) {
        console.error('Failed to fetch proximity alerts:', err);
      }
    };

    fetchProximityAlerts();
  }, [user]);

  // Function to update proximity settings in Supabase
  const updateProximitySettings = useCallback(async (updates: Partial<ProximitySettings>) => {
    if (!proximitySettings || !user) {
      console.warn('Cannot update proximity settings: missing settings or user authentication.');
      return;
    }

    try {
      // Validate and auto-correct settings before saving
      const { correctedSettings } = await validateAndCorrectSettings({ ...proximitySettings, ...updates });

      const { data, error } = await supabase
        .from('proximity_settings')
        .update(correctedSettings)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (error) {
        // Handle database errors, attempting auto-correction if validation fails
        const finalSettings = await handleDatabaseError(error, 'update', { ...proximitySettings, ...updates });

        if (finalSettings) {
          // Settings were auto-corrected and saved successfully, update the query cache
          queryClient.setQueryData(['proximitySettings', user.id], finalSettings);
        } else {
          // Database error was not a validation error, re-throw
          throw error;
        }
      } else {
        // Settings updated successfully, update the query cache
        queryClient.setQueryData(['proximitySettings', user.id], data);
      }
    } catch (err) {
      console.error('Failed to update proximity settings:', err);
    }
  }, [proximitySettings, user, queryClient, validateAndCorrectSettings, handleDatabaseError]);

  // Enhanced updateProximityEnabled with comprehensive tracking and deduplication
  const updateProximityEnabled = useCallback(async (enabled: boolean, source: string = 'Manual') => {
    if (!user) {
      console.warn('Cannot update proximity enabled: no authenticated user');
      return;
    }

    // Track the call
    trackEnabledCall(enabled, source);

    // Check for duplicate calls
    if (checkForDuplicateCall(enabled, source)) {
      return; // Skip duplicate call
    }

    // Use the enhanced debouncer with source tracking
    const wasQueued = proximityEnabledDebouncer.debounceEnabledUpdate(
      user.id,
      enabled,
      async (debouncedEnabled: boolean) => {
        console.log('⚡ [ProximityAlerts] Executing debounced enabled update:', { 
          enabled: debouncedEnabled, 
          source 
        });
        
        // Mark as processed in history
        const history = enabledCallHistoryRef.current;
        const lastCall = history[history.length - 1];
        if (lastCall && !lastCall.processed) {
          lastCall.processed = true;
        }
        
        await updateProximitySettings({ is_enabled: debouncedEnabled });
      },
      source
    );

    if (wasQueued) {
      console.log('⚡ [ProximityAlerts] Proximity enabled update queued:', { enabled, source });
    } else {
      console.log('⚡ [ProximityAlerts] Proximity enabled update skipped:', { 
        enabled, 
        source,
        reason: 'Debouncer rejected (duplicate/cooldown/rapid calls)'
      });
    }
  }, [updateProximitySettings, user, trackEnabledCall, checkForDuplicateCall]);

  // Helper function to update distance settings
  const updateDistanceSetting = useCallback(async (field: 'notification_distance' | 'outer_distance' | 'card_distance', value: number) => {
    await updateProximitySettings({ [field]: value });
  }, [updateProximitySettings]);

  // Grace period management functions
  const setGracePeriod = useCallback((reason: GracePeriodState['gracePeriodReason']) => {
    setGracePeriodState({
      isInGracePeriod: true,
      gracePeriodReason: reason,
      initializationTimestamp: Date.now(),
      lastMovementTimestamp: null,
      lastAppResumeTimestamp: null,
    });
  }, []);

  const clearGracePeriod = useCallback(() => {
    setGracePeriodState({
      isInGracePeriod: false,
      gracePeriodReason: null,
      initializationTimestamp: null,
      lastMovementTimestamp: null,
      lastAppResumeTimestamp: null,
    });
  }, []);

  // Force reconnect function
  const forceReconnect = useCallback(() => {
    console.log('🔄 Force reconnecting proximity alerts...');
    setConnectionStatus(prev => ({ ...prev, status: 'connecting' }));
    refetch();
  }, [refetch]);

  // Grace period expiration effect
  useEffect(() => {
    if (!gracePeriodState.isInGracePeriod || !gracePeriodState.initializationTimestamp || !proximitySettings) {
      return;
    }

    const gracePeriodConstants = getGracePeriodConstants(proximitySettings);
    const gracePeriodDuration = gracePeriodConstants.INITIALIZATION;
    const timeRemaining = gracePeriodState.initializationTimestamp + gracePeriodDuration - Date.now();

    if (timeRemaining > 0) {
      const timeoutId = setTimeout(() => {
        console.log('🔔 Grace period expired');
        setGracePeriodState(prev => ({
          ...prev,
          isInGracePeriod: false,
          gracePeriodReason: null,
          initializationTimestamp: null,
        }));
      }, timeRemaining);

      return () => clearTimeout(timeoutId);
    } else {
      // Grace period already expired
      setGracePeriodState(prev => ({
        ...prev,
        isInGracePeriod: false,
        gracePeriodReason: null,
        initializationTimestamp: null,
      }));
    }
  }, [gracePeriodState.isInGracePeriod, gracePeriodState.initializationTimestamp, proximitySettings]);

  // Handle movement detection and grace period clearing
  const handleMovementDetection = useCallback(async (currentLocation: { latitude: number; longitude: number }) => {
    if (!lastLocationRef.current) {
      lastLocationRef.current = currentLocation;
      return;
    }

    const movementDistance = calculateDistance(
      lastLocationRef.current.latitude,
      lastLocationRef.current.longitude,
      currentLocation.latitude,
      currentLocation.longitude
    );

    const shouldClearGracePeriod = shouldClearGracePeriodOnMovement(movementDistance, proximitySettings);

    // Clear grace period on movement >100m, but don't activate new one
    if (shouldClearGracePeriod && gracePeriodState.isInGracePeriod) {
      logGracePeriodEvent(
        `Grace period cleared due to significant movement`, 
        { 
          movementDistance: Math.round(movementDistance),
          clearThreshold: getMovementConstants(proximitySettings).GRACE_PERIOD_CLEAR_THRESHOLD,
          previousReason: gracePeriodState.gracePeriodReason
        },
        'info',
        proximitySettings
      );

      setGracePeriodState(prev => ({
        ...prev,
        isInGracePeriod: false,
        gracePeriodReason: null,
        initializationTimestamp: null,
      }));

      trackGracePeriodActivation('initialization', 'system', {
        preset: 'movement_clear',
        userLocation: currentLocation
      });
    }

    lastLocationRef.current = currentLocation;
  }, [proximitySettings, gracePeriodState.isInGracePeriod, gracePeriodState.gracePeriodReason]);

  // Handle app visibility changes - for logging only, no grace period activation
  const handleAppVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // App is being backgrounded
      appBackgroundedAtRef.current = Date.now();
      logGracePeriodEvent('App backgrounded', { timestamp: Date.now() });
    } else {
      // App is being foregrounded
      const backgroundDuration = appBackgroundedAtRef.current ? 
        Date.now() - appBackgroundedAtRef.current : 0;
      
      logGracePeriodEvent(
        'App foregrounded', 
        { 
          backgroundDuration: Math.round(backgroundDuration / 1000),
          backgroundThreshold: Math.round(getMovementConstants(proximitySettings).BACKGROUND_DETECTION / 1000)
        }
      );

      setGracePeriodState(prev => ({
        ...prev,
        lastAppResumeTimestamp: Date.now(),
      }));

      appBackgroundedAtRef.current = null;
    }
  }, [proximitySettings]);

  // Handle proximity setting changes - only reset on enable/disable
  const handleProximityToggle = useCallback(async (newEnabled: boolean, source: string = 'System') => {
    const wasEnabled = proximityWasEnabledRef.current;
    proximityWasEnabledRef.current = newEnabled;

    if (!wasEnabled && newEnabled) {
      // Proximity is being enabled after being disabled - activate initialization grace period
      console.log('🔔 Proximity alerts enabled - starting initialization grace period');
      
      const initTimestamp = Date.now();
      setGracePeriodState({
        isInGracePeriod: true,
        gracePeriodReason: 'initialization',
        initializationTimestamp: initTimestamp,
        lastMovementTimestamp: null,
        lastAppResumeTimestamp: null,
      });

      logGracePeriodEvent(
        'Initialization grace period activated', 
        { 
          duration: getGracePeriodConstants(proximitySettings).INITIALIZATION / 1000,
          reason: 'proximity_enabled'
        },
        'info',
        proximitySettings
      );

      trackGracePeriodActivation('initialization', 'automatic', {
        preset: 'enabled',
        userLocation
      });
    } else if (wasEnabled && !newEnabled) {
      // Proximity is being disabled - clear any active grace period
      console.log('🔔 Proximity alerts disabled - clearing grace period');
      
      setGracePeriodState({
        isInGracePeriod: false,
        gracePeriodReason: null,
        initializationTimestamp: null,
        lastMovementTimestamp: null,
        lastAppResumeTimestamp: null,
      });

      logGracePeriodEvent('Grace period cleared due to proximity disable', {}, 'info', proximitySettings);
    }
  }, [proximitySettings, userLocation]);

  // Movement detection effect
  useEffect(() => {
    if (userLocation && proximitySettings?.is_enabled) {
      handleMovementDetection(userLocation);
    }
  }, [userLocation, handleMovementDetection, proximitySettings?.is_enabled]);

  // App visibility effect - for logging only, no grace period activation
  useEffect(() => {
    document.addEventListener('visibilitychange', handleAppVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleAppVisibilityChange);
    };
  }, [handleAppVisibilityChange]);

  // Proximity setting toggle effect
  useEffect(() => {
    if (proximitySettings) {
      // Determine the source of the change
      const source = proximitySettings.is_enabled !== proximityWasEnabledRef.current ? 'DatabaseSync' : 'InitialLoad';
      handleProximityToggle(proximitySettings.is_enabled, source);
    }
  }, [proximitySettings?.is_enabled]);

  // Development mode debugging utilities
  const getDebugInfo = useCallback(() => {
    if (process.env.NODE_ENV === 'development' && user) {
      return {
        callTracker: lastEnabledCallRef.current,
        callHistory: enabledCallHistoryRef.current,
        rapidDetection: rapidCallDetectionRef.current,
        debouncerHistory: proximityEnabledDebouncer.getCallHistory(user.id),
        debouncerMetrics: proximityEnabledDebouncer.getMetrics()
      };
    }
    return null;
  }, [user]);

  // Expose debugging function to window in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      (window as any).proximityAlertsDebug = {
        getDebugInfo,
        dumpCallHistory: () => proximityEnabledDebouncer.dumpDebugInfo(user?.id),
        emergencyBrake: () => user && proximityEnabledDebouncer.emergencyBrake(user.id)
      };
    }
  }, [getDebugInfo, user]);

  return {
    proximitySettings,
    proximityAlerts,
    setProximityAlerts,
    isLoading,
    error,
    updateProximitySettings,
    updateProximityEnabled,
    updateDistanceSetting,
    connectionStatus,
    forceReconnect,
    userLocation,
    isInGracePeriod: gracePeriodState.isInGracePeriod,
    gracePeriodRemainingMs: gracePeriodState.isInGracePeriod && gracePeriodState.initializationTimestamp
      ? Math.max(0, (gracePeriodState.initializationTimestamp + getGracePeriodConstants(proximitySettings).INITIALIZATION) - Date.now())
      : 0,
    gracePeriodReason: gracePeriodState.gracePeriodReason,
    gracePeriodState,
    setGracePeriod,
    clearGracePeriod,
    // Debugging utilities (development only)
    ...(process.env.NODE_ENV === 'development' && { 
      debugInfo: getDebugInfo(),
      callTracker: lastEnabledCallRef.current,
      callHistory: enabledCallHistoryRef.current 
    })
  };
};
