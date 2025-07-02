
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

interface PanoramaData {
  panoId: string;
  location: {
    lat: number;
    lng: number;
  };
  isAvailable: boolean;
  landmarkName: string;
  metadata: {
    status: string;
    copyright?: string;
  };
}

interface StreetViewCache {
  [landmarkId: string]: {
    data: StreetViewData | null; // null indicates Street View not available
    timestamp: number;
    isAvailable: boolean;
    hasPanorama?: boolean; // indicates if interactive panorama is available
    panoramaData?: PanoramaData | null; // NEW: cached panorama data
  };
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const NEGATIVE_CACHE_DURATION = 60 * 60 * 1000; // 1 hour for failed requests

export const useStreetView = () => {
  const [isLoading, setIsLoading] = useState<{[key: string]: boolean}>({});
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<StreetViewCache>({});

  // Check if data is cached and still valid
  const getCachedData = useCallback((landmarkId: string): StreetViewData | null => {
    const cached = cacheRef.current[landmarkId];
    if (!cached) return null;

    const cacheAge = Date.now() - cached.timestamp;
    const maxAge = cached.isAvailable ? CACHE_DURATION : NEGATIVE_CACHE_DURATION;
    
    if (cacheAge > maxAge) {
      delete cacheRef.current[landmarkId];
      return null;
    }

    return cached.data;
  }, []);

  // Check if Street View is known to be unavailable (cached negative result)
  const isKnownUnavailable = useCallback((landmarkId: string): boolean => {
    const cached = cacheRef.current[landmarkId];
    if (!cached) return false;

    const cacheAge = Date.now() - cached.timestamp;
    return !cached.isAvailable && cacheAge <= NEGATIVE_CACHE_DURATION;
  }, []);

  // Check if panorama is available for a landmark
  const hasPanoramaAvailable = useCallback((landmarkId: string): boolean => {
    const cached = cacheRef.current[landmarkId];
    return cached?.hasPanorama === true;
  }, []);

  // Set panorama availability for a landmark
  const setPanoramaAvailability = useCallback((landmarkId: string, available: boolean) => {
    if (cacheRef.current[landmarkId]) {
      cacheRef.current[landmarkId].hasPanorama = available;
    }
  }, []);

  // NEW: Get cached panorama data
  const getCachedPanoramaData = useCallback((landmarkId: string): PanoramaData | null => {
    const cached = cacheRef.current[landmarkId];
    if (!cached || !cached.panoramaData) return null;

    const cacheAge = Date.now() - cached.timestamp;
    const maxAge = cached.hasPanorama ? CACHE_DURATION : NEGATIVE_CACHE_DURATION;
    
    if (cacheAge > maxAge) {
      return null;
    }

    return cached.panoramaData;
  }, []);

  // NEW: Fetch panorama data for a landmark
  const fetchPanoramaData = useCallback(async (landmark: Landmark): Promise<PanoramaData | null> => {
    const landmarkId = landmark.id;
    
    // Check cache first
    const cached = getCachedPanoramaData(landmarkId);
    if (cached !== null) {
      console.log(`📋 Using cached panorama data for ${landmark.name}`);
      return cached;
    }

    setIsLoading(prev => ({ ...prev, [landmarkId]: true }));
    setError(null);

    try {
      console.log(`🌍 Fetching panorama data for ${landmark.name}`);
      
      const { data, error } = await supabase.functions.invoke('google-streetview-enhanced', {
        body: {
          coordinates: landmark.coordinates,
          landmarkName: landmark.name,
          requestType: 'panorama' // NEW: request only panorama data
        }
      });

      if (error) {
        console.error(`❌ Error fetching panorama data for ${landmark.name}:`, error);
        
        // Cache negative result
        if (cacheRef.current[landmarkId]) {
          cacheRef.current[landmarkId].panoramaData = null;
          cacheRef.current[landmarkId].hasPanorama = false;
        } else {
          cacheRef.current[landmarkId] = {
            data: null,
            timestamp: Date.now(),
            isAvailable: false,
            hasPanorama: false,
            panoramaData: null
          };
        }
        
        setError(`Failed to fetch panorama data: ${error.message}`);
        return null;
      }

      if (!data || !data.panorama) {
        console.log(`📭 No panorama data received for ${landmark.name}`);
        
        // Cache negative result
        if (cacheRef.current[landmarkId]) {
          cacheRef.current[landmarkId].panoramaData = null;
          cacheRef.current[landmarkId].hasPanorama = false;
        } else {
          cacheRef.current[landmarkId] = {
            data: null,
            timestamp: Date.now(),
            isAvailable: false,
            hasPanorama: false,
            panoramaData: null
          };
        }
        
        return null;
      }

      const panoramaData = data.panorama;

      // Cache successful result
      if (cacheRef.current[landmarkId]) {
        cacheRef.current[landmarkId].panoramaData = panoramaData;
        cacheRef.current[landmarkId].hasPanorama = panoramaData.isAvailable;
        cacheRef.current[landmarkId].timestamp = Date.now();
      } else {
        cacheRef.current[landmarkId] = {
          data: null,
          timestamp: Date.now(),
          isAvailable: false,
          hasPanorama: panoramaData.isAvailable,
          panoramaData: panoramaData
        };
      }

      console.log(`✅ Panorama data cached for ${landmark.name}:`, panoramaData.isAvailable);
      return panoramaData;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`❌ Exception fetching panorama data for ${landmark.name}:`, err);
      
      // Cache negative result for network errors too
      if (cacheRef.current[landmarkId]) {
        cacheRef.current[landmarkId].panoramaData = null;
        cacheRef.current[landmarkId].hasPanorama = false;
      } else {
        cacheRef.current[landmarkId] = {
          data: null,
          timestamp: Date.now(),
          isAvailable: false,
          hasPanorama: false,
          panoramaData: null
        };
      }
      
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(prev => ({ ...prev, [landmarkId]: false }));
    }
  }, [getCachedPanoramaData]);

  // Fetch Street View data for a landmark
  const fetchStreetView = useCallback(async (landmark: Landmark): Promise<StreetViewData | null> => {
    const landmarkId = landmark.id;
    
    // Check cache first
    const cached = getCachedData(landmarkId);
    if (cached !== null) {
      console.log(`📋 Using cached Street View data for ${landmark.name}`);
      return cached;
    }

    // Check if we know it's unavailable
    if (isKnownUnavailable(landmarkId)) {
      console.log(`🚫 Street View known to be unavailable for ${landmark.name} (cached)`);
      return null;
    }

    setIsLoading(prev => ({ ...prev, [landmarkId]: true }));
    setError(null);

    try {
      console.log(`🌍 Fetching Street View for ${landmark.name}`);
      
      const { data, error } = await supabase.functions.invoke('google-streetview-enhanced', {
        body: {
          coordinates: landmark.coordinates,
          landmarkName: landmark.name,
          size: "640x640",
          fov: 90,
          pitch: 0,
          requestType: 'both' // Get both image and panorama data
        }
      });

      if (error) {
        console.error(`❌ Error fetching Street View for ${landmark.name}:`, error);
        
        // Cache negative result
        cacheRef.current[landmarkId] = {
          data: null,
          timestamp: Date.now(),
          isAvailable: false,
          hasPanorama: false
        };
        
        setError(`Failed to fetch Street View: ${error.message}`);
        return null;
      }

      if (!data || !data.primary) {
        console.log(`📭 No Street View data received for ${landmark.name}`);
        
        // Cache negative result
        cacheRef.current[landmarkId] = {
          data: null,
          timestamp: Date.now(),
          isAvailable: false,
          hasPanorama: false
        };
        
        return null;
      }

      const streetViewData = data.primary;
      const panoramaData = data.panorama;

      // Cache successful result
      cacheRef.current[landmarkId] = {
        data: streetViewData,
        timestamp: Date.now(),
        isAvailable: true,
        hasPanorama: panoramaData?.isAvailable || false,
        panoramaData: panoramaData || null
      };

      console.log(`✅ Street View data cached for ${landmark.name}`);
      return streetViewData;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`❌ Exception fetching Street View for ${landmark.name}:`, err);
      
      // Cache negative result for network errors too
      cacheRef.current[landmarkId] = {
        data: null,
        timestamp: Date.now(),
        isAvailable: false,
        hasPanorama: false
      };
      
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(prev => ({ ...prev, [landmarkId]: false }));
    }
  }, [getCachedData, isKnownUnavailable]);

  // Pre-load Street View data in the background
  const preloadStreetView = useCallback(async (landmark: Landmark): Promise<void> => {
    const cached = getCachedData(landmark.id);
    if (cached !== null || isKnownUnavailable(landmark.id)) {
      console.log(`🚀 Street View already processed for ${landmark.name}`);
      return;
    }

    console.log(`🔄 Pre-loading Street View for ${landmark.name}`);
    await fetchStreetView(landmark);
  }, [fetchStreetView, getCachedData, isKnownUnavailable]);

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
    isKnownUnavailable,
    hasPanoramaAvailable,
    setPanoramaAvailability,
    fetchPanoramaData, // NEW
    getCachedPanoramaData, // NEW
    clearCache,
    isLoading,
    error
  };
};
