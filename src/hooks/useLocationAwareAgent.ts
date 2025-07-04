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
  lastPeriodicPitch: { [placeId: string]: number };
  conversationId: string | null;
  isActive: boolean;
  lastPeriodicUpdate: number;
}

interface POIContextData {
  name: string;
  primaryType: string;
  coordinates: [number, number];
  briefSummary: string;
  placeId: string;
}

export const useLocationAwareAgent = (conversationId: string | null, conversation?: any) => {
  const { userLocation } = useLocationTracking();
  const { proximitySettings } = useProximityAlerts();
  const { isActiveInstance } = useProximityNotifications();
  
  // Track state for this conversation session
  const stateRef = useRef<LocationAwareAgentState>({
    mentionedPOIs: new Set(),
    lastPOIDistance: {},
    lastPeriodicPitch: {},
    conversationId: null,
    isActive: false,
    lastPeriodicUpdate: 0
  });

  // Get nearby landmarks for POI discovery (using larger radius for contextual awareness)
  const contextualDistance = proximitySettings?.outer_distance || 500; // 500m for contextual awareness
  const nearbyLandmarks = useNearbyLandmarks({
    userLocation,
    notificationDistance: contextualDistance
  });

  // Callback function to send contextual update to ElevenLabs agent
  const sendContextualUpdate = useCallback(async (poiData: POIContextData, isPeriodic = false) => {
    if (!conversationId || !stateRef.current.isActive || !conversation?.sendContextualUpdate) {
      console.log('🚫 Skipping contextual update - no active conversation or method unavailable');
      return;
    }

    try {
      const updateType = isPeriodic ? 'Nearby Discovery' : 'System Alert';
      const contextMessage = `${updateType}: User is now near ${poiData.name}. It is a ${poiData.primaryType} located at [${poiData.coordinates[0]}, ${poiData.coordinates[1]}]. A key fact about it: ${poiData.briefSummary}`;
      
      console.log('📡 Sending contextual update to ElevenLabs agent:', {
        conversationId,
        poiName: poiData.name,
        messageLength: contextMessage.length,
        isPeriodic
      });

      // Send directly via ElevenLabs conversation method
      conversation.sendContextualUpdate(contextMessage);
      
      // Mark this POI as mentioned and track timing
      stateRef.current.mentionedPOIs.add(poiData.placeId);
      if (isPeriodic) {
        stateRef.current.lastPeriodicPitch[poiData.placeId] = Date.now();
      }
      
      console.log('✅ Contextual update sent successfully via ElevenLabs API');
      
    } catch (error) {
      console.error('❌ Failed to send contextual update:', error);
    }
  }, [conversationId, conversation]);

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

  // Periodic POI pitching function
  const performPeriodicPitch = useCallback(async () => {
    if (!stateRef.current.isActive || nearbyLandmarks.length === 0) {
      return;
    }

    const now = Date.now();
    const COOLDOWN_PERIOD = 10 * 60 * 1000; // 10 minutes
    const PERIODIC_INTERVAL = 60 * 1000; // 1 minute between periodic pitches

    // Check if enough time has passed since last periodic update
    if (now - stateRef.current.lastPeriodicUpdate < PERIODIC_INTERVAL) {
      return;
    }

    // Find POIs that haven't been pitched recently or at all
    const availablePOIs = nearbyLandmarks.filter(({ landmark }) => {
      const lastPitch = stateRef.current.lastPeriodicPitch[landmark.placeId];
      const wasRecentlyMentioned = stateRef.current.mentionedPOIs.has(landmark.placeId) && 
                                  lastPitch && (now - lastPitch < COOLDOWN_PERIOD);
      
      return !wasRecentlyMentioned;
    });

    if (availablePOIs.length === 0) {
      console.log('🎯 No available POIs for periodic pitch');
      return;
    }

    // Select the closest POI or a random one from the top 3 closest
    const sortedPOIs = availablePOIs
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
    
    const selectedPOI = sortedPOIs[Math.floor(Math.random() * sortedPOIs.length)];
    
    console.log(`🎯 Performing periodic pitch for: ${selectedPOI.landmark.name} (${Math.round(selectedPOI.distance)}m away)`);
    
    // Update timing
    stateRef.current.lastPeriodicUpdate = now;
    
    // Process the POI for contextual update
    await processPeriodicPOI(selectedPOI.landmark);
    
  }, [nearbyLandmarks, sendContextualUpdate]);

  // Enhanced POI processing for periodic pitches
  const processPeriodicPOI = useCallback(async (landmark: TourLandmark) => {
    const placeId = landmark.placeId;
    
    console.log(`🔍 Processing periodic POI pitch: ${landmark.name}`);

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
        console.error('❌ Places API error for periodic POI:', error);
        // Fallback to basic landmark data
        const fallbackPOI: POIContextData = {
          name: landmark.name,
          primaryType: landmark.types?.[0] || 'point_of_interest',
          coordinates: landmark.coordinates,
          briefSummary: landmark.description || 'A notable location worth exploring.',
          placeId: placeId
        };
        await sendContextualUpdate(fallbackPOI, true);
        return;
      }

      if (data?.result) {
        const place = data.result;
        
        // Create rich POI context for periodic pitch
        const poiContext: POIContextData = {
          name: place.name || landmark.name,
          primaryType: place.types?.[0] || 'point_of_interest',
          coordinates: landmark.coordinates,
          briefSummary: place.editorial_summary?.text || 
                       landmark.description || 
                       `A ${place.types?.[0]?.replace(/_/g, ' ') || 'notable location'} with ${place.rating ? `a ${place.rating}/5 rating` : 'local significance'}.`,
          placeId: placeId
        };

        await sendContextualUpdate(poiContext, true);
      }
      
    } catch (error) {
      console.error('❌ Error processing periodic POI:', error);
    }
  }, [sendContextualUpdate]);

  // Monitor nearby landmarks and send contextual updates
  useEffect(() => {
    // Only proceed if conversation is active and we have location data
    // Note: We don't require isActiveInstance for contextual updates since the Tour Assistant should take priority
    if (!stateRef.current.isActive || !userLocation || nearbyLandmarks.length === 0) {
      console.log('🚫 Contextual updates blocked:', {
        isActive: stateRef.current.isActive,
        hasLocation: !!userLocation,
        nearbyCount: nearbyLandmarks.length,
        isActiveInstance
      });
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

  // Periodic pitching effect - runs every minute when conversation is active
  useEffect(() => {
    if (!stateRef.current.isActive) {
      return;
    }

    const interval = setInterval(() => {
      performPeriodicPitch();
    }, 45000); // Every 45 seconds

    return () => clearInterval(interval);
  }, [performPeriodicPitch, stateRef.current.isActive]);

  // Conversation lifecycle management
  const startLocationAwareness = useCallback((newConversationId: string) => {
    console.log('🎯 Starting location-aware agent for conversation:', newConversationId);
    
    stateRef.current = {
      mentionedPOIs: new Set(),
      lastPOIDistance: {},
      lastPeriodicPitch: {},
      conversationId: newConversationId,
      isActive: true,
      lastPeriodicUpdate: 0
    };
  }, []);

  const stopLocationAwareness = useCallback(() => {
    console.log('🛑 Stopping location-aware agent');
    
    stateRef.current = {
      mentionedPOIs: new Set(),
      lastPOIDistance: {},
      lastPeriodicPitch: {},
      conversationId: null,
      isActive: false,
      lastPeriodicUpdate: 0
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