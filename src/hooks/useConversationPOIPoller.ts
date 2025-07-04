import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { supabase } from '@/integrations/supabase/client';

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

interface NearbyPlace {
  id: string;
  displayName: { text: string };
  primaryType: string;
  location: { latitude: number; longitude: number };
  editorialSummary?: { text: string };
  rating?: number;
  userRatingsTotal?: number;
  types: string[];
}

const POLLING_INTERVAL = 15000; // 15 seconds
const SEARCH_RADIUS = 150; // meters - optimal for walking tours

export const useConversationPOIPoller = (
  conversationId: string | null, 
  conversation?: any
) => {
  const { userLocation } = useLocationTracking();
  const { proximitySettings } = useProximityAlerts();
  const [nearbyPlacesCount, setNearbyPlacesCount] = useState(0);
  
  // State for this polling session
  const stateRef = useRef<POIPollerState>({
    mentionedPOIs: new Set(),
    lastPOIDistance: {},
    conversationId: null,
    isActive: false
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

  // Calculate distance between two coordinates
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }, []);

  // Search for nearby places using Google Places API
  const searchNearbyPlaces = useCallback(async (latitude: number, longitude: number): Promise<NearbyPlace[]> => {
    try {
      console.log(`🔍 Searching for nearby places at ${latitude}, ${longitude} within ${SEARCH_RADIUS}m`);
      
      const { data, error } = await supabase.functions.invoke('google-places-nearby', {
        body: {
          locationRestriction: {
            circle: {
              center: {
                latitude,
                longitude
              },
              radius: SEARCH_RADIUS
            }
          },
          maxResultCount: 3,
          rankPreference: "DISTANCE",
          includedTypes: [
            "tourist_attraction",
            "point_of_interest", 
            "cafe",
            "restaurant",
            "shopping_mall",
            "store",
            "art_gallery",
            "bar",
            "night_club",
            "park",
            "museum",
            "bakery",
            "souvenir_store",
            "clothing_store",
            "department_store"
          ],
          excludedTypes: [
            "lodging",
            "supermarket", 
            "convenience_store",
            "gas_station",
            "parking",
            "bank",
            "atm",
            "hospital",
            "pharmacy",
            "laundry",
            "car_repair",
            "car_wash",
            "light_rail_station",
            "subway_station",
            "train_station",
            "bus_station",
            "taxi_stand"
          ],
          languageCode: "en"
        }
      });

      if (error) {
        console.error('❌ Google Places Nearby API error:', error);
        return [];
      }

      const places = data?.places || [];
      console.log(`✅ Found ${places.length} nearby places`);
      return places;
      
    } catch (error) {
      console.error('❌ Error searching nearby places:', error);
      return [];
    }
  }, []);

  // Process nearby POI for contextual update
  const processNearbyPOI = useCallback(async (place: NearbyPlace, distance: number) => {
    const placeId = place.id;
    
    // Skip if already mentioned in this conversation
    if (stateRef.current.mentionedPOIs.has(placeId)) {
      return;
    }

    console.log(`🔍 Processing nearby POI for contextual update: ${place.displayName.text} (${Math.round(distance)}m)`);

    try {
      // Create POI context data
      const poiContext: POIContextData = {
        name: place.displayName.text,
        primaryType: place.primaryType || 'point_of_interest',
        coordinates: [place.location.longitude, place.location.latitude],
        briefSummary: place.editorialSummary?.text || 
                     `A ${place.primaryType?.replace(/_/g, ' ') || 'notable location'}${place.rating ? ` with a ${place.rating}/5 rating` : ''}.`,
        placeId: placeId
      };

      await sendContextualUpdate(poiContext);
      
    } catch (error) {
      console.error('❌ Error processing POI for context:', error);
    }
  }, [sendContextualUpdate]);

  // Polling function to check for nearby POIs
  const pollForNearbyPOIs = useCallback(async () => {
    if (!stateRef.current.isActive || !userLocation) {
      console.log('🔄 POI Polling skipped:', {
        isActive: stateRef.current.isActive,
        hasLocation: !!userLocation
      });
      return;
    }

    console.log('🔄 POI Polling: Searching for nearby places...');

    try {
      const nearbyPlaces = await searchNearbyPlaces(userLocation.latitude, userLocation.longitude);
      setNearbyPlacesCount(nearbyPlaces.length);

      if (nearbyPlaces.length === 0) {
        console.log('🔄 No nearby places found');
        return;
      }

      console.log(`🔄 POI Polling: Processing ${nearbyPlaces.length} nearby places`);

      // Process places that haven't been mentioned yet and are significantly close
      for (const place of nearbyPlaces) {
        const distance = calculateDistance(
          userLocation.latitude, 
          userLocation.longitude, 
          place.location.latitude, 
          place.location.longitude
        );

        const placeId = place.id;
        
        // Check if this is a significantly closer approach or first time seeing this POI
        const lastDistance = stateRef.current.lastPOIDistance[placeId];
        const isSignificantlyCloser = !lastDistance || (distance < lastDistance * 0.8); // 20% closer
        const isWithinContextualRange = distance <= SEARCH_RADIUS;
        
        if (isWithinContextualRange && isSignificantlyCloser && !stateRef.current.mentionedPOIs.has(placeId)) {
          console.log(`📍 POI within contextual range: ${place.displayName.text} (${Math.round(distance)}m)`);
          
          // Update distance tracking
          stateRef.current.lastPOIDistance[placeId] = distance;
          
          // Process for contextual update
          await processNearbyPOI(place, distance);
        }
      }

      // Cleanup distance tracking for POIs that are no longer nearby
      const currentPOIIds = new Set(nearbyPlaces.map(place => place.id));
      Object.keys(stateRef.current.lastPOIDistance).forEach(placeId => {
        if (!currentPOIIds.has(placeId)) {
          delete stateRef.current.lastPOIDistance[placeId];
        }
      });

    } catch (error) {
      console.error('❌ Error in POI polling:', error);
    }

  }, [userLocation, searchNearbyPlaces, calculateDistance, processNearbyPOI]);

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
    setNearbyPlacesCount(0);
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
    nearbyPOIsCount: nearbyPlacesCount,
    startPolling,
    stopPolling
  };
};