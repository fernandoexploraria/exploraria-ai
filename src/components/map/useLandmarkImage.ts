
import { useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Landmark } from '@/data/landmarks';

export const useLandmarkImage = () => {
  const imageCache = useRef<{ [key: string]: string }>({});

  const fetchLandmarkImage = async (landmark: Landmark): Promise<string> => {
    const cacheKey = `${landmark.name}-${landmark.coordinates[0]}-${landmark.coordinates[1]}`;
    
    if (imageCache.current[cacheKey]) {
      console.log('Using cached image for:', landmark.name);
      return imageCache.current[cacheKey];
    }

    try {
      console.log('Fetching image via edge function for:', landmark.name);
      
      const { data, error } = await supabase.functions.invoke('fetch-landmark-image', {
        body: { 
          landmarkName: landmark.name,
          coordinates: landmark.coordinates
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data && data.imageUrl) {
        console.log('Received image URL for:', landmark.name, data.isFallback ? '(fallback)' : '(Google Places)');
        imageCache.current[cacheKey] = data.imageUrl;
        return data.imageUrl;
      }

      throw new Error('No image URL received from edge function');
      
    } catch (error) {
      console.error('Error fetching image for', landmark.name, error);
      
      // Fallback to a seeded placeholder image
      console.log('Using local fallback image for:', landmark.name);
      const seed = landmark.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const fallbackUrl = `https://picsum.photos/seed/${seed}/400/300`;
      imageCache.current[cacheKey] = fallbackUrl;
      return fallbackUrl;
    }
  };

  return { fetchLandmarkImage };
};
