
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
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

interface MultiViewpointResponse {
  primary: StreetViewData;
  viewpoints: StreetViewData[];
  metadata: {
    totalViews: number;
    recommendedView: number;
    dataUsage: string;
  };
}

interface ViewpointStrategy {
  strategy: 'single' | 'cardinal' | 'smart' | 'all';
  quality: 'low' | 'medium' | 'high';
}

interface MultiStreetViewCache {
  [landmarkId: string]: {
    data: MultiViewpointResponse | null;
    timestamp: number;
    strategy: string;
    isAvailable: boolean;
  };
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const NEGATIVE_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Determine viewpoint strategy based on distance and network conditions
const getViewpointStrategy = (distance?: number, networkQuality?: string): ViewpointStrategy => {
  const isSlowNetwork = networkQuality === 'slow' || networkQuality === '2g';
  
  if (!distance) {
    return { strategy: 'single', quality: 'medium' };
  }
  
  if (distance < 100) {
    // Very close - get all viewpoints with high quality unless network is slow
    return { 
      strategy: 'all', 
      quality: isSlowNetwork ? 'medium' : 'high' 
    };
  } else if (distance < 500) {
    // Close - get smart viewpoints with good quality
    return { 
      strategy: 'smart', 
      quality: isSlowNetwork ? 'low' : 'medium' 
    };
  } else if (distance < 1000) {
    // Moderate distance - cardinal directions
    return { 
      strategy: 'cardinal', 
      quality: isSlowNetwork ? 'low' : 'medium' 
    };
  } else {
    // Far - single view only
    return { 
      strategy: 'single', 
      quality: 'medium' 
    };
  }
};

export const useEnhancedStreetViewMulti = () => {
  const [isLoading, setIsLoading] = useState<{[key: string]: boolean}>({});
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<MultiStreetViewCache>({});
  const { isOnline, connectionType } = useNetworkStatus();
  
  const offlineCache = useOfflineCache<MultiViewpointResponse>({
    storeName: 'enhanced-streetview',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxItems: 100
  });

  // Check if data is cached and still valid
  const getCachedData = useCallback((landmarkId: string, strategy: string): MultiViewpointResponse | null => {
    const cached = cacheRef.current[landmarkId];
    if (!cached || cached.strategy !== strategy) return null;

    const cacheAge = Date.now() - cached.timestamp;
    const maxAge = cached.isAvailable ? CACHE_DURATION : NEGATIVE_CACHE_DURATION;
    
    if (cacheAge > maxAge) {
      delete cacheRef.current[landmarkId];
      return null;
    }

    return cached.data;
  }, []);

  // Check if Street View is known to be unavailable
  const isKnownUnavailable = useCallback((landmarkId: string): boolean => {
    const cached = cacheRef.current[landmarkId];
    if (!cached) return false;

    const cacheAge = Date.now() - cached.timestamp;
    return !cached.isAvailable && cacheAge <= NEGATIVE_CACHE_DURATION;
  }, []);

  // Fetch multi-viewpoint Street View data
  const fetchEnhancedStreetView = useCallback(async (
    landmark: Landmark,
    distance?: number,
    customStrategy?: ViewpointStrategy
  ): Promise<MultiViewpointResponse | null> => {
    const landmarkId = landmark.id;
    const strategy = customStrategy || getViewpointStrategy(distance, connectionType);
    const strategyKey = `${strategy.strategy}-${strategy.quality}`;
    
    // Check cache first
    const cached = getCachedData(landmarkId, strategyKey);
    if (cached !== null) {
      console.log(`📋 Using cached multi-viewpoint data for ${landmark.name} (${strategy.strategy})`);
      return cached;
    }

    // Check if we know it's unavailable
    if (isKnownUnavailable(landmarkId)) {
      console.log(`🚫 Enhanced Street View known to be unavailable for ${landmark.name}`);
      return null;
    }

    setIsLoading(prev => ({ ...prev, [landmarkId]: true }));
    setError(null);

    try {
      console.log(`🌍 Fetching enhanced Street View for ${landmark.name} (${strategy.strategy}, ${strategy.quality})`);
      
      const { data, error } = await supabase.functions.invoke('google-streetview-enhanced', {
        body: {
          coordinates: landmark.coordinates,
          landmarkName: landmark.name,
          viewpoints: strategy.strategy,
          quality: strategy.quality,
          landmarkType: landmark.description?.includes('building') ? 'building' : 
                       landmark.description?.includes('monument') ? 'monument' :
                       landmark.description?.includes('bridge') ? 'bridge' :
                       landmark.description?.includes('park') ? 'natural' : 'building'
        }
      });

      if (error) {
        console.error(`❌ Error fetching enhanced Street View for ${landmark.name}:`, error);
        
        // Cache negative result
        cacheRef.current[landmarkId] = {
          data: null,
          timestamp: Date.now(),
          strategy: strategyKey,
          isAvailable: false
        };
        
        setError(`Failed to fetch enhanced Street View: ${error.message}`);
        return null;
      }

      if (!data) {
        console.log(`📭 No enhanced Street View data received for ${landmark.name}`);
        
        // Cache negative result
        cacheRef.current[landmarkId] = {
          data: null,
          timestamp: Date.now(),
          strategy: strategyKey,
          isAvailable: false
        };
        
        return null;
      }

      // Cache successful result
      cacheRef.current[landmarkId] = {
        data,
        timestamp: Date.now(),
        strategy: strategyKey,
        isAvailable: true
      };

      console.log(`✅ Enhanced Street View data cached for ${landmark.name} (${data.viewpoints.length} viewpoints, ${data.metadata.dataUsage})`);
      
      // Cache for offline use if online
      if (isOnline && offlineCache.isReady) {
        try {
          await offlineCache.setItem(`${landmarkId}-${strategyKey}`, data);
        } catch (error) {
          console.warn(`⚠️ Failed to cache enhanced Street View offline for ${landmark.name}:`, error);
        }
      }
      
      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`❌ Exception fetching enhanced Street View for ${landmark.name}:`, err);
      
      // Try offline cache as fallback
      if (!isOnline && offlineCache.isReady) {
        try {
          const offlineData = await offlineCache.getItem(`${landmarkId}-${strategyKey}`);
          if (offlineData) {
            console.log(`💾 Using offline cache for enhanced Street View: ${landmark.name}`);
            return offlineData;
          }
        } catch (offlineError) {
          console.error(`❌ Offline cache fallback failed for ${landmark.name}:`, offlineError);
        }
      }
      
      // Cache negative result for network errors too
      cacheRef.current[landmarkId] = {
        data: null,
        timestamp: Date.now(),
        strategy: strategyKey,
        isAvailable: false
      };
      
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(prev => ({ ...prev, [landmarkId]: false }));
    }
  }, [getCachedData, isKnownUnavailable, connectionType, isOnline, offlineCache]);

  // Get the best viewpoint based on context
  const getBestViewpoint = useCallback((
    multiData: MultiViewpointResponse, 
    preferredHeading?: number
  ): StreetViewData => {
    if (!preferredHeading) {
      return multiData.primary;
    }

    // Find the viewpoint closest to the preferred heading
    const closestViewpoint = multiData.viewpoints.reduce((closest, current) => {
      const currentDiff = Math.abs(current.heading - preferredHeading);
      const closestDiff = Math.abs(closest.heading - preferredHeading);
      return currentDiff < closestDiff ? current : closest;
    });

    return closestViewpoint;
  }, []);

  // Preload enhanced Street View for proximity
  const preloadForProximity = useCallback(async (
    landmarks: Landmark[],
    userLocation: { latitude: number; longitude: number }
  ): Promise<void> => {
    if (!isOnline) return;

    console.log(`🔄 Pre-loading enhanced Street View for ${landmarks.length} landmarks`);
    
    for (const landmark of landmarks) {
      try {
        // Calculate distance for strategy selection
        const distance = Math.sqrt(
          Math.pow((landmark.coordinates[1] - userLocation.latitude) * 111000, 2) +
          Math.pow((landmark.coordinates[0] - userLocation.longitude) * 111000, 2)
        );

        // Check if already cached
        const strategy = getViewpointStrategy(distance, connectionType);
        const strategyKey = `${strategy.strategy}-${strategy.quality}`;
        const existing = getCachedData(landmark.id, strategyKey);
        if (existing) continue;

        // Fetch and cache
        await fetchEnhancedStreetView(landmark, distance);
        console.log(`✅ Pre-loaded enhanced Street View: ${landmark.name} (${Math.round(distance)}m away)`);
      } catch (error) {
        console.warn(`⚠️ Failed to pre-load enhanced Street View for ${landmark.name}:`, error);
      }
    }
  }, [fetchEnhancedStreetView, getCachedData, connectionType, isOnline]);

  // Clear cache
  const clearCache = useCallback((landmarkId?: string) => {
    if (landmarkId) {
      delete cacheRef.current[landmarkId];
      console.log(`🗑️ Cleared enhanced Street View cache for landmark ${landmarkId}`);
    } else {
      cacheRef.current = {};
      console.log('🗑️ Cleared all enhanced Street View cache');
    }
  }, []);

  return {
    fetchEnhancedStreetView,
    getBestViewpoint,
    preloadForProximity,
    getCachedData,
    isKnownUnavailable,
    clearCache,
    isLoading,
    error,
    getViewpointStrategy,
    isOfflineCacheReady: offlineCache.isReady
  };
};
