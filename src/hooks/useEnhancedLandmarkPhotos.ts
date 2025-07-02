
import { useCallback } from 'react';
import { useLandmarkPhotos, LandmarkPhotoResult } from './useLandmarkPhotos';
import { Landmark } from '@/data/landmarks';

export const useEnhancedLandmarkPhotos = () => {
  const { fetchLandmarkPhotos, fetchMultipleLandmarkPhotos, loading, error } = useLandmarkPhotos();

  const fetchPhotosWithPlaceIdFallback = useCallback(async (
    landmark: Landmark,
    options: {
      maxWidth?: number;
      quality?: 'thumb' | 'medium' | 'large';
      preferredSource?: 'database' | 'api';
    } = {}
  ): Promise<LandmarkPhotoResult> => {
    console.log(`🖼️ Enhanced photo fetch for: ${landmark.name}`);
    console.log(`📍 Available identifiers:`, {
      id: landmark.id,
      placeId: landmark.placeId,
      name: landmark.name
    });

    // Try with the enhanced landmark data first
    const enhancedLandmark = {
      ...landmark,
      // Ensure we have the place_id available for photo fetching
      place_id: landmark.placeId || landmark.place_id,
      placeId: landmark.placeId || landmark.place_id
    };

    try {
      const result = await fetchLandmarkPhotos(enhancedLandmark, options);
      
      // If we got photos, we're done
      if (result.photos.length > 0) {
        console.log(`✅ Photos found via ${result.sourceUsed}: ${result.photos.length} photos`);
        return result;
      }

      // If no photos and we have a place_id, the API might have failed
      if (enhancedLandmark.place_id) {
        console.log(`⚠️ No photos found despite having place_id: ${enhancedLandmark.place_id}`);
      }

      // Return the empty result with fallback information
      return {
        ...result,
        sourceUsed: result.sourceUsed || 'none'
      };

    } catch (error) {
      console.error(`❌ Enhanced photo fetch failed for ${landmark.name}:`, error);
      
      // Return empty result on error
      return {
        photos: [],
        bestPhoto: null,
        totalPhotos: 0,
        sourceUsed: 'none',
        qualityDistribution: { high: 0, medium: 0, low: 0 }
      };
    }
  }, [fetchLandmarkPhotos]);

  const batchFetchWithPlaceIdOptimization = useCallback(async (
    landmarks: Landmark[],
    options: {
      maxWidth?: number;
      quality?: 'thumb' | 'medium' | 'large';
      maxConcurrent?: number;
    } = {}
  ): Promise<Map<string, LandmarkPhotoResult>> => {
    console.log(`🔄 Batch photo fetch for ${landmarks.length} landmarks`);
    
    // Prioritize landmarks with place_id for better success rate
    const landmarksWithPlaceId = landmarks.filter(l => l.placeId || l.place_id);
    const landmarksWithoutPlaceId = landmarks.filter(l => !l.placeId && !l.place_id);
    
    console.log(`📊 Batch optimization:`, {
      withPlaceId: landmarksWithPlaceId.length,
      withoutPlaceId: landmarksWithoutPlaceId.length
    });

    // Process landmarks with place_id first for better cache utilization
    const orderedLandmarks = [...landmarksWithPlaceId, ...landmarksWithoutPlaceId];
    
    return await fetchMultipleLandmarkPhotos(orderedLandmarks, options);
  }, [fetchMultipleLandmarkPhotos]);

  return {
    fetchPhotosWithPlaceIdFallback,
    batchFetchWithPlaceIdOptimization,
    loading,
    error
  };
};
