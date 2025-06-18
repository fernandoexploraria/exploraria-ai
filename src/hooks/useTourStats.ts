
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
      console.log('No user found, clearing tour stats');
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
      
      // If no stats found, create initial record
      if (!data) {
        console.log('No tour stats found, creating initial record');
        const { data: newStats, error: insertError } = await supabase
          .from('user_tour_stats')
          .insert({
            user_id: user.id,
            tour_count: 0
          })
          .select()
          .single();
          
        if (insertError) {
          console.error('Error creating initial tour stats:', insertError);
          throw insertError;
        }
        
        console.log('Initial tour stats created:', newStats);
        setTourStats(newStats);
      } else {
        setTourStats(data);
      }
    } catch (err) {
      console.error('Error in fetchTourStats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tour stats');
    } finally {
      setIsLoading(false);
    }
  };

  // Set up real-time subscription to tour stats changes
  useEffect(() => {
    if (!user?.id) {
      setTourStats(null);
      setIsLoading(false);
      return;
    }

    console.log('Setting up tour stats subscription for user:', user.id);
    
    // Create a unique channel name to avoid conflicts
    const channelName = `tour-stats-${user.id}`;
    
    // Remove any existing channel first to prevent duplicate subscriptions
    const existingChannel = supabase.getChannels().find(ch => ch.topic === channelName);
    if (existingChannel) {
      console.log('Removing existing channel before creating new one');
      supabase.removeChannel(existingChannel);
    }
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_tour_stats',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Real-time tour stats update:', payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            console.log('Updating tour stats from real-time:', payload.new);
            setTourStats(payload.new as TourStats);
          }
        }
      )
      .subscribe((status) => {
        console.log('Tour stats subscription status:', status);
        if (status === 'SUBSCRIBED') {
          // Only fetch initial data after successful subscription
          fetchTourStats();
        }
      });

    return () => {
      console.log('Cleaning up tour stats subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Force refresh function that can be called externally
  const forceRefresh = async () => {
    console.log('Force refreshing tour stats...');
    await fetchTourStats();
  };

  return { tourStats, isLoading, error, refetch: fetchTourStats, forceRefresh };
};
