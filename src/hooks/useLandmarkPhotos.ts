
import { useState, useCallback } from 'react';
import { useEnhancedPhotos, PhotoData, PhotosResponse } from './useEnhancedPhotos';

export interface LandmarkPhotoResult {
  photos: PhotoData[];
  bestPhoto: PhotoData | null;
  totalPhotos: number;
  sourceUsed: 'database_raw_data' | 'database_photos_field' | 'google_places_api' | 'none';
  qualityDistribution: {
    high: number;
    medium: number;
    low: number;
  };
}

export const useLandmarkPhotos = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fetchPhotos, getBestPhoto } = useEnhancedPhotos();

  const fetchLandmarkPhotos = useCallback(async (
    landmark: any, // Can be basic landmark or enhanced landmark
    options: {
      maxWidth?: number;
      quality?: 'thumb' | 'medium' | 'large';
      preferredSource?: 'database' | 'api';
    } = {}
  ): Promise<LandmarkPhotoResult> => {
    const { maxWidth = 800, quality = 'medium' } = options;
    
    setLoading(true);
    setError(null);

    try {
      console.log(`🖼️ Fetching photos for landmark: ${landmark.name}`);
      
      // Determine available identifiers
      const landmarkId = landmark.id || landmark.landmark_id;
      const placeId = landmark.placeId || landmark.place_id;
      
      // Enhanced photo fetching with database-first approach
      const result: PhotosResponse | null = await fetchPhotos(
        placeId,
        maxWidth,
        quality,
        placeId // This enables database lookup for tour landmarks
      );

      if (!result) {
        return {
          photos: [],
          bestPhoto: null,
          totalPhotos: 0,
          sourceUsed: 'none',
          qualityDistribution: { high: 0, medium: 0, low: 0 }
        };
      }

      const { photos } = result;
      const bestPhoto = getBestPhoto(photos);
      
      // Determine source used (from first photo's source)
      const sourceUsed = photos.length > 0 
        ? (photos[0].photoSource || 'google_places_api')
        : 'none';

      // Calculate quality distribution
      const qualityDistribution = {
        high: photos.filter(p => (p.qualityScore || 0) > 50).length,
        medium: photos.filter(p => (p.qualityScore || 0) > 25 && (p.qualityScore || 0) <= 50).length,
        low: photos.filter(p => (p.qualityScore || 0) <= 25).length
      };

      console.log(`✅ Landmark photos fetched: ${photos.length} photos from ${sourceUsed}`);
      
      return {
        photos,
        bestPhoto,
        totalPhotos: photos.length,
        sourceUsed: sourceUsed as any,
        qualityDistribution
      };

    } catch (err) {
      console.error('❌ Error fetching landmark photos:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch landmark photos';
      setError(errorMessage);
      
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
  }, [fetchPhotos, getBestPhoto]);

  // Batch fetch photos for multiple landmarks (useful for tour landmarks)
  const fetchMultipleLandmarkPhotos = useCallback(async (
    landmarks: any[],
    options: {
      maxWidth?: number;
      quality?: 'thumb' | 'medium' | 'large';
      maxConcurrent?: number;
    } = {}
  ): Promise<Map<string, LandmarkPhotoResult>> => {
    const { maxConcurrent = 3 } = options;
    const results = new Map<string, LandmarkPhotoResult>();
    
    console.log(`🖼️ Batch fetching photos for ${landmarks.length} landmarks`);
    
    // Process landmarks in batches to avoid overwhelming the system
    for (let i = 0; i < landmarks.length; i += maxConcurrent) {
      const batch = landmarks.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (landmark) => {
        const landmarkId = landmark.id || landmark.landmark_id || landmark.name;
        const result = await fetchLandmarkPhotos(landmark, options);
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
    
    // Log batch results summary
    const sourceSummary = Array.from(results.values()).reduce((acc, result) => {
      acc[result.sourceUsed] = (acc[result.sourceUsed] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`✅ Batch photo fetching complete:`, {
      totalLandmarks: landmarks.length,
      sourcesUsed: sourceSummary,
      totalPhotos: Array.from(results.values()).reduce((sum, r) => sum + r.totalPhotos, 0)
    });
    
    return results;
  }, [fetchLandmarkPhotos]);

  return {
    fetchLandmarkPhotos,
    fetchMultipleLandmarkPhotos,
    loading,
    error
  };
};
