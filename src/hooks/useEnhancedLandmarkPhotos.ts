
import { useState, useCallback } from 'react';
import { useLandmarkPhotos, LandmarkPhotoResult } from './useLandmarkPhotos';
import { usePhotoOptimization } from './photo-optimization/usePhotoOptimization';
import { Landmark } from '@/data/landmarks';

interface EnhancedPhotoFetchOptions {
  maxWidth?: number;
  quality?: 'thumb' | 'medium' | 'large';
  preferredSource?: 'database' | 'api';
  checkPreloaded?: boolean;
}

export const useEnhancedLandmarkPhotos = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fetchLandmarkPhotos, fetchMultipleLandmarkPhotos } = useLandmarkPhotos();
  const photoOptimization = usePhotoOptimization();

  // Enhanced single landmark photo fetching with preload awareness
  const fetchEnhancedLandmarkPhotos = useCallback(async (
    landmark: Landmark,
    options: EnhancedPhotoFetchOptions = {}
  ): Promise<LandmarkPhotoResult> => {
    const { maxWidth = 800, quality = 'medium', checkPreloaded = true } = options;
    
    setLoading(true);
    setError(null);

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 Fetching enhanced photos for: ${landmark.name}`);
      }

      // Check if photo might be preloaded in optimization cache first
      if (checkPreloaded && (landmark.placeId || landmark.place_id)) {
        try {
          const photoRef = landmark.placeId || landmark.place_id;
          const cachedUrl = photoOptimization.urlCache.getCachedUrl(photoRef!, quality);
          
          if (cachedUrl) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`⚡ Using preloaded photo for: ${landmark.name}`);
            }
            
            // Return a basic result using the cached URL
            return {
              photos: [{
                id: `cached-${landmark.id}`,
                urls: {
                  thumb: quality === 'thumb' ? cachedUrl : '',
                  medium: quality === 'medium' ? cachedUrl : '',
                  large: quality === 'large' ? cachedUrl : ''
                },
                width: maxWidth,
                height: maxWidth,
                photoSource: 'google_places_api',
                attributions: []
              }],
              bestPhoto: {
                id: `cached-${landmark.id}`,
                urls: {
                  thumb: quality === 'thumb' ? cachedUrl : '',
                  medium: quality === 'medium' ? cachedUrl : '',
                  large: quality === 'large' ? cachedUrl : ''
                },
                width: maxWidth,
                height: maxWidth,
                photoSource: 'google_places_api',
                attributions: []
              },
              totalPhotos: 1,
              sourceUsed: 'google_places_api',
              qualityDistribution: { high: 1, medium: 0, low: 0 }
            };
          }
        } catch (cacheError) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`ℹ️ No preloaded photo found for: ${landmark.name}, proceeding with normal fetch`);
          }
        }
      }

      // Fall back to normal photo fetching
      const result = await fetchLandmarkPhotos(landmark, { maxWidth, quality });
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Enhanced photo fetch completed for: ${landmark.name} (${result.totalPhotos} photos)`);
      }
      
      return result;

    } catch (err) {
      console.error('❌ Enhanced photo fetch failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch enhanced landmark photos';
      setError(errorMessage);
      
      // Return empty result on error
      return {
        photos: [],
        bestPhoto: null,
        totalPhotos: 0,
        sourceUsed: 'none',
        qualityDistribution: { high: 0, medium: 0, low: 0 }
      };
    } finally {
      setLoading(false);
    }
  }, [fetchLandmarkPhotos, photoOptimization]);

  // Enhanced batch fetching with preload awareness
  const fetchEnhancedMultipleLandmarkPhotos = useCallback(async (
    landmarks: Landmark[],
    options: EnhancedPhotoFetchOptions & { maxConcurrent?: number } = {}
  ): Promise<Map<string, LandmarkPhotoResult>> => {
    const { maxConcurrent = 3 } = options;
    const results = new Map<string, LandmarkPhotoResult>();
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🖼️ Enhanced batch fetching photos for ${landmarks.length} landmarks`);
    }
    
    // Process landmarks in batches
    for (let i = 0; i < landmarks.length; i += maxConcurrent) {
      const batch = landmarks.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (landmark) => {
        const landmarkId = landmark.id || landmark.name;
        const result = await fetchEnhancedLandmarkPhotos(landmark, options);
        return { landmarkId, result };
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ landmarkId, result }) => {
        results.set(landmarkId, result);
      });
      
      // Brief pause between batches
      if (i + maxConcurrent < landmarks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Enhanced batch photo fetching complete: ${results.size}/${landmarks.length} successful`);
    }
    
    return results;
  }, [fetchEnhancedLandmarkPhotos]);

  return {
    fetchEnhancedLandmarkPhotos,
    fetchEnhancedMultipleLandmarkPhotos,
    loading,
    error
  };
};
