import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
    console.log('✅ Retrieved experience landmarks:', landmarks.length);
    
    // Show toast notification with number of retrieved records
    const { toast } = useToast();
    toast({
      title: "Experience Landmarks Retrieved",
      description: `Found ${landmarks.length} landmark${landmarks.length !== 1 ? 's' : ''} from experience tour`,
      duration: 3000,
    });

    return landmarks;
  } catch (error) {
    console.error('❌ Failed to fetch experience landmarks:', error);
    
    // Show error toast
    const { toast } = useToast();
    toast({
      title: "Error",
      description: "Failed to retrieve experience landmarks",
      variant: "destructive",
    });
    
    return [];
  }
};