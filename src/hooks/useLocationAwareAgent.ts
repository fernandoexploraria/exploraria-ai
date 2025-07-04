import { useEffect, useRef, useCallback } from 'react';
import { useProximityNotifications } from '@/hooks/useProximityNotifications';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { supabase } from '@/integrations/supabase/client';
import { TourLandmark } from '@/data/tourLandmarks';

interface LocationAwareAgentState {
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

export const useLocationAwareAgent = (conversationId: string | null) => {
  const { userLocation } = useLocationTracking();
  const { proximitySettings } = useProximityAlerts();
  const { isActiveInstance } = useProximityNotifications();
  
  // Track state for this conversation session
  const stateRef = useRef<LocationAwareAgentState>({
    mentionedPOIs: new Set(),
    lastPOIDistance: {},
    conversationId: null,
    isActive: false
  });

  // Get nearby landmarks for POI discovery (using larger radius for contextual awareness)
  const contextualDistance = proximitySettings?.outer_distance || 500; // 500m for contextual awareness
  const nearbyLandmarks = useNearbyLandmarks({
    userLocation,
    notificationDistance: contextualDistance
  });

  // Callback function to send contextual update to ElevenLabs agent
  const sendContextualUpdate = useCallback(async (poiData: POIContextData) => {
    if (!conversationId || !stateRef.current.isActive) {
      console.log('🚫 Skipping contextual update - no active conversation');
      return;
    }

    try {
      const contextMessage = `System Alert: User is now near ${poiData.name}. It is a ${poiData.primaryType} located at [${poiData.coordinates[0]}, ${poiData.coordinates[1]}]. A key fact about it: ${poiData.briefSummary}`;
      
      console.log('📡 Sending contextual update to ElevenLabs agent:', {
        conversationId,
        poiName: poiData.name,
        messageLength: contextMessage.length
      });

      // Send contextual_update via ElevenLabs WebSocket
      // This will be handled by the conversation instance in NewTourAssistant
      if ((window as any).sendElevenLabsContextualUpdate) {
        (window as any).sendElevenLabsContextualUpdate({
          type: 'contextual_update',
          text: contextMessage
        });
        
        // Mark this POI as mentioned
        stateRef.current.mentionedPOIs.add(poiData.placeId);
        
        console.log('✅ Contextual update sent successfully');
      } else {
        console.warn('⚠️ ElevenLabs contextual update function not available');
      }
      
    } catch (error) {
      console.error('❌ Failed to send contextual update:', error);
    }
  }, [conversationId]);

  // Enhanced POI processing with Google Places API for richer context
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

  // Monitor nearby landmarks and send contextual updates
  useEffect(() => {
    // Only proceed if this is the active proximity instance and conversation is active
    if (!isActiveInstance || !stateRef.current.isActive || !userLocation || nearbyLandmarks.length === 0) {
      return;
    }

    console.log(`🎯 Checking ${nearbyLandmarks.length} nearby landmarks for contextual updates`);

    // Process landmarks that haven't been mentioned yet
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
        
        // Process for contextual update (debounced by the mentioned POIs set)
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

  }, [nearbyLandmarks, userLocation, isActiveInstance, processNearbyPOI, contextualDistance]);

  // Conversation lifecycle management
  const startLocationAwareness = useCallback((newConversationId: string) => {
    console.log('🎯 Starting location-aware agent for conversation:', newConversationId);
    
    stateRef.current = {
      mentionedPOIs: new Set(),
      lastPOIDistance: {},
      conversationId: newConversationId,
      isActive: true
    };
  }, []);

  const stopLocationAwareness = useCallback(() => {
    console.log('🛑 Stopping location-aware agent');
    
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
      startLocationAwareness(conversationId);
    } else if (!conversationId && stateRef.current.isActive) {
      stopLocationAwareness();
    }
  }, [conversationId, startLocationAwareness, stopLocationAwareness]);

  return {
    isActive: stateRef.current.isActive,
    mentionedPOIsCount: stateRef.current.mentionedPOIs.size,
    nearbyPOIsCount: nearbyLandmarks.length,
    startLocationAwareness,
    stopLocationAwareness
  };
};