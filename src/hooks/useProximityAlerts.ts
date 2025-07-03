
import { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider'; 
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useProximityAlertsValidation } from '@/hooks/useProximityAlertsValidation';
import { trackGracePeriodActivation } from '@/utils/gracePeriodHistory';
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

  // Helper function to update proximity enabled status
  const updateProximityEnabled = useCallback(async (enabled: boolean) => {
    await updateProximitySettings({ is_enabled: enabled });
  }, [updateProximitySettings]);

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
  const handleProximityToggle = useCallback(async (newEnabled: boolean) => {
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
      handleProximityToggle(proximitySettings.is_enabled);
    }
  }, [proximitySettings?.is_enabled, handleProximityToggle]);

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
  };
};
