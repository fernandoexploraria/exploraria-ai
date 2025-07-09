import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Experience {
  id: string;
  destination: string;
  description: string;
  photo: any;
  created_at: string;
  system_prompt: string;
  agentid: string | null;
  destination_details?: any;
}

export const useExperiences = () => {
  return useQuery({
    queryKey: ['experiences'],
    queryFn: async (): Promise<Experience[]> => {
      const { data, error } = await supabase
        .from('generated_tours')
        .select('id, destination, description, photo, created_at, system_prompt, agentid, destination_details')
        .eq('experience', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });
};