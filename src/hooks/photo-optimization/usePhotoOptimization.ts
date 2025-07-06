
import { useCallback, useMemo } from 'react';
import { usePhotoUrlCache } from './usePhotoUrlCache';
import { usePhotoValidation } from './usePhotoValidation';
import { usePhotoMetrics } from './usePhotoMetrics';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface OptimizedPhotoResult {
  url: string;
  source: 'cache' | 'constructed' | 'fallback';
  isPreValidated: boolean;
  estimatedLoadTime?: number;
}

interface PhotoOptimizationConfig {
  enablePreValidation: boolean;
  enableUrlCaching: boolean;
  enableMetrics: boolean;
  preValidateOnSlowConnection: boolean;
}

const DEFAULT_CONFIG: PhotoOptimizationConfig = {
  enablePreValidation: true,
  enableUrlCaching: true,
  enableMetrics: true,
  preValidateOnSlowConnection: false
};

export const usePhotoOptimization = (config: Partial<PhotoOptimizationConfig> = {}) => {
  const optimizationConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  const { effectiveType, isSlowConnection } = useNetworkStatus();
  
  const urlCache = usePhotoUrlCache();
  const validation = usePhotoValidation();
  const metrics = usePhotoMetrics();

  // Stable URL construction with caching and validation
  const getOptimizedPhotoUrl = useCallback(async (
    photoRef: string,
    size: 'thumb' | 'medium' | 'large',
    maxWidth: number = 800
  ): Promise<OptimizedPhotoResult> => {
    const startTimer = metrics.startPhotoLoadTimer(photoRef);
    
    try {
        // 1. Check URL cache first
        if (optimizationConfig.enableUrlCaching) {
          const cachedUrl = urlCache.getCachedUrl(photoRef, size);
          if (cachedUrl) {
            return {
              url: cachedUrl,
              source: 'cache',
              isPreValidated: true,
              estimatedLoadTime: 200
            };
          }

          // Check if known to be invalid
          if (urlCache.isKnownInvalid(photoRef, size)) {
            throw new Error('Photo known to be invalid');
          }
        }

      // 2. Construct URL based on photo reference format
      let constructedUrl: string;
      
      // Check if it's already a complete URL
      if (photoRef.startsWith('http://') || photoRef.startsWith('https://')) {
        constructedUrl = photoRef;
      } else {
        // Construct Google Places API URL
        const photoRefCleaned = photoRef.replace('places/', '').replace('/media', '');
        constructedUrl = `https://places.googleapis.com/v1/${photoRefCleaned}/media?maxWidthPx=${maxWidth}&key=${import.meta.env.VITE_GOOGLE_API_KEY || 'MISSING_API_KEY'}`;
      }

        // 3. Pre-validate URL if enabled and appropriate
        let isPreValidated = false;
        if (optimizationConfig.enablePreValidation) {
          const shouldValidate = optimizationConfig.preValidateOnSlowConnection || !isSlowConnection;
          
          if (shouldValidate) {
            isPreValidated = await validation.smartValidate(constructedUrl);
            
            if (!isPreValidated) {
              // Cache the negative result
              if (optimizationConfig.enableUrlCaching) {
                urlCache.setCachedUrl(photoRef, size, constructedUrl, false);
              }
              throw new Error('URL pre-validation failed');
            }
          }
        }

      // 4. Cache successful URL construction
      if (optimizationConfig.enableUrlCaching) {
        urlCache.setCachedUrl(photoRef, size, constructedUrl, true);
      }

      // 5. Record metrics
        if (optimizationConfig.enableMetrics) {
          const loadTime = startTimer();
          metrics.recordPhotoLoad({
            photoId: photoRef,
            url: constructedUrl,
            source: 'google_places_api',
            size,
            loadTime,
            success: true,
            networkType: effectiveType
          });
        }
      
      return {
        url: constructedUrl,
        source: 'constructed',
        isPreValidated,
        estimatedLoadTime: isPreValidated ? 500 : 1000
      };

    } catch (error) {
      // Record failed attempt
      if (optimizationConfig.enableMetrics) {
        const loadTime = startTimer();
        metrics.recordPhotoLoad({
          photoId: photoRef,
          url: photoRef,
          source: 'google_places_api',
          size,
          loadTime,
          success: false,
          errorType: error instanceof Error ? error.message : 'Unknown error',
          networkType: effectiveType
        });
      }

      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ Photo optimization failed for ${photoRef}:${size}`, error);
      }
      throw error;
    }
  }, [
    optimizationConfig, 
    urlCache, 
    validation, 
    metrics, 
    effectiveType, 
    isSlowConnection
  ]);

  // Batch optimize multiple photos
  const batchOptimizePhotos = useCallback(async (
    photos: Array<{ photoRef: string; size: 'thumb' | 'medium' | 'large'; maxWidth?: number }>,
    maxConcurrent: number = 3
  ): Promise<Map<string, OptimizedPhotoResult>> => {
    const results = new Map<string, OptimizedPhotoResult>();
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 Batch optimizing ${photos.length} photos`);
    }
    
    // Process in batches
    for (let i = 0; i < photos.length; i += maxConcurrent) {
      const batch = photos.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (photo) => {
        try {
          const result = await getOptimizedPhotoUrl(photo.photoRef, photo.size, photo.maxWidth);
          return { key: `${photo.photoRef}:${photo.size}`, result };
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ Failed to optimize photo: ${photo.photoRef}:${photo.size}`, error);
          }
          return null;
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((promiseResult) => {
        if (promiseResult.status === 'fulfilled' && promiseResult.value) {
          results.set(promiseResult.value.key, promiseResult.value.result);
        }
      });
      
      // Brief pause between batches
      if (i + maxConcurrent < photos.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Batch optimization complete: ${results.size}/${photos.length} successful`);
    }
    return results;
  }, [getOptimizedPhotoUrl]);

  // Preload photos based on predicted usage
  const preloadPhotos = useCallback(async (
    photoRefs: string[],
    prioritySize: 'thumb' | 'medium' | 'large' = 'medium'
  ): Promise<void> => {
    if (isSlowConnection) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🐌 Skipping preload on slow connection`);
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Preloading ${photoRefs.length} photos (${prioritySize} size)`);
    }
    
    const preloadPromises = photoRefs.map(async (photoRef) => {
      try {
        await getOptimizedPhotoUrl(photoRef, prioritySize);
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚡ Preloaded: ${photoRef}`);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ Preload failed: ${photoRef}`, error);
        }
      }
    });

    await Promise.allSettled(preloadPromises);
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Preload completed for ${photoRefs.length} photos`);
    }
  }, [getOptimizedPhotoUrl, isSlowConnection]);

  // Get comprehensive optimization stats
  const getOptimizationStats = useCallback(() => {
    return {
      cache: urlCache.getCacheStats(),
      validation: validation.getValidationStats(),
      metrics: metrics.getMetricsSummary(),
      performance: metrics.getPerformanceTrend(),
      config: optimizationConfig
    };
  }, [urlCache, validation, metrics, optimizationConfig]);

  // Clean up all optimization data
  const cleanupOptimization = useCallback(() => {
    urlCache.clearCache();
    validation.clearValidationCache();
    metrics.clearMetrics();
    if (process.env.NODE_ENV === 'development') {
      console.log(`🧹 Photo optimization cleanup completed`);
    }
  }, [urlCache, validation, metrics]);

  // Return a stable object reference using useMemo
  return useMemo(() => ({
    getOptimizedPhotoUrl,
    batchOptimizePhotos,
    preloadPhotos,
    getOptimizationStats,
    cleanupOptimization,
    
    // Direct access to individual systems
    urlCache,
    validation,
    metrics
  }), [
    getOptimizedPhotoUrl,
    batchOptimizePhotos,
    preloadPhotos,
    getOptimizationStats,
    cleanupOptimization,
    urlCache,
    validation,
    metrics
  ]);
};
