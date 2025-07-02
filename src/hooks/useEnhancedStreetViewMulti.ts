import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Landmark } from '@/data/landmarks';
import { CacheTestUtils, performanceBenchmark } from '@/utils/streetViewTestUtils';

interface PanoramaData {
  pano_id: string;
  position: { lat: number; lng: number };
  links: Array<{ heading: number; pano_id: string; description?: string }>;
  copyright?: string;
  date?: string;
  status: 'OK' | 'ZERO_RESULTS' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED';
}

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
  panorama?: PanoramaData;
  panoramaAvailable: boolean;
}

interface MultiViewpointResponse {
  primary: StreetViewData;
  viewpoints: StreetViewData[];
  metadata: {
    totalViews: number;
    recommendedView: number;
    dataUsage: string;
    panoramaStats?: {
      availableCount: number;
      totalRequested: number;
      panoramaIds: string[];
      hasConnectedViews: boolean;
    };
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
    hasPanorama: boolean;
    panoramaIds: string[];
    size?: number;
  };
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const NEGATIVE_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Enhanced strategy selection with panorama considerations
const getViewpointStrategy = (distance?: number, networkQuality?: string): ViewpointStrategy => {
  const isSlowNetwork = networkQuality === 'slow' || networkQuality === '2g' || networkQuality === 'slow-2g';
  
  let strategy: ViewpointStrategy['strategy'];
  let quality: ViewpointStrategy['quality'];
  let reasoning: string;
  
  if (!distance) {
    strategy = 'single';
    quality = 'medium';
    reasoning = 'No distance provided, defaulting to single view';
  } else if (distance < 100) {
    strategy = 'all';
    quality = isSlowNetwork ? 'medium' : 'high';
    reasoning = `Very close (${Math.round(distance)}m), all viewpoints needed for comprehensive panorama experience`;
  } else if (distance < 500) {
    strategy = 'smart';
    quality = isSlowNetwork ? 'low' : 'medium';
    reasoning = `Close distance (${Math.round(distance)}m), smart selection optimal for panorama navigation`;
  } else if (distance < 1000) {
    strategy = 'cardinal';
    quality = isSlowNetwork ? 'low' : 'medium';
    reasoning = `Moderate distance (${Math.round(distance)}m), cardinal directions sufficient`;
  } else {
    strategy = 'single';
    quality = 'medium';
    reasoning = `Far distance (${Math.round(distance)}m), single view adequate`;
  }

  console.log(`📐 Enhanced Strategy Selection:`, {
    distance: distance ? `${Math.round(distance)}m` : 'unknown',
    networkQuality,
    isSlowNetwork,
    selectedStrategy: strategy,
    selectedQuality: quality,
    reasoning,
    panoramaOptimized: distance && distance < 500
  });

  return { strategy, quality };
};

export const useEnhancedStreetViewMulti = () => {
  const [isLoading, setIsLoading] = useState<{[key: string]: boolean}>({});
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<MultiStreetViewCache>({});
  const { isOnline, connectionType, effectiveType, downlink } = useNetworkStatus();
  const cacheTestUtils = CacheTestUtils.getInstance();
  
  const offlineCache = useOfflineCache<MultiViewpointResponse>({
    storeName: 'enhanced-streetview',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxItems: 100
  });

  // Enhanced cache operations with panorama metadata
  const getCachedData = useCallback((landmarkId: string, strategy: string): MultiViewpointResponse | null => {
    const cached = cacheRef.current[landmarkId];
    if (!cached || cached.strategy !== strategy) {
      cacheTestUtils.recordMiss();
      console.log(`💾 Cache miss for ${landmarkId} with strategy ${strategy}`);
      return null;
    }

    const cacheAge = Date.now() - cached.timestamp;
    const maxAge = cached.isAvailable ? CACHE_DURATION : NEGATIVE_CACHE_DURATION;
    
    if (cacheAge > maxAge) {
      delete cacheRef.current[landmarkId];
      cacheTestUtils.recordDelete(cached.size || 0);
      cacheTestUtils.recordMiss();
      console.log(`💾 Cache expired for ${landmarkId}, age: ${Math.round(cacheAge / 1000)}s`);
      return null;
    }

    cacheTestUtils.recordHit();
    console.log(`💾 Cache hit for ${landmarkId}:`, {
      age: `${Math.round(cacheAge / 1000)}s`,
      hasPanorama: cached.hasPanorama,
      panoramaIds: cached.panoramaIds.length
    });
    return cached.data;
  }, [cacheTestUtils]);

  const setCachedData = useCallback((
    landmarkId: string, 
    data: MultiViewpointResponse | null, 
    strategy: string, 
    isAvailable: boolean
  ) => {
    const estimatedSize = data ? JSON.stringify(data).length : 0;
    
    // Extract panorama information for cache metadata
    const hasPanorama = data?.viewpoints.some(vp => vp.panoramaAvailable) || false;
    const panoramaIds = data?.viewpoints
      .filter(vp => vp.panorama?.pano_id)
      .map(vp => vp.panorama!.pano_id) || [];
    
    cacheRef.current[landmarkId] = {
      data,
      timestamp: Date.now(),
      strategy,
      isAvailable,
      hasPanorama,
      panoramaIds,
      size: estimatedSize
    };
    
    cacheTestUtils.recordSet(estimatedSize);
    console.log(`💾 Cached enhanced data for ${landmarkId}:`, {
      strategy,
      isAvailable,
      size: `${(estimatedSize / 1024).toFixed(2)} KB`,
      viewpoints: data?.viewpoints.length || 0,
      hasPanorama,
      panoramaIds: panoramaIds.length,
      panoramaStats: data?.metadata.panoramaStats
    });
  }, [cacheTestUtils]);

  const isKnownUnavailable = useCallback((landmarkId: string): boolean => {
    const cached = cacheRef.current[landmarkId];
    if (!cached) return false;

    const cacheAge = Date.now() - cached.timestamp;
    const isUnavailable = !cached.isAvailable && cacheAge <= NEGATIVE_CACHE_DURATION;
    
    if (isUnavailable) {
      console.log(`🚫 Known unavailable: ${landmarkId}, cached ${Math.round(cacheAge / 1000)}s ago`);
    }
    
    return isUnavailable;
  }, []);

  // Enhanced panorama availability checking
  const hasPanoramaData = useCallback((landmarkId: string): boolean => {
    const cached = cacheRef.current[landmarkId];
    return cached?.hasPanorama || false;
  }, []);

  const getPanoramaIds = useCallback((landmarkId: string): string[] => {
    const cached = cacheRef.current[landmarkId];
    return cached?.panoramaIds || [];
  }, []);

  // Enhanced fetch with panorama data processing
  const fetchEnhancedStreetView = useCallback(async (
    landmark: Landmark,
    distance?: number,
    customStrategy?: ViewpointStrategy
  ): Promise<MultiViewpointResponse | null> => {
    const landmarkId = landmark.id;
    const strategy = customStrategy || getViewpointStrategy(distance, effectiveType);
    const strategyKey = `${strategy.strategy}-${strategy.quality}`;
    
    // Enhanced performance and network logging
    console.log(`🌍 Fetching enhanced Street View with panorama support:`, {
      landmark: landmark.name,
      distance: distance ? `${Math.round(distance)}m` : 'unknown',
      strategy: strategy.strategy,
      quality: strategy.quality,
      network: {
        isOnline,
        connectionType,
        effectiveType,
        downlink: `${downlink} Mbps`
      }
    });
    
    // Check cache first
    const cached = getCachedData(landmarkId, strategyKey);
    if (cached !== null) {
      console.log(`📋 Using cached data for ${landmark.name}:`, {
        hasPanorama: cached.metadata.panoramaStats?.availableCount || 0 > 0,
        panoramaIds: cached.metadata.panoramaStats?.panoramaIds || []
      });
      return cached;
    }

    // Check if known unavailable
    if (isKnownUnavailable(landmarkId)) {
      console.log(`🚫 Skipping known unavailable landmark: ${landmark.name}`);
      return null;
    }

    setIsLoading(prev => ({ ...prev, [landmarkId]: true }));
    setError(null);

    try {
      const result = await performanceBenchmark.measure(
        `Enhanced Street View API with Panorama - ${landmark.name}`,
        async () => {
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

          if (error) throw new Error(error.message);
          return data;
        },
        { landmark: landmark.name, strategy: strategy.strategy, quality: strategy.quality, panorama: true }
      );

      if (!result) {
        console.log(`📭 No enhanced Street View data for ${landmark.name}`);
        setCachedData(landmarkId, null, strategyKey, false);
        return null;
      }

      // Enhanced success logging with panorama details
      const panoramaStats = result.metadata.panoramaStats;
      console.log(`✅ Enhanced Street View with panorama loaded:`, {
        landmark: landmark.name,
        viewpoints: result.viewpoints.length,
        dataUsage: result.metadata.dataUsage,
        recommendedView: result.metadata.recommendedView,
        strategy: strategy.strategy,
        quality: strategy.quality,
        panorama: {
          available: panoramaStats?.availableCount || 0,
          total: panoramaStats?.totalRequested || 0,
          connected: panoramaStats?.hasConnectedViews || false,
          ids: panoramaStats?.panoramaIds || []
        }
      });
      
      setCachedData(landmarkId, result, strategyKey, true);
      
      // Cache for offline use if online
      if (isOnline && offlineCache.isReady) {
        try {
          await offlineCache.setItem(`${landmarkId}-${strategyKey}`, result);
          console.log(`💾 Offline cached with panorama: ${landmark.name}`);
        } catch (error) {
          console.warn(`⚠️ Failed to cache offline for ${landmark.name}:`, error);
        }
      }
      
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`❌ Enhanced Street View error for ${landmark.name}:`, {
        error: errorMessage,
        strategy: strategy.strategy,
        network: { isOnline, effectiveType, downlink }
      });
      
      // Try offline cache as fallback
      if (!isOnline && offlineCache.isReady) {
        try {
          const offlineData = await offlineCache.getItem(`${landmarkId}-${strategyKey}`);
          if (offlineData) {
            console.log(`💾 Using offline fallback with panorama: ${landmark.name}`);
            return offlineData;
          }
        } catch (offlineError) {
          console.error(`❌ Offline fallback failed for ${landmark.name}:`, offlineError);
        }
      }
      
      setCachedData(landmarkId, null, strategyKey, false);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(prev => ({ ...prev, [landmarkId]: false }));
    }
  }, [getCachedData, setCachedData, isKnownUnavailable, effectiveType, isOnline, offlineCache, connectionType, downlink]);

  // Enhanced preloading with panorama prioritization
  const preloadForProximity = useCallback(async (
    landmarks: Landmark[],
    userLocation: { latitude: number; longitude: number }
  ): Promise<void> => {
    if (!isOnline) {
      console.log('🔄 Skipping preload: offline');
      return;
    }

    console.log(`🔄 Starting proximity preload with panorama prioritization:`, {
      landmarks: landmarks.length,
      userLocation,
      network: { effectiveType, downlink }
    });
    
    // Sort landmarks by distance for prioritized preloading
    const landmarksWithDistance = landmarks.map(landmark => {
      const distance = Math.sqrt(
        Math.pow((landmark.coordinates[1] - userLocation.latitude) * 111000, 2) +
        Math.pow((landmark.coordinates[0] - userLocation.longitude) * 111000, 2)
      );
      return { landmark, distance };
    }).sort((a, b) => a.distance - b.distance);

    const preloadPromises = landmarksWithDistance.map(async ({ landmark, distance }) => {
      try {
        const strategy = getViewpointStrategy(distance, effectiveType);
        const strategyKey = `${strategy.strategy}-${strategy.quality}`;
        const existing = getCachedData(landmark.id, strategyKey);
        
        if (existing) {
          const hasPanorama = existing.metadata.panoramaStats?.availableCount || 0 > 0;
          console.log(`⚡ Preload skip (cached): ${landmark.name} (panorama: ${hasPanorama ? 'YES' : 'NO'})`);
          return;
        }

        const result = await fetchEnhancedStreetView(landmark, distance);
        const panoramaInfo = result?.metadata.panoramaStats;
        console.log(`⚡ Preloaded: ${landmark.name} (${Math.round(distance)}m)`, {
          panorama: panoramaInfo ? `${panoramaInfo.availableCount}/${panoramaInfo.totalRequested}` : 'N/A',
          connected: panoramaInfo?.hasConnectedViews || false
        });
      } catch (error) {
        console.warn(`⚠️ Preload failed: ${landmark.name}`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
    console.log(`✅ Proximity preload completed for ${landmarks.length} landmarks with panorama data`);
  }, [fetchEnhancedStreetView, getCachedData, effectiveType, isOnline, downlink]);

  const getBestViewpoint = useCallback((
    multiData: MultiViewpointResponse, 
    preferredHeading?: number
  ): StreetViewData => {
    if (!preferredHeading) {
      console.log(`📍 Using primary viewpoint (no preferred heading)`);
      return multiData.primary;
    }

    const closestViewpoint = multiData.viewpoints.reduce((closest, current) => {
      const currentDiff = Math.abs(current.heading - preferredHeading);
      const closestDiff = Math.abs(closest.heading - preferredHeading);
      return currentDiff < closestDiff ? current : closest;
    });

    console.log(`📍 Best viewpoint selected:`, {
      preferredHeading,
      selectedHeading: closestViewpoint.heading,
      difference: Math.abs(closestViewpoint.heading - preferredHeading)
    });

    return closestViewpoint;
  }, []);

  const clearCache = useCallback((landmarkId?: string) => {
    if (landmarkId) {
      const cached = cacheRef.current[landmarkId];
      if (cached) {
        cacheTestUtils.recordDelete(cached.size || 0);
      }
      delete cacheRef.current[landmarkId];
      console.log(`🗑️ Cleared cache for ${landmarkId}`);
    } else {
      const totalSize = Object.values(cacheRef.current).reduce((sum, cached) => sum + (cached.size || 0), 0);
      cacheRef.current = {};
      cacheTestUtils.reset();
      console.log(`🗑️ Cleared all cache (${(totalSize / 1024).toFixed(2)} KB)`);
    }
  }, [cacheTestUtils]);

  const getCacheStats = useCallback(() => {
    const cacheEntries = Object.entries(cacheRef.current);
    const totalSize = cacheEntries.reduce((sum, [, cached]) => sum + (cached.size || 0), 0);
    const availableCount = cacheEntries.filter(([, cached]) => cached.isAvailable).length;
    const unavailableCount = cacheEntries.length - availableCount;
    const panoramaCount = cacheEntries.filter(([, cached]) => cached.hasPanorama).length;

    return {
      totalEntries: cacheEntries.length,
      availableEntries: availableCount,
      unavailableEntries: unavailableCount,
      panoramaEntries: panoramaCount,
      totalSizeKB: (totalSize / 1024).toFixed(2),
      ...cacheTestUtils.getMetrics()
    };
  }, [cacheTestUtils]);

  return {
    fetchEnhancedStreetView,
    getBestViewpoint,
    preloadForProximity,
    getCachedData,
    isKnownUnavailable,
    hasPanoramaData,
    getPanoramaIds,
    clearCache: useCallback((landmarkId?: string) => {
      if (landmarkId) {
        const cached = cacheRef.current[landmarkId];
        if (cached) {
          cacheTestUtils.recordDelete(cached.size || 0);
        }
        delete cacheRef.current[landmarkId];
        console.log(`🗑️ Cleared cache for ${landmarkId}`);
      } else {
        const totalSize = Object.values(cacheRef.current).reduce((sum, cached) => sum + (cached.size || 0), 0);
        cacheRef.current = {};
        cacheTestUtils.reset();
        console.log(`🗑️ Cleared all cache with panorama (${(totalSize / 1024).toFixed(2)} KB)`);
      }
    }, [cacheTestUtils]),
    getCacheStats,
    isLoading,
    error,
    getViewpointStrategy,
    isOfflineCacheReady: offlineCache.isReady
  };
};
