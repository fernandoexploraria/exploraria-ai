import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocationTracking } from './useLocationTracking';
import { supabase } from '@/integrations/supabase/client';
import { isSignificantLocationChange } from '@/utils/locationUtils';

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
  updateReason: 'location_change' | 'initial_location' | 'manual_refresh';
}

interface UseContextualPOIPollingOptions {
  enabled: boolean;
  pollInterval?: number;
  radius?: number;
  maxResults?: number;
  onUpdate?: (update: ContextualPOIUpdate) => void;
  conversationId?: string; // Add conversation_id parameter
}

export const useContextualPOIPolling = ({
  enabled,
  pollInterval = 30000, // 30 seconds
  radius = 150, // 150 meters
  maxResults = 3,
  onUpdate,
  conversationId
}: UseContextualPOIPollingOptions) => {
  const { userLocation } = useLocationTracking();
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<ContextualPOIUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<{latitude: number, longitude: number} | null>(null);
  const lastPersistedLocationRef = useRef<{latitude: number, longitude: number} | null>(null);
  const pollCountRef = useRef(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedLocationRef = useRef<{latitude: number, longitude: number} | null>(null);

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

  // Updated location persistence function for agent-based tracking
  const persistAgentLocation = useCallback(async (location?: {latitude: number, longitude: number} | null) => {
    if (!conversationId) {
      console.warn('⚠️ No conversation ID available for agent location persistence');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const locationData = {
        conversation_id: conversationId,
        user_id: userData?.user?.id || null, // Optional for analytics
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        accuracy: null
      };

      console.log('📍 Persisting agent location to database:', {
        conversationId,
        hasCoordinates: !!location,
        coordinates: location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : 'null'
      });
      
      const { error } = await supabase.functions.invoke('store-agent-location', {
        body: locationData
      });

      if (error) {
        console.warn('⚠️ Failed to persist agent location:', error);
      } else {
        console.log('✅ Successfully persisted agent location to database');
      }
    } catch (error) {
      console.warn('⚠️ Failed to persist agent location:', error);
      // Don't throw - we want to continue even if location persistence fails
    }
  }, [conversationId]);

  // Debounced location change handler
  const handleLocationChange = useCallback((location: {latitude: number, longitude: number}) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      // Check if this is a significant location change
      const hasSignificantChange = isSignificantLocationChange(
        { ...location, timestamp: Date.now() },
        lastProcessedLocationRef.current ? { ...lastProcessedLocationRef.current, timestamp: 0 } : null,
        50 // 50 meter threshold
      );
      
      if (hasSignificantChange) {
        console.log('📍 Significant location change detected (50m+), triggering contextual POI update');
        lastProcessedLocationRef.current = location;
        lastLocationRef.current = location;
        lastPersistedLocationRef.current = location;
        
        // Persist the significant location change
        persistAgentLocation(location).catch(err => 
          console.warn('⚠️ Failed to persist location change:', err)
        );
        
        // Fetch POIs and send system alert for significant location change
        fetchContextualPOIs(location, 'location_change').then(update => {
          if (update && onUpdate) {
            onUpdate(update);
          }
        });
      } else if (lastProcessedLocationRef.current) {
        console.log('📍 Minor location change detected (<50m), skipping POI update');
      }
    }, 1000); // 1 second debounce
  }, [persistAgentLocation, fetchContextualPOIs, onUpdate]);

  // Handle location changes with 50m threshold - watch for actual coordinate changes
  useEffect(() => {
    if (!enabled || !userLocation) {
      return;
    }

    const currentLocation = {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude
    };

    // Only process if coordinates actually changed
    if (!lastProcessedLocationRef.current || 
        lastProcessedLocationRef.current.latitude !== currentLocation.latitude ||
        lastProcessedLocationRef.current.longitude !== currentLocation.longitude) {
      handleLocationChange(currentLocation);
    }
  }, [enabled, userLocation?.latitude, userLocation?.longitude, handleLocationChange]);

  // Store function refs to prevent useEffect recreation
  const persistAgentLocationRef = useRef(persistAgentLocation);
  const fetchContextualPOIsRef = useRef(fetchContextualPOIs);
  const onUpdateRef = useRef(onUpdate);
  
  // Update refs when functions change
  useEffect(() => {
    persistAgentLocationRef.current = persistAgentLocation;
    fetchContextualPOIsRef.current = fetchContextualPOIs;
    onUpdateRef.current = onUpdate;
  }, [persistAgentLocation, fetchContextualPOIs, onUpdate]);

  // Start/stop polling based on enabled state with initial system alert
  useEffect(() => {
    if (enabled) {
      console.log('🚀 Starting contextual POI polling');
      setIsPolling(true);
      pollCountRef.current = 0;
      
      // ALWAYS persist location when POI polling starts (fresh start every session)
      // This ensures agent_locations record exists even if coordinates are null
      persistAgentLocationRef.current(userLocation).catch(err => 
        console.warn('⚠️ Failed to persist initial location:', err)
      );
      
      // Send initial system alert if we have valid location
      if (userLocation) {
        console.log('🎯 Sending initial system alert with nearby POIs');
        fetchContextualPOIsRef.current(userLocation, 'initial_location').then(update => {
          if (update && onUpdateRef.current) {
            onUpdateRef.current(update);
          }
        });
        
        // Set initial location references
        lastLocationRef.current = {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude
        };
        lastPersistedLocationRef.current = {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude
        };
        lastProcessedLocationRef.current = {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude
        };
      }
    } else {
      console.log('🛑 Stopping contextual POI polling');
      setIsPolling(false);
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, [enabled]);

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
  }, [fetchContextualPOIs, onUpdate]);

  return {
    isPolling,
    lastUpdate,
    error,
    manualRefresh,
    pollCount: pollCountRef.current
  };
};