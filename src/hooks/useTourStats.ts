import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export interface TourStats {
  id: string;
  user_id: string;
  tour_count: number;
  experience_count: number;
  created_at: string;
  updated_at: string;
}

// Simple connection status for compatibility
interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'failed' | 'polling';
  lastConnectionTime: number | null;
  consecutiveFailures: number;
  isPollingActive: boolean;
  lastDataUpdate: number | null;
}

export const useTourStats = () => {
  const [tourStats, setTourStats] = useState<TourStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const isMountedRef = useRef(true);
  const channelRef = useRef<any>(null);

  // Simple connection status for compatibility
  const [connectionStatus] = useState<ConnectionStatus>({
    status: 'connected',
    lastConnectionTime: Date.now(),
    consecutiveFailures: 0,
    isPollingActive: false,
    lastDataUpdate: Date.now()
  });

  // Fetch tour stats from database
  const fetchTourStats = useCallback(async () => {
    if (!user?.id || !isMountedRef.current) return;

    setIsLoading(true);
    setError(null);
    
    try {
      console.log('📥 Tour Stats: Loading for user:', user.id);
      const { data, error } = await supabase
        .from('user_tour_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('❌ Tour Stats: Error loading:', error);
        throw error;
      }

      console.log('📥 Tour Stats: Loaded data:', data);
      
      // If no stats found, create initial record
      if (!data) {
        console.log('📝 Tour Stats: No stats found, creating initial record');
        const { data: newStats, error: insertError } = await supabase
          .from('user_tour_stats')
          .insert({
            user_id: user.id,
            tour_count: 0,
            experience_count: 0
          })
          .select()
          .single();
          
        if (insertError) {
          console.error('❌ Tour Stats: Error creating initial stats:', insertError);
          throw insertError;
        }
        
        console.log('✅ Tour Stats: Initial stats created:', newStats);
        if (isMountedRef.current) {
          setTourStats(newStats as TourStats);
        }
      } else {
        if (isMountedRef.current) {
          setTourStats(data as TourStats);
        }
      }
    } catch (err) {
      console.error('❌ Tour Stats: Error in fetchTourStats:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tour stats');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user?.id]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user?.id) {
      setTourStats(null);
      setIsLoading(false);
      return;
    }

    // Clean up existing subscription
    if (channelRef.current) {
      console.log('🧹 Tour Stats: Cleaning up existing channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Load initial data first
    fetchTourStats();

    // Create new subscription
    const channelName = `tour-stats-${user.id}-${Date.now()}`;
    console.log('📡 Tour Stats: Creating subscription for user:', user.id);
    
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
          console.log('🔄 Tour Stats: Real-time update received:', payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const stats: TourStats = {
              id: payload.new.id,
              user_id: payload.new.user_id,
              tour_count: payload.new.tour_count,
              experience_count: payload.new.experience_count,
              created_at: payload.new.created_at,
              updated_at: payload.new.updated_at,
            };
            console.log('🔄 Tour Stats: Parsed stats from real-time update:', stats);
            if (isMountedRef.current) {
              setTourStats(stats);
            }
          } else if (payload.eventType === 'DELETE') {
            console.log('🗑️ Tour Stats: Stats deleted via real-time update');
            if (isMountedRef.current) {
              setTourStats(null);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Tour Stats: Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Tour Stats: Real-time subscription successful');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Tour Stats: Channel subscription error - falling back to manual refresh');
          // Don't break the app, just log the error
          // The initial data was already loaded above
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ Tour Stats: Channel subscription timed out - falling back to manual refresh');
          // Don't break the app, just log the error
          // The initial data was already loaded above
        } else if (status === 'CLOSED') {
          console.log('📡 Tour Stats: Channel subscription closed');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log('🧹 Tour Stats: Cleaning up channel on unmount');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]); // Removed fetchTourStats from dependencies to avoid circular dependency

  // Force refresh function
  const forceRefresh = useCallback(async () => {
    console.log('🔄 Tour Stats: Force refreshing...');
    await fetchTourStats();
  }, [fetchTourStats]);

  // Force reconnect function (for compatibility)
  const forceReconnect = useCallback(() => {
    console.log('🔄 Tour Stats: Force reconnecting...');
    forceRefresh();
  }, [forceRefresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return { 
    tourStats, 
    isLoading, 
    error, 
    refetch: fetchTourStats, 
    forceRefresh,
    connectionStatus,
    forceReconnect
  };
};
