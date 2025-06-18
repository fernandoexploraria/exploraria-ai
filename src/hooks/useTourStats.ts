
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export interface TourStats {
  id: string;
  user_id: string;
  tour_count: number;
  created_at: string;
  updated_at: string;
}

export const useTourStats = () => {
  const [tourStats, setTourStats] = useState<TourStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchTourStats = async () => {
    if (!user) {
      setTourStats(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('user_tour_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setTourStats(data);
    } catch (err) {
      console.error('Error fetching tour stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tour stats');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTourStats();
  }, [user]);

  return { tourStats, isLoading, error, refetch: fetchTourStats };
};
