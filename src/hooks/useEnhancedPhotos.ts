import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePhotoOptimization } from './photo-optimization/usePhotoOptimization';
import { isValidGooglePlacesPhotoUrl } from '@/utils/photoUrlValidation';

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
  photoSource?: 'database_raw_data' | 'database_photos_field' | 'google_places_api';
}

export interface PhotosResponse {
  photos: PhotoData[];
  placeId: string;
  totalPhotos: number;
}

// Database landmark interface for enhanced data access
export interface DatabaseLandmark {
  id: string;
  landmark_id: string;
  name: string;
  place_id: string | null;
  raw_data: any;
  photos: any;
  photo_references: string[] | null;
  rating: number | null;
  user_ratings_total: number | null;
  price_level: number | null;
  website_uri: string | null;
  opening_hours: any;
  editorial_summary: string | null;
  formatted_address: string | null;
  types: string[] | null;
  coordinates: any;
  tour_id: string;
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

// Batch helper function to construct multiple photo URLs efficiently
const constructPhotoUrlsBatch = async (photoReferences: string[]): Promise<Record<string, { thumb: string; medium: string; large: string }>> => {
  try {
    const photoRequestData = photoReferences.map(photoRef => ({
      photoReference: photoRef,
      sizes: [
        { name: 'thumb' as const, maxWidth: 400 },
        { name: 'medium' as const, maxWidth: 800 },
        { name: 'large' as const, maxWidth: 1600 }
      ]
    }));

    const { data, error } = await supabase.functions.invoke('google-photo-urls-batch', {
      body: { photoReferences: photoRequestData }
    });

    if (error) {
      console.error(`❌ Batch edge function error:`, error);
      throw error;
    }

    if (data?.success && data.photos) {
      console.log(`🚀 Batch constructed URLs for ${Object.keys(data.photos).length} photos`);
      return data.photos;
    } else {
      throw new Error('No photos returned from batch function');
    }
  } catch (error) {
    console.error(`❌ Failed to batch construct URLs:`, error);
    throw error;
  }
};

// Fallback helper function for single photo URL construction
const constructPhotoUrlSecurely = async (photoUri: string, maxWidth: number = 800): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('google-photo-url', {
      body: {
        photoReference: photoUri,
        maxWidth
      }
    });

    if (error) {
      throw error;
    }

    if (data?.url) {
      return data.url;
    } else {
      throw new Error('No URL returned from edge function');
    }
  } catch (error) {
    throw error;
  }
};

// Updated validation function using the robust Google Places Photo validation
const isValidUrl = (url: string): boolean => {
  // For Google Places Photo URLs, use the robust validation
  if (url.includes('places.googleapis.com')) {
    const result = isValidGooglePlacesPhotoUrl(url);
    if (!result.isValid) {
      console.warn(`❌ Google Places Photo URL validation failed: ${result.error}`, url);
    }
    return result.isValid;
  }

  // For other URLs, use basic validation
  try {
    new URL(url);
    return url.includes('http');
  } catch {
    return false;
  }
};

// Extract photos from database raw_data with optimized batch processing
const extractPhotosFromRawData = async (rawData: any, photoOptimization?: any): Promise<PhotoData[]> => {
  if (!rawData?.photos || !Array.isArray(rawData.photos)) {
    return [];
  }

  console.log(`🔍 Extracting photos from raw_data: found ${rawData.photos.length} photos`);
  
  // Extract all valid photo references first
  const validPhotoRefs: Array<{ reference: string; index: number; photo: any }> = [];
  
  rawData.photos.forEach((photo: any, index: number) => {
    const originalPhotoReference = photo.name || '';
    if (originalPhotoReference && originalPhotoReference.trim() !== '') {
      validPhotoRefs.push({ reference: originalPhotoReference, index, photo });
    }
  });

  if (validPhotoRefs.length === 0) {
    console.log(`ℹ️ No valid photo references found`);
    return [];
  }

  try {
    // Batch construct all URLs at once
    console.log(`🚀 Batch processing ${validPhotoRefs.length} photo references`);
    const batchResults = await constructPhotoUrlsBatch(validPhotoRefs.map(p => p.reference));
    
    // Process results and create PhotoData objects
    const photoDataPromises = validPhotoRefs.map(async ({ reference, index, photo }) => {
      const urls = batchResults[reference];
      
      if (!urls) {
        console.warn(`⚠️ No URLs returned for photo ${index}: ${reference}`);
        return null;
      }

      // Validate constructed URLs
      const thumbValidation = isValidUrl(urls.thumb);
      const mediumValidation = isValidUrl(urls.medium);
      const largeValidation = isValidUrl(urls.large);
      
      if (!thumbValidation && !mediumValidation && !largeValidation) {
        console.warn(`⚠️ All URLs failed validation for photo ${index}`);
        return null;
      }
      
      const photoData: PhotoData = {
        id: index + 1,
        photoReference: reference,
        urls: {
          thumb: thumbValidation ? urls.thumb : '',
          medium: mediumValidation ? urls.medium : '',
          large: largeValidation ? urls.large : ''
        },
        attributions: photo.authorAttributions || [],
        width: photo.widthPx || 800,
        height: photo.heightPx || 600,
        photoSource: 'database_raw_data'
      };
      
      photoData.qualityScore = calculatePhotoScore(photoData, index);
      return photoData;
    });

    const photos = await Promise.all(photoDataPromises);
    const validPhotos = photos.filter(photo => photo !== null) as PhotoData[];
    
    console.log(`✅ Batch processing complete: ${validPhotos.length}/${validPhotoRefs.length} photos processed successfully`);
    return validPhotos;

  } catch (error) {
    console.warn(`⚠️ Batch processing failed, falling back to individual processing:`, error);
    
    // Fallback to individual processing with parallel execution
    const photoPromises = validPhotoRefs.map(async ({ reference, index, photo }) => {
      try {
        const [thumbUrl, mediumUrl, largeUrl] = await Promise.all([
          constructPhotoUrlSecurely(reference, 400),
          constructPhotoUrlSecurely(reference, 800),
          constructPhotoUrlSecurely(reference, 1600)
        ]);
        
        const thumbValidation = isValidUrl(thumbUrl);
        const mediumValidation = isValidUrl(mediumUrl);
        const largeValidation = isValidUrl(largeUrl);
        
        if (!thumbValidation && !mediumValidation && !largeValidation) {
          return null;
        }
        
        const photoData: PhotoData = {
          id: index + 1,
          photoReference: reference,
          urls: {
            thumb: thumbValidation ? thumbUrl : '',
            medium: mediumValidation ? mediumUrl : '',
            large: largeValidation ? largeUrl : ''
          },
          attributions: photo.authorAttributions || [],
          width: photo.widthPx || 800,
          height: photo.heightPx || 600,
          photoSource: 'database_raw_data'
        };
        
        photoData.qualityScore = calculatePhotoScore(photoData, index);
        return photoData;
      } catch (error) {
        return null;
      }
    });

    const fallbackPhotos = await Promise.all(photoPromises);
    return fallbackPhotos.filter(photo => photo !== null) as PhotoData[];
  }
};

// Extract photos from database photos field
const extractPhotosFromPhotosField = (photos: any): PhotoData[] => {
  if (!photos) return [];

  console.log(`🔍 Extracting photos from photos field`);
  
  // Handle different photo field formats
  let photoArray: any[] = [];
  if (Array.isArray(photos)) {
    photoArray = photos;
  } else if (typeof photos === 'object' && photos.urls) {
    photoArray = [photos];
  } else if (typeof photos === 'string') {
    try {
      const parsed = JSON.parse(photos);
      photoArray = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }

  return photoArray.map((photo: any, index: number) => {
    const photoData: PhotoData = {
      id: index + 1,
      photoReference: photo.photoReference || `photos_field_${index}`,
      urls: photo.urls || {
        thumb: photo.url || '',
        medium: photo.url || '',
        large: photo.url || ''
      },
      attributions: photo.attributions || [],
      width: photo.width || 800,
      height: photo.height || 600,
      photoSource: 'database_photos_field'
    };
    
    photoData.qualityScore = calculatePhotoScore(photoData, index);
    return photoData;
  });
};

export const useEnhancedPhotos = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize photo optimization
  const photoOptimization = usePhotoOptimization({
    enablePreValidation: true,
    enableUrlCaching: true,
    enableMetrics: true,
    preValidateOnSlowConnection: false
  });

  // Fetch landmark data from database (tour landmarks with enhanced data)
  const fetchLandmarkFromDatabase = useCallback(async (
    landmarkId: string
  ): Promise<DatabaseLandmark | null> => {
    try {
      console.log(`🔍 Fetching landmark from database: ${landmarkId}`);
      
      const { data, error: dbError } = await supabase
        .from('generated_landmarks')
        .select(`
          id,
          landmark_id,
          name,
          place_id,
          raw_data,
          photos,
          photo_references,
          rating,
          user_ratings_total,
          price_level,
          website_uri,
          opening_hours,
          editorial_summary,
          formatted_address,
          types,
          coordinates,
          tour_id
        `)
        .eq('place_id', landmarkId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (dbError) {
        console.error('❌ Database query error:', dbError);
        return null;
      }

      if (data && data.length > 0) {
        const landmark = data[0];
        console.log(`✅ Found landmark in database: ${landmark.name} (selected from ${data.length} results)`);
        return landmark as DatabaseLandmark;
      }

      console.log(`ℹ️ Landmark not found in database: ${landmarkId}`);
      return null;
    } catch (error) {
      console.error('❌ Error fetching landmark from database:', error);
      return null;
    }
  }, []);

  // Enhanced photo fetching with 3-tier strategy and optimization
  const fetchPhotos = useCallback(async (
    placeId: string, 
    maxWidth: number = 800,
    quality: 'thumb' | 'medium' | 'large' = 'medium',
    landmarkId?: string // Optional landmark ID for database lookup
  ): Promise<PhotosResponse | null> => {
    if (!placeId && !landmarkId) {
      setError('Place ID or Landmark ID is required');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      let photos: PhotoData[] = [];
      let sourceUsed = '';
      let shouldFallbackToAPI = false;

      // TIER 1: Check database for tour landmarks with raw_data
      if (landmarkId) {
        console.log(`🔍 Phase 1: Checking database for landmark: ${landmarkId}`);
        const dbLandmark = await fetchLandmarkFromDatabase(placeId);
        
        if (dbLandmark?.raw_data?.photos) {
          console.log(`🔍 Found ${dbLandmark.raw_data.photos.length} photos in raw_data, processing...`);
          photos = await extractPhotosFromRawData(dbLandmark.raw_data, photoOptimization);
          sourceUsed = 'database_raw_data';
          console.log(`✅ Phase 1 SUCCESS: Found ${photos.length} valid photos from raw_data`);
          
          // Pre-optimize URLs for better performance
          if (photos.length > 0) {
            console.log(`🚀 Pre-optimizing ${photos.length} database photos`);
            try {
              const preOptimizePromises = photos.slice(0, 3).map(photo => // Only first 3 to avoid overwhelming
                photoOptimization.preloadPhotos([photo.photoReference], quality)
              );
              await Promise.allSettled(preOptimizePromises);
            } catch (preOptError) {
              console.warn(`⚠️ Pre-optimization failed:`, preOptError);
            }
          }
          
          // Check if any photos actually have valid URLs
          const validPhotos = photos.filter(photo => 
            photo.urls.thumb || photo.urls.medium || photo.urls.large
          );
          
          if (validPhotos.length === 0) {
            console.log(`⚠️ Phase 1: No valid URLs found, will fallback to API`);
            shouldFallbackToAPI = true;
            photos = [];
          } else {
            photos = validPhotos;
          }
        }
        // TIER 2: Fallback to photos field from database
        else if (dbLandmark?.photos) {
          photos = extractPhotosFromPhotosField(dbLandmark.photos);
          sourceUsed = 'database_photos_field';
          console.log(`✅ Phase 2 SUCCESS: Found ${photos.length} photos from photos field`);
        } else {
          shouldFallbackToAPI = true;
        }
      } else {
        shouldFallbackToAPI = true;
      }

      // TIER 3: Fallback to Google Places API
      if ((photos.length === 0 || shouldFallbackToAPI) && placeId) {
        console.log(`🔍 Phase 3: Fetching from Google Places API for place: ${placeId}`);
        
        const { data, error: apiError } = await supabase.functions.invoke('google-places-photos-v2', {
          body: {
            placeId,
            maxWidth,
            quality
          }
        });

        if (apiError) {
          console.error('❌ API Error:', apiError);
          setError(apiError.message || 'Failed to fetch photos from API');
          return null;
        }

        if (data?.photos && data.photos.length > 0) {
          // Add source tracking to API photos and pre-optimize
          photos = data.photos.map((photo: PhotoData, index: number) => ({
            ...photo,
            photoSource: 'google_places_api' as const,
            qualityScore: photo.qualityScore || calculatePhotoScore(photo, index)
          }));
          sourceUsed = 'google_places_api';
          console.log(`✅ Phase 3 SUCCESS: Found ${photos.length} photos from Google Places API`);
          
          // Pre-optimize API photos
          if (photos.length > 0) {
            console.log(`🚀 Pre-optimizing ${photos.length} API photos`);
            try {
              const apiPhotoRefs = photos.slice(0, 3).map(p => p.photoReference).filter(Boolean);
              if (apiPhotoRefs.length > 0) {
                await photoOptimization.preloadPhotos(apiPhotoRefs, quality);
              }
            } catch (preOptError) {
              console.warn(`⚠️ API photo pre-optimization failed:`, preOptError);
            }
          }
        }
      }

      if (photos.length > 0) {
        // Sort by quality score (highest first)
        photos.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
        
        console.log(`🎯 Photo fetching complete - Source: ${sourceUsed}, Count: ${photos.length}`);
        console.log(`📊 Quality distribution:`, {
          high: photos.filter(p => (p.qualityScore || 0) > 50).length,
          medium: photos.filter(p => (p.qualityScore || 0) > 25 && (p.qualityScore || 0) <= 50).length,
          low: photos.filter(p => (p.qualityScore || 0) <= 25).length
        });

        // Log optimization stats
        const optimizationStats = photoOptimization.getOptimizationStats();
        console.log(`📈 Photo optimization stats:`, {
          cacheHitRate: optimizationStats.cache.hitRate,
          validationSuccessRate: optimizationStats.validation.successRate,
          averageLoadTime: optimizationStats.metrics.averageLoadTime
        });

        return {
          photos,
          placeId: placeId || landmarkId || '',
          totalPhotos: photos.length
        };
      } else {
        console.log(`ℹ️ No photos found for place: ${placeId || landmarkId}`);
        return { photos: [], placeId: placeId || landmarkId || '', totalPhotos: 0 };
      }

    } catch (error) {
      console.error('❌ Unexpected error fetching photos:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchLandmarkFromDatabase, photoOptimization]);

  const selectBestPhoto = useCallback((photos: PhotoData[]): PhotoData | null => {
    if (!photos || photos.length === 0) return null;
    
    // Photos should already be sorted by quality score
    return photos[0];
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
    fetchLandmarkFromDatabase,
    loading,
    error,
    
    // Photo optimization features
    photoOptimization,
    getOptimizationStats: photoOptimization.getOptimizationStats,
    cleanupOptimization: photoOptimization.cleanupOptimization
  };
};
