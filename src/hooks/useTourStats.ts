
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

// Enhanced connection status tracking
interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'failed' | 'polling';
  lastConnectionTime: number | null;
  consecutiveFailures: number;
  isPollingActive: boolean;
  lastDataUpdate: number | null;
}

// Global state management for tour stats with enhanced connection tracking
const globalTourStatsState = {
  stats: null as TourStats | null,
  subscribers: new Set<(stats: TourStats | null) => void>(),
  channel: null as any,
  isSubscribed: false,
  currentUserId: null as string | null,
  isLoading: false,
  // Phase 1: Retry state
  retryCount: 0,
  retryTimeout: null as NodeJS.Timeout | null,
  maxRetries: 5,
  // Phase 2: Enhanced connection management
  connectionStatus: {
    status: 'disconnected',
    lastConnectionTime: null,
    consecutiveFailures: 0,
    isPollingActive: false,
    lastDataUpdate: null
  } as ConnectionStatus,
  pollingInterval: null as NodeJS.Timeout | null,
  reconnectionAttemptTimeout: null as NodeJS.Timeout | null
};

const POLLING_INTERVAL = 30000; // 30 seconds base polling
const ACTIVE_POLLING_INTERVAL = 10000; // 10 seconds when changes detected
const RECONNECTION_ATTEMPT_INTERVAL = 120000; // 2 minutes
const CIRCUIT_BREAKER_THRESHOLD = 3; // Switch to polling after 3 consecutive failures

const notifySubscribers = (stats: TourStats | null) => {
  console.log('📢 Tour Stats: Notifying all subscribers with stats:', stats);
  globalTourStatsState.stats = stats;
  globalTourStatsState.connectionStatus.lastDataUpdate = Date.now();
  globalTourStatsState.subscribers.forEach(callback => callback(stats));
};

// Phase 2: Update connection status and notify subscribers
const updateConnectionStatus = (status: ConnectionStatus['status'], resetFailures = false) => {
  const now = Date.now();
  globalTourStatsState.connectionStatus.status = status;
  
  if (status === 'connected') {
    globalTourStatsState.connectionStatus.lastConnectionTime = now;
    if (resetFailures) {
      globalTourStatsState.connectionStatus.consecutiveFailures = 0;
    }
  } else if (status === 'failed') {
    globalTourStatsState.connectionStatus.consecutiveFailures++;
  } else if (status === 'polling') {
    globalTourStatsState.connectionStatus.isPollingActive = true;
  }
  
  console.log(`🔗 Tour Stats: Connection status updated to: ${status}`, globalTourStatsState.connectionStatus);
};

// Phase 2: Polling fallback mechanism
const startPollingFallback = async (userId: string) => {
  console.log('🔄 Tour Stats: Starting polling fallback');
  updateConnectionStatus('polling');
  
  const pollData = async () => {
    try {
      console.log('📊 Tour Stats: Polling data...');
      const { data, error } = await supabase
        .from('user_tour_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Tour Stats: Polling error:', error);
        return;
      }

      if (data) {
        // Check if data has changed by comparing updated_at
        const currentStats = globalTourStatsState.stats;
        const hasChanged = !currentStats || 
          new Date(data.updated_at || '').getTime() !== new Date(currentStats.updated_at || '').getTime();
        
        if (hasChanged) {
          console.log('📊 Tour Stats: Polling detected changes, notifying subscribers');
          notifySubscribers(data as TourStats);
          
          // Switch to more frequent polling for a while
          if (globalTourStatsState.pollingInterval) {
            clearInterval(globalTourStatsState.pollingInterval);
            globalTourStatsState.pollingInterval = setInterval(pollData, ACTIVE_POLLING_INTERVAL);
            
            // Switch back to normal polling after 2 minutes
            setTimeout(() => {
              if (globalTourStatsState.pollingInterval) {
                clearInterval(globalTourStatsState.pollingInterval);
                globalTourStatsState.pollingInterval = setInterval(pollData, POLLING_INTERVAL);
              }
            }, RECONNECTION_ATTEMPT_INTERVAL);
          }
        }
      } else {
        notifySubscribers(null);
      }
    } catch (error) {
      console.error('❌ Tour Stats: Polling failed:', error);
    }
  };

  // Start polling
  await pollData(); // Initial poll
  globalTourStatsState.pollingInterval = setInterval(pollData, POLLING_INTERVAL);
  
  // Attempt to reconnect to real-time every 2 minutes
  globalTourStatsState.reconnectionAttemptTimeout = setInterval(() => {
    console.log('🔄 Tour Stats: Attempting to reconnect to real-time from polling mode...');
    attemptRealTimeReconnection(userId);
  }, RECONNECTION_ATTEMPT_INTERVAL);
};

// Phase 2: Stop polling fallback
const stopPollingFallback = () => {
  console.log('🛑 Tour Stats: Stopping polling fallback');
  
  if (globalTourStatsState.pollingInterval) {
    clearInterval(globalTourStatsState.pollingInterval);
    globalTourStatsState.pollingInterval = null;
  }
  
  if (globalTourStatsState.reconnectionAttemptTimeout) {
    clearInterval(globalTourStatsState.reconnectionAttemptTimeout);
    globalTourStatsState.reconnectionAttemptTimeout = null;
  }
  
  globalTourStatsState.connectionStatus.isPollingActive = false;
};

// Phase 2: Attempt to reconnect to real-time
const attemptRealTimeReconnection = (userId: string) => {
  // Clean up existing channel
  if (globalTourStatsState.channel) {
    supabase.removeChannel(globalTourStatsState.channel);
    globalTourStatsState.channel = null;
    globalTourStatsState.isSubscribed = false;
  }
  
  // Reset retry count for fresh attempt
  globalTourStatsState.retryCount = 0;
  
  // Try to create new real-time subscription
  createTourStatsSubscription(userId, async () => {
    // On successful reconnection, stop polling
    if (globalTourStatsState.connectionStatus.status === 'connected') {
      stopPollingFallback();
    }
  });
};

// Phase 1: Add exponential backoff reconnection function (enhanced in Phase 2)
const reconnectWithBackoff = (userId: string, fetchTourStatsFunc: () => Promise<void>) => {
  // Phase 2: Check if we should switch to polling instead
  if (globalTourStatsState.connectionStatus.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    console.log(`🚨 Tour Stats: Circuit breaker triggered (${globalTourStatsState.connectionStatus.consecutiveFailures} failures), switching to polling fallback`);
    startPollingFallback(userId);
    return;
  }

  if (globalTourStatsState.retryCount >= globalTourStatsState.maxRetries) {
    console.error(`❌ Tour Stats: Max retries (${globalTourStatsState.maxRetries}) exceeded`);
    // Phase 2: Fall back to polling after max retries
    startPollingFallback(userId);
    return;
  }

  // Calculate exponential backoff delay: 1s, 2s, 4s, 8s, 16s, then cap at 30s
  const baseDelay = 1000; // 1 second
  const delay = Math.min(baseDelay * Math.pow(2, globalTourStatsState.retryCount), 30000);
  
  console.log(`🔄 Tour Stats: Scheduling reconnection attempt ${globalTourStatsState.retryCount + 1}/${globalTourStatsState.maxRetries} in ${delay}ms`);
  updateConnectionStatus('connecting');
  
  globalTourStatsState.retryTimeout = setTimeout(async () => {
    globalTourStatsState.retryCount++;
    
    // Clean up existing failed channel
    if (globalTourStatsState.channel) {
      console.log('🧹 Tour Stats: Cleaning up failed channel before retry');
      supabase.removeChannel(globalTourStatsState.channel);
      globalTourStatsState.channel = null;
      globalTourStatsState.isSubscribed = false;
    }
    
    // Create new subscription
    createTourStatsSubscription(userId, fetchTourStatsFunc);
  }, delay);
};

// Phase 1: Extract subscription creation logic (enhanced in Phase 2)
const createTourStatsSubscription = (userId: string, fetchTourStatsFunc: () => Promise<void>) => {
  console.log('📡 Tour Stats: Creating new subscription for user:', userId);
  updateConnectionStatus('connecting');
  
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
        console.log('🔄 Tour Stats: Real-time update received:', payload);
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const stats: TourStats = {
            id: payload.new.id,
            user_id: payload.new.user_id,
            tour_count: payload.new.tour_count,
            created_at: payload.new.created_at,
            updated_at: payload.new.updated_at,
          };
          console.log('🔄 Tour Stats: Parsed stats from real-time update:', stats);
          notifySubscribers(stats);
        } else if (payload.eventType === 'DELETE') {
          console.log('🗑️ Tour Stats: Stats deleted via real-time update');
          notifySubscribers(null);
        }
      }
    )
    .subscribe((status) => {
      console.log('📡 Tour Stats: Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        globalTourStatsState.isSubscribed = true;
        // Phase 1: Reset retry count on successful connection
        globalTourStatsState.retryCount = 0;
        if (globalTourStatsState.retryTimeout) {
          clearTimeout(globalTourStatsState.retryTimeout);
          globalTourStatsState.retryTimeout = null;
        }
        // Phase 2: Update connection status and stop any polling
        updateConnectionStatus('connected', true);
        stopPollingFallback();
        console.log('✅ Tour Stats: Subscription successful, retry count reset');
        // Load initial data after successful subscription
        fetchTourStatsFunc();
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Tour Stats: Channel subscription error');
        globalTourStatsState.isSubscribed = false;
        updateConnectionStatus('failed');
        // Phase 1: Trigger reconnection on channel error
        reconnectWithBackoff(userId, fetchTourStatsFunc);
      } else if (status === 'TIMED_OUT') {
        console.error('⏰ Tour Stats: Channel subscription timed out');
        globalTourStatsState.isSubscribed = false;
        updateConnectionStatus('failed');
        // Phase 1: Trigger reconnection on timeout
        reconnectWithBackoff(userId, fetchTourStatsFunc);
      }
    });

  globalTourStatsState.channel = channel;
};

export const useTourStats = () => {
  const [tourStats, setTourStats] = useState<TourStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const isMountedRef = useRef(true);

  // Subscribe to global tour stats state
  useEffect(() => {
    if (!user) {
      setTourStats(null);
      return;
    }

    // Add this component as a subscriber
    const updateStats = (stats: TourStats | null) => {
      if (isMountedRef.current) {
        console.log('🔄 Tour Stats: Component received stats update:', stats);
        setTourStats(stats);
      }
    };
    
    globalTourStatsState.subscribers.add(updateStats);
    
    // Set initial state if already available and for the same user
    if (globalTourStatsState.stats && globalTourStatsState.currentUserId === user.id) {
      console.log('🔄 Tour Stats: Setting initial state from global state:', globalTourStatsState.stats);
      setTourStats(globalTourStatsState.stats);
    }

    return () => {
      globalTourStatsState.subscribers.delete(updateStats);
    };
  }, [user]);

  // Set up real-time subscription for tour stats
  useEffect(() => {
    if (!user?.id) {
      setTourStats(null);
      setIsLoading(false);
      return;
    }

    // If user changed, clean up previous subscription
    if (globalTourStatsState.currentUserId && globalTourStatsState.currentUserId !== user.id) {
      console.log('👤 Tour Stats: User changed, cleaning up previous subscription');
      if (globalTourStatsState.channel) {
        supabase.removeChannel(globalTourStatsState.channel);
        globalTourStatsState.channel = null;
        globalTourStatsState.isSubscribed = false;
      }
      // Phase 1: Reset retry state on user change
      globalTourStatsState.retryCount = 0;
      if (globalTourStatsState.retryTimeout) {
        clearTimeout(globalTourStatsState.retryTimeout);
        globalTourStatsState.retryTimeout = null;
      }
      // Phase 2: Stop polling and reset connection status
      stopPollingFallback();
      updateConnectionStatus('disconnected', true);
      globalTourStatsState.stats = null;
    }

    globalTourStatsState.currentUserId = user.id;

    // Only create subscription if none exists
    if (!globalTourStatsState.channel && !globalTourStatsState.isSubscribed && !globalTourStatsState.connectionStatus.isPollingActive) {
      // Phase 1: Use new subscription creation function
      createTourStatsSubscription(user.id, fetchTourStats);
    } else if (globalTourStatsState.isSubscribed && globalTourStatsState.currentUserId === user.id) {
      // If subscription already exists for this user, just load data
      console.log('📡 Tour Stats: Subscription already exists for current user, loading data');
      if (!globalTourStatsState.stats) {
        fetchTourStats();
      }
    }

    return () => {
      // Don't clean up the global subscription here - let it persist
      isMountedRef.current = false;
    };
  }, [user?.id]);

  const fetchTourStats = async () => {
    if (!user || globalTourStatsState.isLoading) return;

    globalTourStatsState.isLoading = true;
    setIsLoading(true);
    
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
            tour_count: 0
          })
          .select()
          .single();
          
        if (insertError) {
          console.error('❌ Tour Stats: Error creating initial stats:', insertError);
          throw insertError;
        }
        
        console.log('✅ Tour Stats: Initial stats created:', newStats);
        notifySubscribers(newStats as TourStats);
      } else {
        notifySubscribers(data as TourStats);
      }
    } catch (err) {
      console.error('❌ Tour Stats: Error in fetchTourStats:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tour stats');
      }
    } finally {
      globalTourStatsState.isLoading = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Phase 2: Manual reconnection function
  const forceReconnect = useCallback(() => {
    if (!user?.id) return;
    
    console.log('🔄 Tour Stats: Manual reconnection triggered');
    
    // Stop any existing polling
    stopPollingFallback();
    
    // Clean up existing connection
    if (globalTourStatsState.channel) {
      supabase.removeChannel(globalTourStatsState.channel);
      globalTourStatsState.channel = null;
      globalTourStatsState.isSubscribed = false;
    }
    
    // Reset connection state
    globalTourStatsState.retryCount = 0;
    updateConnectionStatus('connecting', true);
    
    // Attempt fresh connection
    createTourStatsSubscription(user.id, fetchTourStats);
  }, [user?.id]);

  // Force refresh function that can be called externally
  const forceRefresh = async () => {
    console.log('🔄 Tour Stats: Force refreshing...');
    await fetchTourStats();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Clean up global subscription if no more subscribers
      const subscriberCount = globalTourStatsState.subscribers.size;
      if (subscriberCount === 0 && globalTourStatsState.channel) {
        console.log('🧹 Tour Stats: No more subscribers, cleaning up global subscription');
        supabase.removeChannel(globalTourStatsState.channel);
        globalTourStatsState.channel = null;
        globalTourStatsState.isSubscribed = false;
        globalTourStatsState.currentUserId = null;
        globalTourStatsState.stats = null;
        // Phase 1: Clean up retry state
        globalTourStatsState.retryCount = 0;
        if (globalTourStatsState.retryTimeout) {
          clearTimeout(globalTourStatsState.retryTimeout);
          globalTourStatsState.retryTimeout = null;
        }
        // Phase 2: Clean up polling and connection state
        stopPollingFallback();
        updateConnectionStatus('disconnected', true);
      }
    };
  }, []);

  return { 
    tourStats, 
    isLoading, 
    error, 
    refetch: fetchTourStats, 
    forceRefresh,
    // Phase 2: Connection status and manual controls
    connectionStatus: globalTourStatsState.connectionStatus,
    forceReconnect
  };
};
