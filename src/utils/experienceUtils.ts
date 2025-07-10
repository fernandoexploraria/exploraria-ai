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
      // Parse coordinates from the coordinates point field (PostgreSQL format: "(lng,lat)")
      let lng, lat;
      
      try {
        if (landmark.coordinates) {
          // PostgreSQL point format: "(lng,lat)" 
          const coordsStr = landmark.coordinates.toString();
          const matches = coordsStr.match(/\(([^,]+),([^)]+)\)/);
          if (matches) {
            lng = parseFloat(matches[1]);
            lat = parseFloat(matches[2]);
          }
        }
      } catch (error) {
        console.warn('Failed to parse coordinates for landmark:', landmark.name, error);
      }
      
      // Validate coordinates
      if (!lng || !lat || isNaN(lng) || isNaN(lat)) {
        console.warn('Invalid coordinates for landmark:', landmark.name, { lng, lat });
        return null;
      }

      // Clean 1:1 mapping to match the required interface structure
      const mappedLandmark = {
        placeId: landmark.place_id,
        name: landmark.name,
        rating: landmark.rating,
        userRatingsTotal: landmark.user_ratings_total,
        priceLevel: landmark.price_level,
        types: landmark.types || [],
        vicinity: landmark.formatted_address || null,
        openNow: null, // Not stored in database
        photoReference: landmark.photo_references?.[0] || null,
        photoUrl: Array.isArray(landmark.photos) ? landmark.photos.flat()[0] : landmark.photos,
        geometry: {
          location: { lng, lat }
        },
        editorialSummary: landmark.editorial_summary,
        website: landmark.website_uri,
        regularOpeningHours: landmark.opening_hours,
        photos: (() => {
          const photosArray = Array.isArray(landmark.photos) ? landmark.photos.flat() : (landmark.photos ? [landmark.photos] : []);
          return photosArray.length > 0 ? photosArray : ["DEBUG_DUMMY_PHOTO"];
        })(),
        searchRadius: null, // Not applicable for DB results
        maxResults: null, // Not applicable for DB results
        rawGooglePlacesData: landmark.raw_data
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