
import { useEffect, useCallback, useRef, useState } from 'react';
import { useNearbyLandmarks } from './useNearbyLandmarks';
import { usePhotoOptimization } from './photo-optimization/usePhotoOptimization';
import { useNetworkStatus } from './useNetworkStatus';
import { UserLocation } from '@/types/proximityAlerts';
import { Landmark } from '@/data/landmarks';

interface PhotoPreloadingConfig {
  preloadDistance: number;
  maxConcurrentPreloads: number;
  prioritySize: 'thumb' | 'medium' | 'large';
  enableNetworkAware: boolean;
}

const DEFAULT_CONFIG: PhotoPreloadingConfig = {
  preloadDistance: 500,
  maxConcurrentPreloads: 3,
  prioritySize: 'medium',
  enableNetworkAware: true
};

interface PreloadingStats {
  totalPreloaded: number;
  cacheHits: number;
  networkRequests: number;
  failedPreloads: number;
}

export const usePhotoPreloading = (
  userLocation: UserLocation | null,
  baseLandmarks: Landmark[] = [],
  config: Partial<PhotoPreloadingConfig> = {}
) => {
  const preloadingConfig = { ...DEFAULT_CONFIG, ...config };
  const [stats, setStats] = useState<PreloadingStats>({
    totalPreloaded: 0,
    cacheHits: 0,
    networkRequests: 0,
    failedPreloads: 0
  });
  
  const { isSlowConnection } = useNetworkStatus();
  const photoOptimization = usePhotoOptimization();
  const preloadedPhotosRef = useRef<Set<string>>(new Set());
  const preloadingQueueRef = useRef<Set<string>>(new Set());

  // Get nearby landmarks for preloading
  const nearbyLandmarks = useNearbyLandmarks({
    userLocation,
    notificationDistance: preloadingConfig.preloadDistance,
    baseLandmarks
  });

  // Smart preloading function
  const preloadLandmarkPhoto = useCallback(async (landmark: Landmark): Promise<void> => {
    const landmarkKey = `${landmark.id}-${preloadingConfig.prioritySize}`;
    
    // Skip if already preloaded or currently preloading
    if (preloadedPhotosRef.current.has(landmarkKey) || preloadingQueueRef.current.has(landmarkKey)) {
      setStats(prev => ({ ...prev, cacheHits: prev.cacheHits + 1 }));
      return;
    }

    // Skip preloading on slow connections if network-aware mode is enabled
    if (preloadingConfig.enableNetworkAware && isSlowConnection) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🐌 Skipping preload for ${landmark.name} due to slow connection`);
      }
      return;
    }

    // Add to preloading queue
    preloadingQueueRef.current.add(landmarkKey);

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Preloading photo for: ${landmark.name}`);
      }

      // Use place_id or placeId for photo optimization
      const photoRef = landmark.placeId || landmark.place_id;
      
      if (photoRef) {
        await photoOptimization.getOptimizedPhotoUrl(
          photoRef,
          preloadingConfig.prioritySize,
          preloadingConfig.prioritySize === 'large' ? 1200 : 
          preloadingConfig.prioritySize === 'medium' ? 800 : 400
        );

        // Mark as successfully preloaded
        preloadedPhotosRef.current.add(landmarkKey);
        setStats(prev => ({ 
          ...prev, 
          totalPreloaded: prev.totalPreloaded + 1,
          networkRequests: prev.networkRequests + 1
        }));

        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Successfully preloaded photo for: ${landmark.name}`);
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚠️ No place_id available for preloading: ${landmark.name}`);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`❌ Failed to preload photo for ${landmark.name}:`, error);
      }
      setStats(prev => ({ ...prev, failedPreloads: prev.failedPreloads + 1 }));
    } finally {
      // Remove from preloading queue
      preloadingQueueRef.current.delete(landmarkKey);
    }
  }, [photoOptimization, preloadingConfig, isSlowConnection]);

  // Batch preload multiple landmarks
  const batchPreloadPhotos = useCallback(async (landmarks: typeof nearbyLandmarks): Promise<void> => {
    if (landmarks.length === 0) return;

    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 Starting batch preload for ${landmarks.length} nearby landmarks`);
    }

    // Sort by distance (closest first) and limit concurrent preloads
    const sortedLandmarks = landmarks
      .slice(0, preloadingConfig.maxConcurrentPreloads * 2) // Limit total candidates
      .map(item => item.landmark);

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < sortedLandmarks.length; i += preloadingConfig.maxConcurrentPreloads) {
      const batch = sortedLandmarks.slice(i, i + preloadingConfig.maxConcurrentPreloads);
      
      const preloadPromises = batch.map(landmark => preloadLandmarkPhoto(landmark));
      await Promise.allSettled(preloadPromises);
      
      // Brief pause between batches
      if (i + preloadingConfig.maxConcurrentPreloads < sortedLandmarks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Batch preload completed for ${sortedLandmarks.length} landmarks`);
    }
  }, [preloadLandmarkPhoto, preloadingConfig.maxConcurrentPreloads]);

  // Trigger preloading when nearby landmarks change
  useEffect(() => {
    if (nearbyLandmarks.length > 0) {
      // Debounce preloading to avoid excessive requests
      const timeoutId = setTimeout(() => {
        batchPreloadPhotos(nearbyLandmarks);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [nearbyLandmarks, batchPreloadPhotos]);

  // Check if a photo is preloaded
  const isPhotoPreloaded = useCallback((landmark: Landmark, size: 'thumb' | 'medium' | 'large' = preloadingConfig.prioritySize): boolean => {
    const landmarkKey = `${landmark.id}-${size}`;
    return preloadedPhotosRef.current.has(landmarkKey);
  }, [preloadingConfig.prioritySize]);

  // Clear preloaded cache
  const clearPreloadedCache = useCallback(() => {
    preloadedPhotosRef.current.clear();
    preloadingQueueRef.current.clear();
    setStats({
      totalPreloaded: 0,
      cacheHits: 0,
      networkRequests: 0,
      failedPreloads: 0
    });
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Photo preloading cache cleared');
    }
  }, []);

  // Get comprehensive preloading stats
  const getPreloadingStats = useCallback(() => {
    return {
      ...stats,
      nearbyLandmarksCount: nearbyLandmarks.length,
      currentlyPreloading: preloadingQueueRef.current.size,
      totalPreloadedInCache: preloadedPhotosRef.current.size,
      config: preloadingConfig
    };
  }, [stats, nearbyLandmarks.length, preloadingConfig]);

  return {
    // Core preloading functions
    preloadLandmarkPhoto,
    batchPreloadPhotos,
    
    // Status and utility functions
    isPhotoPreloaded,
    clearPreloadedCache,
    getPreloadingStats,
    
    // Current state
    nearbyLandmarks,
    stats,
    isPreloading: preloadingQueueRef.current.size > 0
  };
};
