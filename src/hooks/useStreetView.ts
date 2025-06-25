
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Landmark } from '@/data/landmarks';

interface StreetViewData {
  imageUrl: string;
  heading: number;
  pitch: number;
  fov: number;
  location: {
    lat: number;
    lng: number;
  };
  landmarkName: string;
  metadata: {
    status: string;
    copyright?: string;
  };
}

interface StreetViewCache {
  [landmarkId: string]: {
    data: StreetViewData;
    timestamp: number;
  };
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export const useStreetView = () => {
  const [isLoading, setIsLoading] = useState<{[key: string]: boolean}>({});
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<StreetViewCache>({});

  // Check if data is cached and still valid
  const getCachedData = useCallback((landmarkId: string): StreetViewData | null => {
    const cached = cacheRef.current[landmarkId];
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > CACHE_DURATION;
    if (isExpired) {
      delete cacheRef.current[landmarkId];
      return null;
    }

    return cached.data;
  }, []);

  // Fetch Street View data for a landmark
  const fetchStreetView = useCallback(async (landmark: Landmark): Promise<StreetViewData | null> => {
    const landmarkId = landmark.id;
    
    // Check cache first
    const cached = getCachedData(landmarkId);
    if (cached) {
      console.log(`📋 Using cached Street View data for ${landmark.name}`);
      return cached;
    }

    setIsLoading(prev => ({ ...prev, [landmarkId]: true }));
    setError(null);

    try {
      console.log(`🌍 Fetching Street View for ${landmark.name}`);
      
      const { data, error } = await supabase.functions.invoke('google-streetview', {
        body: {
          coordinates: landmark.coordinates,
          landmarkName: landmark.name,
          size: "640x640",
          fov: 90,
          pitch: 0
        }
      });

      if (error) {
        console.error(`❌ Error fetching Street View for ${landmark.name}:`, error);
        setError(`Failed to fetch Street View: ${error.message}`);
        return null;
      }

      if (!data) {
        console.log(`📭 No Street View data received for ${landmark.name}`);
        return null;
      }

      // Cache the data
      cacheRef.current[landmarkId] = {
        data,
        timestamp: Date.now()
      };

      console.log(`✅ Street View data cached for ${landmark.name}`);
      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`❌ Exception fetching Street View for ${landmark.name}:`, err);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(prev => ({ ...prev, [landmarkId]: false }));
    }
  }, [getCachedData]);

  // Pre-load Street View data in the background
  const preloadStreetView = useCallback(async (landmark: Landmark): Promise<void> => {
    const cached = getCachedData(landmark.id);
    if (cached) {
      console.log(`🚀 Street View already cached for ${landmark.name}`);
      return;
    }

    console.log(`🔄 Pre-loading Street View for ${landmark.name}`);
    await fetchStreetView(landmark);
  }, [fetchStreetView, getCachedData]);

  // Get Street View data (from cache or fetch)
  const getStreetView = useCallback(async (landmark: Landmark): Promise<StreetViewData | null> => {
    return await fetchStreetView(landmark);
  }, [fetchStreetView]);

  // Clear cache for a specific landmark
  const clearCache = useCallback((landmarkId?: string) => {
    if (landmarkId) {
      delete cacheRef.current[landmarkId];
      console.log(`🗑️ Cleared Street View cache for landmark ${landmarkId}`);
    } else {
      cacheRef.current = {};
      console.log('🗑️ Cleared all Street View cache');
    }
  }, []);

  return {
    fetchStreetView,
    preloadStreetView,
    getStreetView,
    getCachedData,
    clearCache,
    isLoading,
    error
  };
};
