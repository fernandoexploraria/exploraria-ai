
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { 
  ProximityAlert, 
  ProximitySettings, 
  UserLocation, 
  ProximityState,
  ProximityDetectionResult
} from '@/types/proximityAlerts';
import { Landmark } from '@/data/landmarks';
import { useCombinedLandmarks } from '@/hooks/useCombinedLandmarks';
import { calculateDistance } from '@/utils/proximityUtils';

const DEFAULT_TOAST_DISTANCE = 100; // meters
const DEFAULT_ROUTE_DISTANCE = 500; // meters  
const DEFAULT_CARD_DISTANCE = 250; // meters

export const useProximityAlerts = () => {
  const { user } = useAuth();
  const [proximityState, setProximityState] = useState<ProximityState>({
    proximityAlerts: [],
    proximitySettings: null,
    userLocation: null,
    locationTracking: {
      isTracking: false,
      isPermissionGranted: null,
      error: null,
      lastUpdate: null,
      movementDetected: false,
      pollInterval: 15000
    },
    isLoading: false
  });

  // NEW: Track user interaction mode to pause automatic re-centering
  const [isUserInteractionMode, setIsUserInteractionMode] = useState<boolean>(false);
  const lastLocationUpdateRef = useRef<UserLocation | null>(null);

  // Get combined landmarks from the dedicated hook
  const combinedLandmarks = useCombinedLandmarks();

  // Load proximity settings on mount
  useEffect(() => {
    if (user) {
      loadProximitySettings();
      loadProximityAlerts();
    }
  }, [user]);

  const loadProximitySettings = async () => {
    if (!user) return;

    try {
      setProximityState(prev => ({ ...prev, isLoading: true }));

      const { data: settings, error } = await supabase
        .from('proximity_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading proximity settings:', error);
        return;
      }

      if (!settings) {
        // Create default settings
        const defaultSettings: Omit<ProximitySettings, 'id' | 'created_at' | 'updated_at'> = {
          user_id: user.id,
          is_enabled: false,
          toast_distance: DEFAULT_TOAST_DISTANCE,
          route_distance: DEFAULT_ROUTE_DISTANCE,
          card_distance: DEFAULT_CARD_DISTANCE
        };

        const { data: newSettings, error: createError } = await supabase
          .from('proximity_settings')
          .insert(defaultSettings)
          .select()
          .single();

        if (createError) {
          console.error('Error creating default proximity settings:', createError);
          return;
        }

        setProximityState(prev => ({
          ...prev,
          proximitySettings: newSettings,
          isLoading: false
        }));
      } else {
        setProximityState(prev => ({
          ...prev,
          proximitySettings: settings,
          isLoading: false
        }));
      }
    } catch (error) {
      console.error('Error in loadProximitySettings:', error);
      setProximityState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const loadProximityAlerts = async () => {
    if (!user) return;

    try {
      const { data: alerts, error } = await supabase
        .from('proximity_alerts')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading proximity alerts:', error);
        return;
      }

      setProximityState(prev => ({
        ...prev,
        proximityAlerts: alerts || []
      }));
    } catch (error) {
      console.error('Error in loadProximityAlerts:', error);
    }
  };

  const setProximityAlerts = useCallback((alerts: ProximityAlert[] | ((prev: ProximityAlert[]) => ProximityAlert[])) => {
    setProximityState(prev => ({
      ...prev,
      proximityAlerts: typeof alerts === 'function' ? alerts(prev.proximityAlerts) : alerts
    }));
  }, []);

  const updateProximityEnabled = useCallback(async (enabled: boolean) => {
    if (!user || !proximityState.proximitySettings) return;

    try {
      console.log(`🔔 Updating proximity enabled status to: ${enabled}`);
      
      const { data, error } = await supabase
        .from('proximity_settings')
        .update({ is_enabled: enabled })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating proximity settings:', error);
        return;
      }

      setProximityState(prev => ({
        ...prev,
        proximitySettings: { ...data }
      }));

      console.log(`✅ Proximity alerts ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error in updateProximityEnabled:', error);
    }
  }, [user, proximityState.proximitySettings]);

  const updateProximityDistances = useCallback(async (distances: {
    toast_distance?: number;
    route_distance?: number;
    card_distance?: number;
  }) => {
    if (!user || !proximityState.proximitySettings) return;

    try {
      const { data, error } = await supabase
        .from('proximity_settings')
        .update(distances)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating proximity distances:', error);
        return;
      }

      setProximityState(prev => ({
        ...prev,
        proximitySettings: { ...data }
      }));

      console.log('✅ Proximity distances updated:', distances);
    } catch (error) {
      console.error('Error in updateProximityDistances:', error);
    }
  }, [user, proximityState.proximitySettings]);

  const updateDistanceSetting = useCallback(async (
    setting: 'toast_distance' | 'route_distance' | 'card_distance',
    value: number
  ) => {
    if (!user || !proximityState.proximitySettings) return;

    try {
      const { data, error } = await supabase
        .from('proximity_settings')
        .update({ [setting]: value })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error(`Error updating ${setting}:`, error);
        throw error;
      }

      setProximityState(prev => ({
        ...prev,
        proximitySettings: { ...data }
      }));

      console.log(`✅ ${setting} updated to:`, value);
    } catch (error) {
      console.error(`Error in updateDistanceSetting for ${setting}:`, error);
      throw error;
    }
  }, [user, proximityState.proximitySettings]);

  const setUserLocation = useCallback((location: UserLocation | null) => {
    console.log('📍 Setting user location:', location ? 
      `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : 'null');
    
    // Store reference to last location update
    if (location) {
      lastLocationUpdateRef.current = location;
    }
    
    setProximityState(prev => ({
      ...prev,
      userLocation: location
    }));
  }, []);

  const checkProximityAlerts = useCallback((landmarks: Landmark[], userLocation: UserLocation): ProximityDetectionResult[] => {
    if (!proximityState.proximitySettings?.is_enabled) {
      return [];
    }

    const results: ProximityDetectionResult[] = [];
    const toastDistance = proximityState.proximitySettings.toast_distance || DEFAULT_TOAST_DISTANCE;

    landmarks.forEach(landmark => {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        landmark.coordinates[1],
        landmark.coordinates[0]
      );

      const isWithinRange = distance <= toastDistance;
      
      // Create a mock proximity alert for this landmark
      const alert: ProximityAlert = {
        id: `temp-${landmark.id}`,
        user_id: user?.id || '',
        landmark_id: landmark.id,
        distance: toastDistance,
        is_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      results.push({
        alert,
        distance,
        isWithinRange,
        hasEntered: isWithinRange, // Simplified for now
        hasExited: false
      });
    });

    return results.filter(result => result.isWithinRange);
  }, [proximityState.proximitySettings, user]);

  // NEW: Function to set user interaction mode
  const setUserInteractionMode = useCallback((isInteracting: boolean) => {
    console.log(`🖱️ User interaction mode: ${isInteracting ? 'ON' : 'OFF'}`);
    setIsUserInteractionMode(isInteracting);
  }, []);

  return {
    proximitySettings: proximityState.proximitySettings,
    proximityAlerts: proximityState.proximityAlerts,
    userLocation: proximityState.userLocation,
    isLoading: proximityState.isLoading,
    combinedLandmarks,
    setProximityAlerts,
    updateProximityEnabled,
    updateProximityDistances,
    updateDistanceSetting,
    setUserLocation,
    checkProximityAlerts,
    // NEW: Export user interaction mode state and setter
    isUserInteractionMode,
    setUserInteractionMode,
    lastLocationUpdate: lastLocationUpdateRef.current
  };
};
