import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocationTracking } from './useLocationTracking';
import { supabase } from '@/integrations/supabase/client';

interface ContextualPOI {
  placeId: string;
  name: string;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  types: string[];
  vicinity: string;
  openNow?: boolean;
  photoUrl?: string;
  editorialSummary?: string;
  website?: string;
  distance: number;
}

interface ContextualPOIUpdate {
  timestamp: number;
  userLocation: {
    latitude: number;
    longitude: number;
  };
  pois: ContextualPOI[];
  updateReason: 'location_change' | 'scheduled_poll' | 'manual_refresh';
}

interface UseContextualPOIPollingOptions {
  enabled: boolean;
  pollInterval?: number;
  radius?: number;
  maxResults?: number;
  onUpdate?: (update: ContextualPOIUpdate) => void;
}

export const useContextualPOIPolling = ({
  enabled,
  pollInterval = 15000, // 15 seconds
  radius = 150, // 150 meters
  maxResults = 3,
  onUpdate
}: UseContextualPOIPollingOptions) => {
  const { userLocation } = useLocationTracking();
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<ContextualPOIUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<{latitude: number, longitude: number} | null>(null);
  const pollCountRef = useRef(0);

  const fetchContextualPOIs = useCallback(async (
    location: {latitude: number, longitude: number},
    updateReason: ContextualPOIUpdate['updateReason']
  ): Promise<ContextualPOIUpdate | null> => {
    try {
      console.log(`🔍 Fetching contextual POIs (${updateReason}):`, {
        location: `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
        radius,
        maxResults
      });

      // Persist user location to database for directions function
      // Only if location change is significant enough
      const shouldPersistLocation = !lastLocationRef.current || 
        Math.abs(lastLocationRef.current.latitude - location.latitude) > 0.0001 ||
        Math.abs(lastLocationRef.current.longitude - location.longitude) > 0.0001;

      if (shouldPersistLocation) {
        console.log('📍 Persisting user location to database');
        try {
          await supabase
            .from('user_locations')
            .upsert({
              user_id: (await supabase.auth.getUser()).data.user?.id,
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: null, // Can be enhanced later if needed
              updated_at: new Date().toISOString()
            });
        } catch (locationError) {
          console.warn('⚠️ Failed to persist location:', locationError);
          // Don't fail the POI fetch if location persistence fails
        }
      }

      const { data, error } = await supabase.functions.invoke('contextual-poi-updates', {
        body: {
          userLocation: location,
          radius,
          maxResults
        }
      });

      if (error) {
        console.error('❌ Contextual POI fetch error:', error);
        setError(error.message);
        return null;
      }

      if (!data || !data.success) {
        console.warn('⚠️ Contextual POI fetch returned no data');
        return null;
      }

      const update: ContextualPOIUpdate = {
        timestamp: Date.now(),
        userLocation: location,
        pois: data.pois || [],
        updateReason
      };

      console.log(`✅ Contextual POI update:`, {
        poisCount: update.pois.length,
        reason: updateReason,
        location: `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
        nearestPOI: update.pois[0]?.name || 'none'
      });

      setLastUpdate(update);
      setError(null);
      
      return update;
    } catch (err) {
      console.error('❌ Contextual POI polling error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [radius, maxResults]);

  const schedulePoll = useCallback(() => {
    if (pollIntervalRef.current) {
      clearTimeout(pollIntervalRef.current);
    }

    if (!enabled || !userLocation) {
      return;
    }

    pollIntervalRef.current = setTimeout(async () => {
      pollCountRef.current += 1;
      console.log(`⏱️ Scheduled contextual POI poll #${pollCountRef.current}`);
      
      const update = await fetchContextualPOIs(userLocation, 'scheduled_poll');
      if (update && onUpdate) {
        onUpdate(update);
      }
      
      // Schedule next poll
      schedulePoll();
    }, pollInterval);
  }, [enabled, userLocation, pollInterval, fetchContextualPOIs, onUpdate]);

  // Handle location changes
  useEffect(() => {
    if (!enabled || !userLocation) {
      return;
    }

    const currentLocation = {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude
    };

    // Check if location has changed significantly
    const hasLocationChanged = !lastLocationRef.current || 
      Math.abs(lastLocationRef.current.latitude - currentLocation.latitude) > 0.0001 ||
      Math.abs(lastLocationRef.current.longitude - currentLocation.longitude) > 0.0001;

    if (hasLocationChanged) {
      console.log('📍 User location changed, triggering contextual POI update');
      lastLocationRef.current = currentLocation;
      
      // Immediate update on location change
      fetchContextualPOIs(currentLocation, 'location_change').then(update => {
        if (update && onUpdate) {
          onUpdate(update);
        }
      });
    }
  }, [enabled, userLocation, fetchContextualPOIs, onUpdate]);

  // Start/stop polling based on enabled state
  useEffect(() => {
    if (enabled && userLocation) {
      console.log('🚀 Starting contextual POI polling');
      setIsPolling(true);
      pollCountRef.current = 0;
      schedulePoll();
    } else {
      console.log('🛑 Stopping contextual POI polling');
      setIsPolling(false);
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [enabled, userLocation, schedulePoll]);

  const manualRefresh = useCallback(async () => {
    if (!userLocation) {
      console.warn('⚠️ Cannot refresh contextual POIs: no user location');
      return null;
    }

    console.log('🔄 Manual contextual POI refresh requested');
    const update = await fetchContextualPOIs(userLocation, 'manual_refresh');
    if (update && onUpdate) {
      onUpdate(update);
    }
    return update;
  }, [userLocation, fetchContextualPOIs, onUpdate]);

  return {
    isPolling,
    lastUpdate,
    error,
    manualRefresh,
    pollCount: pollCountRef.current
  };
};