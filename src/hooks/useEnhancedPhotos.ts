
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
}

export interface PhotosResponse {
  photos: PhotoData[];
  placeId: string;
  totalPhotos: number;
}

export const useEnhancedPhotos = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        console.log(`✅ Successfully fetched ${data.photos.length} photos for place: ${placeId}`);
        return data;
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

  return {
    fetchPhotos,
    getOptimalPhotoUrl,
    loading,
    error
  };
};
