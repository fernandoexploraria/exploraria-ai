
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
  currentUserId: null as string | null,
  // Phase 1: Add retry state
  retryCount: 0,
  retryTimeout: null as NodeJS.Timeout | null,
  maxRetries: 5
};

// Phase 1: Add exponential backoff reconnection function
const reconnectWithBackoff = (userId: string, fetchTourStatsFunc: () => Promise<void>) => {
  if (globalChannelState.retryCount >= globalChannelState.maxRetries) {
    console.error(`❌ Max retries (${globalChannelState.maxRetries}) exceeded for tour stats subscription`);
    return;
  }

  // Calculate exponential backoff delay: 1s, 2s, 4s, 8s, 16s, then cap at 30s
  const baseDelay = 1000; // 1 second
  const delay = Math.min(baseDelay * Math.pow(2, globalChannelState.retryCount), 30000);
  
  console.log(`🔄 Scheduling tour stats reconnection attempt ${globalChannelState.retryCount + 1}/${globalChannelState.maxRetries} in ${delay}ms`);
  
  globalChannelState.retryTimeout = setTimeout(async () => {
    globalChannelState.retryCount++;
    
    // Clean up existing failed channel
    if (globalChannelState.channel) {
      console.log('🧹 Cleaning up failed tour stats channel before retry');
      supabase.removeChannel(globalChannelState.channel);
      globalChannelState.channel = null;
      globalChannelState.isSubscribed = false;
    }
    
    // Create new subscription
    createTourStatsSubscription(userId, fetchTourStatsFunc);
  }, delay);
};

// Phase 1: Extract subscription creation logic
const createTourStatsSubscription = (userId: string, fetchTourStatsFunc: () => Promise<void>) => {
  console.log('📡 Creating new tour stats subscription for user:', userId);
  
  const channelName = `tour-stats-${userId}`;
  
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_tour_stats',
        filter: `user_id=eq.${userId}`
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
        // Phase 1: Reset retry count on successful connection
        globalChannelState.retryCount = 0;
        if (globalChannelState.retryTimeout) {
          clearTimeout(globalChannelState.retryTimeout);
          globalChannelState.retryTimeout = null;
        }
        console.log('✅ Tour stats subscription successful, retry count reset');
        // Only fetch initial data after successful subscription
        fetchTourStatsFunc();
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Tour stats channel subscription error');
        globalChannelState.isSubscribed = false;
        // Phase 1: Trigger reconnection on channel error
        reconnectWithBackoff(userId, fetchTourStatsFunc);
      } else if (status === 'TIMED_OUT') {
        console.error('⏰ Tour stats channel subscription timed out');
        globalChannelState.isSubscribed = false;
        // Phase 1: Trigger reconnection on timeout
        reconnectWithBackoff(userId, fetchTourStatsFunc);
      }
    });

  globalChannelState.channel = channel;
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
      // Phase 1: Reset retry state on user change
      globalChannelState.retryCount = 0;
      if (globalChannelState.retryTimeout) {
        clearTimeout(globalChannelState.retryTimeout);
        globalChannelState.retryTimeout = null;
      }
    }

    globalChannelState.currentUserId = user.id;
    globalChannelState.subscriberCount++;

    console.log('Tour stats hook mounted, subscriber count:', globalChannelState.subscriberCount);

    // Only create subscription if none exists
    if (!globalChannelState.channel && !globalChannelState.isSubscribed) {
      // Phase 1: Use new subscription creation function
      createTourStatsSubscription(user.id, fetchTourStats);
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
        // Phase 1: Clean up retry state
        globalChannelState.retryCount = 0;
        if (globalChannelState.retryTimeout) {
          clearTimeout(globalChannelState.retryTimeout);
          globalChannelState.retryTimeout = null;
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
