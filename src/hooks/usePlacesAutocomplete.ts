
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlacePrediction {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
  types: string[];
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

export const usePlacesAutocomplete = () => {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string>('');
  
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Generate new session token
  const generateSessionToken = useCallback(() => {
    const token = crypto.randomUUID();
    setSessionToken(token);
    return token;
  }, []);

  // Get user location if available
  const getUserLocation = useCallback((): Promise<UserLocation | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        () => {
          resolve(null); // Fail silently if location not available
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    });
  }, []);

  // Search for places with debouncing
  const searchPlaces = useCallback(async (input: string) => {
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Clear predictions for empty input
    if (!input || input.trim().length < 2) {
      setPredictions([]);
      setError(null);
      return;
    }

    // Debounce the search
    debounceTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Generate session token if not exists
        let currentToken = sessionToken;
        if (!currentToken) {
          currentToken = generateSessionToken();
        }

        // Get user location
        const userLocation = await getUserLocation();

        console.log('🔍 Searching places for:', input);

        const { data, error: functionError } = await supabase.functions.invoke('google-places-autocomplete', {
          body: {
            input: input.trim(),
            sessionToken: currentToken,
            userLocation
          }
        });

        if (functionError) {
          console.error('Places autocomplete error:', functionError);
          throw new Error(functionError.message || 'Failed to search places');
        }

        setPredictions(data.predictions || []);
        
        if (data.error) {
          setError(data.error);
        }

      } catch (err) {
        console.error('Error searching places:', err);
        setError(err instanceof Error ? err.message : 'Failed to search places');
        setPredictions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce
  }, [sessionToken, generateSessionToken, getUserLocation]);

  // Clear search results
  const clearSearch = useCallback(() => {
    setPredictions([]);
    setError(null);
    setIsLoading(false);
    
    // Clear debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  // Reset session (for new search session)
  const resetSession = useCallback(() => {
    generateSessionToken();
    clearSearch();
  }, [generateSessionToken, clearSearch]);

  return {
    predictions,
    isLoading,
    error,
    sessionToken,
    searchPlaces,
    clearSearch,
    resetSession,
    generateSessionToken
  };
};
