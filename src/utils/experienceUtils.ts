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
      // Parse coordinates from raw_data field
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
      
      return {
        ...landmark,
        // Add geometry.location structure for consistency with Google Places API
        geometry: {
          location: {
            lng: lng,
            lat: lat
          }
        },
        // Ensure other expected properties are available
        name: landmark.name,
        place_id: landmark.place_id,
        rating: landmark.rating,
        formatted_address: landmark.formatted_address,
        types: landmark.types || [],
        photos: landmark.photos
      };
    }).filter(landmark => landmark !== null); // Remove landmarks with invalid coordinates
    
    console.log('✅ Successfully called fetchExperienceLandmarks - Retrieved', transformedLandmarks.length, 'experience landmarks for tour:', tourId);

    return { places: transformedLandmarks, error: null };
  } catch (error) {
    console.error('❌ Failed to fetch experience landmarks:', error);
    return { places: [], error };
  }
};