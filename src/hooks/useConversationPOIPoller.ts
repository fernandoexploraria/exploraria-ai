import { useEffect, useRef, useCallback } from 'react';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { supabase } from '@/integrations/supabase/client';
import { TourLandmark } from '@/data/tourLandmarks';

interface POIPollerState {
  mentionedPOIs: Set<string>;
  lastPOIDistance: { [placeId: string]: number };
  conversationId: string | null;
  isActive: boolean;
}

interface POIContextData {
  name: string;
  primaryType: string;
  coordinates: [number, number];
  briefSummary: string;
  placeId: string;
}

const POLLING_INTERVAL = 15000; // 15 seconds

export const useConversationPOIPoller = (
  conversationId: string | null, 
  conversation?: any
) => {
  const { userLocation } = useLocationTracking();
  const { proximitySettings } = useProximityAlerts();
  
  // State for this polling session
  const stateRef = useRef<POIPollerState>({
    mentionedPOIs: new Set(),
    lastPOIDistance: {},
    conversationId: null,
    isActive: false
  });

  // Get nearby landmarks for POI discovery
  const contextualDistance = proximitySettings?.outer_distance || 500;
  const nearbyLandmarks = useNearbyLandmarks({
    userLocation,
    notificationDistance: contextualDistance
  });

  // Send contextual update to ElevenLabs agent
  const sendContextualUpdate = useCallback(async (poiData: POIContextData) => {
    if (!stateRef.current.isActive || !conversation?.sendContextualUpdate) {
      console.log('🚫 Skipping contextual update - no active conversation or method unavailable');
      return;
    }

    try {
      const contextMessage = `System Alert: User is now near ${poiData.name}. It is a ${poiData.primaryType} located at [${poiData.coordinates[0]}, ${poiData.coordinates[1]}]. A key fact about it: ${poiData.briefSummary}`;
      
      console.log('📡 Sending contextual update to ElevenLabs agent:', {
        conversationId: stateRef.current.conversationId,
        poiName: poiData.name,
        messageLength: contextMessage.length
      });

      conversation.sendContextualUpdate(contextMessage);
      
      // Mark this POI as mentioned
      stateRef.current.mentionedPOIs.add(poiData.placeId);
      
      console.log('✅ Contextual update sent successfully');
      
    } catch (error) {
      console.error('❌ Failed to send contextual update:', error);
    }
  }, [conversation]);

  // Process nearby POI for contextual update
  const processNearbyPOI = useCallback(async (landmark: TourLandmark) => {
    const placeId = landmark.placeId;
    
    // Skip if already mentioned in this conversation
    if (stateRef.current.mentionedPOIs.has(placeId)) {
      return;
    }

    console.log(`🔍 Processing nearby POI for contextual update: ${landmark.name}`);

    try {
      // Get enhanced POI details from Google Places API
      const { data, error } = await supabase.functions.invoke('google-places-details', {
        body: {
          placeId: placeId,
          fields: [
            'name',
            'types',
            'editorial_summary',
            'formatted_address',
            'geometry',
            'rating',
            'user_ratings_total'
          ]
        }
      });

      if (error) {
        console.error('❌ Places API error for POI context:', error);
        // Fallback to basic landmark data
        const fallbackPOI: POIContextData = {
          name: landmark.name,
          primaryType: landmark.types?.[0] || 'point_of_interest',
          coordinates: landmark.coordinates,
          briefSummary: landmark.description || 'A notable location worth exploring.',
          placeId: placeId
        };
        await sendContextualUpdate(fallbackPOI);
        return;
      }

      if (data?.result) {
        const place = data.result;
        
        // Create rich POI context
        const poiContext: POIContextData = {
          name: place.name || landmark.name,
          primaryType: place.types?.[0] || 'point_of_interest',
          coordinates: landmark.coordinates,
          briefSummary: place.editorial_summary?.text || 
                       landmark.description || 
                       `A ${place.types?.[0]?.replace(/_/g, ' ') || 'notable location'} with ${place.rating ? `a ${place.rating}/5 rating` : 'local significance'}.`,
          placeId: placeId
        };

        await sendContextualUpdate(poiContext);
      }
      
    } catch (error) {
      console.error('❌ Error processing POI for context:', error);
    }
  }, [sendContextualUpdate]);

  // Polling function to check for nearby POIs
  const pollForNearbyPOIs = useCallback(async () => {
    if (!stateRef.current.isActive || !userLocation || nearbyLandmarks.length === 0) {
      console.log('🔄 POI Polling skipped:', {
        isActive: stateRef.current.isActive,
        hasLocation: !!userLocation,
        nearbyCount: nearbyLandmarks.length
      });
      return;
    }

    console.log(`🔄 POI Polling: Checking ${nearbyLandmarks.length} nearby landmarks`);

    // Process landmarks that haven't been mentioned yet and are significantly close
    nearbyLandmarks.forEach(({ landmark, distance }) => {
      const placeId = landmark.placeId;
      
      // Check if this is a significantly closer approach or first time seeing this POI
      const lastDistance = stateRef.current.lastPOIDistance[placeId];
      const isSignificantlyCloser = !lastDistance || (distance < lastDistance * 0.8); // 20% closer
      const isWithinContextualRange = distance <= contextualDistance;
      
      if (isWithinContextualRange && isSignificantlyCloser && !stateRef.current.mentionedPOIs.has(placeId)) {
        console.log(`📍 POI within contextual range: ${landmark.name} (${Math.round(distance)}m)`);
        
        // Update distance tracking
        stateRef.current.lastPOIDistance[placeId] = distance;
        
        // Process for contextual update
        processNearbyPOI(landmark);
      }
    });

    // Cleanup distance tracking for POIs that are no longer nearby
    const currentPOIIds = new Set(nearbyLandmarks.map(nl => nl.landmark.placeId));
    Object.keys(stateRef.current.lastPOIDistance).forEach(placeId => {
      if (!currentPOIIds.has(placeId)) {
        delete stateRef.current.lastPOIDistance[placeId];
      }
    });

  }, [nearbyLandmarks, userLocation, contextualDistance, processNearbyPOI]);

  // Start polling when conversation becomes active
  const startPolling = useCallback((newConversationId: string) => {
    console.log('🔄 Starting POI polling for conversation:', newConversationId);
    
    stateRef.current = {
      mentionedPOIs: new Set(),
      lastPOIDistance: {},
      conversationId: newConversationId,
      isActive: true
    };
  }, []);

  // Stop polling when conversation ends
  const stopPolling = useCallback(() => {
    console.log('🛑 Stopping POI polling');
    
    stateRef.current = {
      mentionedPOIs: new Set(),
      lastPOIDistance: {},
      conversationId: null,
      isActive: false
    };
  }, []);

  // Update conversation ID when it changes
  useEffect(() => {
    if (conversationId && conversationId !== stateRef.current.conversationId) {
      startPolling(conversationId);
    } else if (!conversationId && stateRef.current.isActive) {
      stopPolling();
    }
  }, [conversationId, startPolling, stopPolling]);

  // Set up polling interval when active
  useEffect(() => {
    if (!stateRef.current.isActive) {
      return;
    }

    console.log('🔄 Setting up POI polling interval (15s)');
    const interval = setInterval(pollForNearbyPOIs, POLLING_INTERVAL);

    // Initial poll
    pollForNearbyPOIs();

    return () => {
      console.log('🔄 Cleaning up POI polling interval');
      clearInterval(interval);
    };
  }, [pollForNearbyPOIs, stateRef.current.isActive]);

  return {
    isActive: stateRef.current.isActive,
    mentionedPOIsCount: stateRef.current.mentionedPOIs.size,
    nearbyPOIsCount: nearbyLandmarks.length,
    startPolling,
    stopPolling
  };
};