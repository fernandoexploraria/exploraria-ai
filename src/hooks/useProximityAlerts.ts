import { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { ProximitySettings, GracePeriodState } from '@/types/proximityAlerts';

export const useProximityAlerts = () => {
  const queryClient = useQueryClient();
  const { userLocation } = useLocationTracking();
  const { validateAndCorrectSettings, handleDatabaseError } = useProximityAlertsValidation();
  
  // Grace period state management
  const [gracePeriodState, setGracePeriodState] = useState<GracePeriodState>({
    isInGracePeriod: false,
    gracePeriodReason: null,
    initializationTimestamp: null,
    lastMovementTimestamp: null,
    lastAppResumeTimestamp: null,
  });

  // Refs for tracking state without causing re-renders
  const lastLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const appBackgroundedAtRef = useRef<number | null>(null);
  const proximityWasEnabledRef = useRef<boolean>(false);

  // Fetch proximity settings from Supabase
  const { data: proximitySettings, isLoading, error, refetch: updateProximitySettings } = useQuery<ProximitySettings | null>(
    ['proximitySettings'],
    async () => {
      const { data, error } = await supabase
        .from('proximity_settings')
        .select('*')
        .single();

      if (error) {
        console.error('Error fetching proximity settings:', error);
        throw error;
      }

      return data as ProximitySettings;
    },
    {
      retry: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    }
  );

  // Function to update proximity settings in Supabase
  const updateProximitySettings = useCallback(async (updates: Partial<ProximitySettings>) => {
    if (!proximitySettings) {
      console.warn('Proximity settings not yet loaded, cannot update.');
      return;
    }

    try {
      // Validate and auto-correct settings before saving
      const { correctedSettings } = await validateAndCorrectSettings({ ...proximitySettings, ...updates });

      const { data, error } = await supabase
        .from('proximity_settings')
        .update(correctedSettings)
        .eq('id', proximitySettings.id)
        .select('*')
        .single();

      if (error) {
        // Handle database errors, attempting auto-correction if validation fails
        const finalSettings = await handleDatabaseError(error, 'update', { ...proximitySettings, ...updates });

        if (finalSettings) {
          // Settings were auto-corrected and saved successfully, update the query cache
          queryClient.setQueryData(['proximitySettings'], finalSettings);
        } else {
          // Database error was not a validation error, re-throw
          throw error;
        }
      } else {
        // Settings updated successfully, update the query cache
        queryClient.setQueryData(['proximitySettings'], data);
      }
    } catch (err) {
      console.error('Failed to update proximity settings:', err);
    }
  }, [proximitySettings, queryClient, validateAndCorrectSettings, handleDatabaseError]);

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

    const movementConstants = getMovementConstants(proximitySettings);
    const significantMovement = movementDistance >= movementConstants.SIGNIFICANT_THRESHOLD;
    const shouldClearGracePeriod = shouldClearGracePeriodOnMovement(movementDistance, proximitySettings);

    if (significantMovement) {
      console.log(`🚶 Significant movement detected: ${Math.round(movementDistance)}m`);
      
      setGracePeriodState(prev => ({
        ...prev,
        lastMovementTimestamp: Date.now(),
      }));

      // UPDATED: Clear grace period on movement >100m, but don't activate new one
      if (shouldClearGracePeriod && gracePeriodState.isInGracePeriod) {
        logGracePeriodEvent(
          `Grace period cleared due to significant movement`, 
          { 
            movementDistance: Math.round(movementDistance),
            clearThreshold: movementConstants.GRACE_PERIOD_CLEAR_THRESHOLD,
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

        trackGracePeriodActivation('movement_clear', 'user', {
          preset: 'movement_clear',
          userLocation: currentLocation
        });
      }
    }

    lastLocationRef.current = currentLocation;
  }, [proximitySettings, gracePeriodState.isInGracePeriod, gracePeriodState.gracePeriodReason]);

  // UPDATED: Handle app visibility changes - remove grace period activation
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

      // REMOVED: No longer activate grace period on app resume
      appBackgroundedAtRef.current = null;
    }
  }, [proximitySettings]);

  // UPDATED: Handle proximity setting changes - only reset on enable/disable
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

      trackGracePeriodActivation('initialization', 'user', {
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
    isLoading,
    error,
    updateProximitySettings,
    isInGracePeriod: gracePeriodState.isInGracePeriod,
    gracePeriodRemainingMs: gracePeriodState.isInGracePeriod && gracePeriodState.initializationTimestamp
      ? Math.max(0, (gracePeriodState.initializationTimestamp + getGracePeriodConstants(proximitySettings).INITIALIZATION) - Date.now())
      : 0,
    gracePeriodReason: gracePeriodState.gracePeriodReason,
    gracePeriodState,
  };
};
