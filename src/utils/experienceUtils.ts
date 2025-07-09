import { supabase } from '@/integrations/supabase/client';

// Define the GeneratedLandmark type based on the database schema
export interface GeneratedLandmark {
  id: string;
  tour_id: string;
  landmark_id: string;
  name: string;
  description: string | null;
  coordinates: [number, number]; // [lng, lat]
  place_id: string | null;
  rating: number | null;
  formatted_address: string | null;
  types: string[] | null;
  photos: any | null;
  photo_references: string[] | null;
  editorial_summary: string | null;
  website_uri: string | null;
  opening_hours: any | null;
  user_ratings_total: number | null;
  price_level: number | null;
  raw_data: any | null;
  created_at: string;
}

/**
 * Fetches experience landmarks from the database for a given tour ID
 * Returns data in the same format as Google Places API for consistency
 */
export const fetchExperienceLandmarks = async (tourId: string): Promise<{ places: any[], error: any }> => {
  try {
    console.log('🎯 Fetching experience landmarks for tour:', tourId);
    
    const { data, error } = await supabase
      .from('generated_landmarks')
      .select('*')
      .eq('tour_id', tourId);

    if (error) {
      console.error('❌ Error fetching experience landmarks:', error);
      return { places: [], error };
    }

    const landmarks = data as GeneratedLandmark[];
    
    // Transform database landmarks to match Google Places API structure
    const transformedLandmarks = landmarks.map(landmark => {
      // Parse coordinates from raw_data field (always from raw_data)
      let lng, lat;
      
      try {
        if (landmark.raw_data && landmark.raw_data.location) {
          lng = landmark.raw_data.location.longitude;
          lat = landmark.raw_data.location.latitude;
        }
      } catch (error) {
        console.warn('Failed to parse raw_data for landmark:', landmark.name, error);
      }
      
      // Validate coordinates
      if (!lng || !lat || isNaN(lng) || isNaN(lat)) {
        console.warn('Invalid coordinates for landmark:', landmark.name, { lng, lat });
        return null;
      }

      // Helper function to safely extract from raw_data
      const safeExtractFromRawData = (path: string) => {
        try {
          const keys = path.split('.');
          let value = landmark.raw_data;
          for (const key of keys) {
            value = value?.[key];
          }
          return value;
        } catch {
          return null;
        }
      };

      // Priority mapping: use table fields first, fallback to raw_data
      const mappedLandmark = {
        ...landmark,
        // Add geometry.location structure (always from raw_data)
        geometry: {
          location: { lng, lat }
        },
        // Priority mapping for core fields
        name: landmark.name || safeExtractFromRawData('displayName.text') || landmark.name,
        place_id: landmark.place_id || safeExtractFromRawData('id'),
        rating: landmark.rating || safeExtractFromRawData('rating'),
        formatted_address: landmark.formatted_address || safeExtractFromRawData('formattedAddress'),
        types: landmark.types?.length ? landmark.types : (safeExtractFromRawData('types') || []),
        
        // Enhanced fields with fallbacks
        editorial_summary: landmark.editorial_summary || safeExtractFromRawData('editorialSummary.text'),
        website_uri: landmark.website_uri || safeExtractFromRawData('websiteUri'),
        opening_hours: landmark.opening_hours || safeExtractFromRawData('regularOpeningHours'),
        user_ratings_total: landmark.user_ratings_total || safeExtractFromRawData('userRatingCount'),
        price_level: landmark.price_level || safeExtractFromRawData('priceLevel'),
        
        // Enhanced photo handling
        photos: landmark.photos || landmark.photo_references || safeExtractFromRawData('photos') || []
      };

      return mappedLandmark;
    }).filter(landmark => landmark !== null); // Remove landmarks with invalid coordinates
    
    console.log('✅ Successfully called fetchExperienceLandmarks - Retrieved', transformedLandmarks.length, 'experience landmarks for tour:', tourId);

    return { places: transformedLandmarks, error: null };
  } catch (error) {
    console.error('❌ Failed to fetch experience landmarks:', error);
    return { places: [], error };
  }
};