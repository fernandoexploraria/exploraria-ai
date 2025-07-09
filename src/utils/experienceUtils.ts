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
  created_at: string;
}

/**
 * Fetches experience landmarks from the database for a given tour ID
 * Shows a toast notification with the number of retrieved records
 */
export const fetchExperienceLandmarks = async (tourId: string): Promise<GeneratedLandmark[]> => {
  try {
    console.log('🎯 Fetching experience landmarks for tour:', tourId);
    
    const { data, error } = await supabase
      .from('generated_landmarks')
      .select('*')
      .eq('tour_id', tourId);

    if (error) {
      console.error('❌ Error fetching experience landmarks:', error);
      throw error;
    }

    const landmarks = data as GeneratedLandmark[];
    console.log('✅ Successfully called fetchExperienceLandmarks - Retrieved', landmarks.length, 'experience landmarks for tour:', tourId);

    return landmarks;
  } catch (error) {
    console.error('❌ Failed to fetch experience landmarks:', error);
    
    return [];
  }
};