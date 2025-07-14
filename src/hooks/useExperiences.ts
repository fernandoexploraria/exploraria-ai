import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Experience {
  id: string;
  destination: string;
  description: string;
  photo: any;
  created_at: string;
  destination_details?: any; // jsonb field containing destination details
  system_prompt?: string; // For TTS overview generation
  price?: number; // Price in USD
  currency?: string; // Currency code (default: 'usd')
  account_id?: string; // Stripe Connected Account ID for tour guide
}

export const useExperiences = () => {
  return useQuery({
    queryKey: ['experiences'],
    queryFn: async (): Promise<Experience[]> => {
      const { data, error } = await supabase
        .from('generated_tours')
        .select('id, destination, description, photo, created_at, destination_details, system_prompt, account_id')
        .eq('experience', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(experience => ({
        ...experience,
        price: 10.00, // Fixed price for now
        currency: 'usd'
      }));
    }
  });
};