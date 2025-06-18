
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
      console.log('Fetching tour stats for user:', user.id);
      
      const { data, error } = await supabase
        .from('user_tour_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching tour stats:', error);
        throw error;
      }

      console.log('Tour stats fetched:', data);
      setTourStats(data);
    } catch (err) {
      console.error('Error fetching tour stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tour stats');
    } finally {
      setIsLoading(false);
    }
  };

  // Set up real-time subscription to tour stats changes
  useEffect(() => {
    if (!user) return;

    console.log('Setting up tour stats subscription for user:', user.id);
    
    const channel = supabase
      .channel('tour-stats-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_tour_stats',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Tour stats changed:', payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setTourStats(payload.new as TourStats);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up tour stats subscription');
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    fetchTourStats();
  }, [user]);

  return { tourStats, isLoading, error, refetch: fetchTourStats };
};
