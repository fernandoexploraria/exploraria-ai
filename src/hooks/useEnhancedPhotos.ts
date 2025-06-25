
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PhotoData {
  id: number;
  photoReference: string;
  urls: {
    thumb: string;
    medium: string;
    large: string;
  };
  attributions: Array<{
    displayName: string;
    uri?: string;
    photoUri?: string;
  }>;
  width: number;
  height: number;
  qualityScore?: number;
}

export interface PhotosResponse {
  photos: PhotoData[];
  placeId: string;
  totalPhotos: number;
}

const calculatePhotoScore = (photo: PhotoData, index: number): number => {
  let score = 0;
  
  // Resolution quality (0-40 points)
  const pixels = photo.width * photo.height;
  score += Math.min(40, pixels / 50000);
  
  // Aspect ratio preference (0-20 points)
  const aspectRatio = photo.width / photo.height;
  if (aspectRatio >= 1.2 && aspectRatio <= 2.0) {
    score += 20; // Ideal landscape ratio for landmarks
  } else if (aspectRatio >= 1.0) {
    score += 10; // Acceptable landscape
  }
  
  // Google's order bonus (0-10 points)
  score += Math.max(0, 10 - index * 2);
  
  // Size threshold penalty
  if (photo.width < 400) {
    score -= 20;
  }
  
  return score;
};

export const useEnhancedPhotos = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectBestPhoto = useCallback((photos: PhotoData[]): PhotoData | null => {
    if (!photos || photos.length === 0) return null;
    
    // Calculate scores and sort by quality
    const scoredPhotos = photos.map((photo, index) => ({
      ...photo,
      qualityScore: calculatePhotoScore(photo, index)
    }));
    
    // Sort by quality score (highest first)
    scoredPhotos.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
    
    return scoredPhotos[0];
  }, []);

  const fetchPhotos = useCallback(async (
    placeId: string, 
    maxWidth: number = 800,
    quality: 'thumb' | 'medium' | 'large' = 'medium'
  ): Promise<PhotosResponse | null> => {
    if (!placeId) {
      setError('Place ID is required');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🖼️ Fetching enhanced photos for place: ${placeId}`);
      
      const { data, error: fetchError } = await supabase.functions.invoke('google-places-photos-v2', {
        body: {
          placeId,
          maxWidth,
          quality
        }
      });

      if (fetchError) {
        console.error('❌ Error fetching photos:', fetchError);
        setError(fetchError.message || 'Failed to fetch photos');
        return null;
      }

      if (data?.photos && data.photos.length > 0) {
        // Apply quality scoring and sort photos
        const photosWithScores = data.photos.map((photo: PhotoData, index: number) => ({
          ...photo,
          qualityScore: calculatePhotoScore(photo, index)
        }));
        
        // Sort by quality score (highest first)
        photosWithScores.sort((a: PhotoData, b: PhotoData) => 
          (b.qualityScore || 0) - (a.qualityScore || 0)
        );
        
        console.log(`✅ Successfully fetched ${photosWithScores.length} photos for place: ${placeId} (sorted by quality)`);
        return {
          ...data,
          photos: photosWithScores
        };
      } else {
        console.log(`ℹ️ No photos available for place: ${placeId}`);
        return { photos: [], placeId, totalPhotos: 0 };
      }

    } catch (error) {
      console.error('❌ Unexpected error fetching photos:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getOptimalPhotoUrl = useCallback((photo: PhotoData, networkQuality: 'high' | 'medium' | 'low' = 'medium'): string => {
    switch (networkQuality) {
      case 'low':
        return photo.urls.thumb;
      case 'medium':
        return photo.urls.medium;
      case 'high':
        return photo.urls.large;
      default:
        return photo.urls.medium;
    }
  }, []);

  const getBestPhoto = useCallback((photos: PhotoData[]): PhotoData | null => {
    return selectBestPhoto(photos);
  }, [selectBestPhoto]);

  return {
    fetchPhotos,
    getOptimalPhotoUrl,
    getBestPhoto,
    selectBestPhoto,
    loading,
    error
  };
};
