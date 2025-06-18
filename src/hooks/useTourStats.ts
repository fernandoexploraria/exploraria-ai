

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export interface TourStats {
  id: string;
  user_id: string;
  tour_count: number;
  created_at: string;
  updated_at: string;
}

// Global state to prevent multiple subscriptions
const globalChannelState = {
  channel: null as any,
  subscriberCount: 0,
  isSubscribed: false,
  currentUserId: null as string | null
};

export const useTourStats = () => {
  const [tourStats, setTourStats] = useState<TourStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const isMountedRef = useRef(true);

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
        if (isMountedRef.current) {
          setTourStats(newStats);
        }
      } else {
        if (isMountedRef.current) {
          setTourStats(data);
        }
      }
    } catch (err) {
      console.error('Error in fetchTourStats:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tour stats');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Set up global subscription management
  useEffect(() => {
    if (!user?.id) {
      setTourStats(null);
      setIsLoading(false);
      return;
    }

    // If user changed, clean up previous subscription
    if (globalChannelState.currentUserId && globalChannelState.currentUserId !== user.id) {
      console.log('User changed, cleaning up previous subscription');
      if (globalChannelState.channel) {
        supabase.removeChannel(globalChannelState.channel);
        globalChannelState.channel = null;
        globalChannelState.isSubscribed = false;
        globalChannelState.subscriberCount = 0;
      }
    }

    globalChannelState.currentUserId = user.id;
    globalChannelState.subscriberCount++;

    console.log('Tour stats hook mounted, subscriber count:', globalChannelState.subscriberCount);

    // Only create subscription if none exists
    if (!globalChannelState.channel && !globalChannelState.isSubscribed) {
      console.log('Creating new tour stats subscription for user:', user.id);
      
      const channelName = `tour-stats-${user.id}`;
      
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
              // Broadcast the update to all subscribers
              const event = new CustomEvent('tourStatsUpdate', { detail: payload.new });
              window.dispatchEvent(event);
            }
          }
        )
        .subscribe((status) => {
          console.log('Tour stats subscription status:', status);
          if (status === 'SUBSCRIBED') {
            globalChannelState.isSubscribed = true;
            // Only fetch initial data after successful subscription
            fetchTourStats();
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Channel subscription error');
            globalChannelState.isSubscribed = false;
          } else if (status === 'TIMED_OUT') {
            console.error('Channel subscription timed out');
            globalChannelState.isSubscribed = false;
          }
        });

      globalChannelState.channel = channel;
    } else if (globalChannelState.isSubscribed) {
      // If subscription already exists, just fetch data
      fetchTourStats();
    }

    // Listen for tour stats updates from the global subscription
    const handleTourStatsUpdate = (event: CustomEvent) => {
      if (isMountedRef.current) {
        setTourStats(event.detail as TourStats);
      }
    };

    window.addEventListener('tourStatsUpdate', handleTourStatsUpdate as EventListener);

    return () => {
      console.log('Tour stats hook unmounting');
      globalChannelState.subscriberCount--;
      window.removeEventListener('tourStatsUpdate', handleTourStatsUpdate as EventListener);
      
      // Only clean up subscription when no more subscribers
      if (globalChannelState.subscriberCount <= 0) {
        console.log('No more subscribers, cleaning up global subscription');
        if (globalChannelState.channel) {
          supabase.removeChannel(globalChannelState.channel);
          globalChannelState.channel = null;
          globalChannelState.isSubscribed = false;
          globalChannelState.currentUserId = null;
        }
      }
    };
  }, [user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Force refresh function that can be called externally
  const forceRefresh = async () => {
    console.log('Force refreshing tour stats...');
    await fetchTourStats();
  };

  return { tourStats, isLoading, error, refetch: fetchTourStats, forceRefresh };
};

