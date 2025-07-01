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

// Helper function to validate and construct photo URLs
const constructPhotoUrl = (photoUri: string, maxWidth: number = 800): string => {
  // Check if it's already a complete URL
  if (photoUri.startsWith('http://') || photoUri.startsWith('https://')) {
    console.log(`📷 Using complete URL: ${photoUri}`);
    return photoUri;
  }
  
  // If it's a photo reference, construct Google Places API URL
  if (photoUri.startsWith('places/') || photoUri.includes('photo')) {
    // Extract photo reference from the URI
    const photoRef = photoUri.replace('places/', '').replace('/media', '');
    const constructedUrl = `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=${maxWidth}&key=${import.meta.env.VITE_GOOGLE_API_KEY || 'MISSING_API_KEY'}`;
    console.log(`🔧 Constructed URL from reference: ${photoRef} -> ${constructedUrl}`);
    return constructedUrl;
  }
  
  // Fallback: treat as photo reference and construct URL
  console.log(`⚠️ Treating unknown format as photo reference: ${photoUri}`);
  return `https://places.googleapis.com/v1/${photoUri}/media?maxWidthPx=${maxWidth}&key=${import.meta.env.VITE_GOOGLE_API_KEY || 'MISSING_API_KEY'}`;
};

// Validate URL format
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return url.includes('http') && !url.includes('MISSING_API_KEY');
  } catch {
    return false;
  }
};

// Extract photos from database raw_data with improved URL construction
const extractPhotosFromRawData = (rawData: any): PhotoData[] => {
  if (!rawData?.photos || !Array.isArray(rawData.photos)) {
    return [];
  }

  console.log(`🔍 Extracting photos from raw_data: found ${rawData.photos.length} photos`);
  
  return rawData.photos.map((photo: any, index: number) => {
    const originalPhotoUri = photo.photoUri || '';
    
    // Construct URLs for different sizes
    const thumbUrl = constructPhotoUrl(originalPhotoUri, 400);
    const mediumUrl = constructPhotoUrl(originalPhotoUri, 800);
    const largeUrl = constructPhotoUrl(originalPhotoUri, 1600);
    
    // Validate constructed URLs
    const validThumb = isValidUrl(thumbUrl);
    const validMedium = isValidUrl(mediumUrl);
    const validLarge = isValidUrl(largeUrl);
    
    if (!validThumb && !validMedium && !validLarge) {
      console.warn(`⚠️ All constructed URLs are invalid for photo ${index}:`, {
        original: originalPhotoUri,
        thumb: thumbUrl,
        medium: mediumUrl,
        large: largeUrl
      });
    }
    
    const photoData: PhotoData = {
      id: index + 1,
      photoReference: photo.name || originalPhotoUri || `raw_data_${index}`,
      urls: {
        thumb: validThumb ? thumbUrl : '',
        medium: validMedium ? mediumUrl : '',
        large: validLarge ? largeUrl : ''
      },
      attributions: photo.authorAttributions || [],
      width: photo.widthPx || 800,
      height: photo.heightPx || 600,
      photoSource: 'database_raw_data'
    };
    
    photoData.qualityScore = calculatePhotoScore(photoData, index);
    return photoData;
  }).filter(photo => 
    // Filter out photos with no valid URLs
    photo.urls.thumb || photo.urls.medium || photo.urls.large
  );
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
        .eq('landmark_id', landmarkId)
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

  // Enhanced photo fetching with 3-tier strategy and fallback logic
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
        const dbLandmark = await fetchLandmarkFromDatabase(landmarkId);
        
        if (dbLandmark?.raw_data?.photos) {
          photos = extractPhotosFromRawData(dbLandmark.raw_data);
          sourceUsed = 'database_raw_data';
          console.log(`✅ Phase 1 SUCCESS: Found ${photos.length} photos from raw_data`);
          
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
          // Add source tracking to API photos
          photos = data.photos.map((photo: PhotoData, index: number) => ({
            ...photo,
            photoSource: 'google_places_api' as const,
            qualityScore: photo.qualityScore || calculatePhotoScore(photo, index)
          }));
          sourceUsed = 'google_places_api';
          console.log(`✅ Phase 3 SUCCESS: Found ${photos.length} photos from Google Places API`);
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
  }, [fetchLandmarkFromDatabase]);

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
    error
  };
};
