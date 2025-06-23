
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

interface NotificationHistoryItem {
  id: string;
  user_id: string;
  landmark_id: string;
  landmark_name: string;
  distance: number;
  notification_type: string;
  created_at: string;
}

export const useNotificationHistory = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadNotifications = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('proximity_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20); // Get last 20 notifications

      if (error) {
        console.error('Error loading notification history:', error);
        return;
      }

      setNotifications(data || []);
    } catch (error) {
      console.error('Error in loadNotifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  // Set up real-time subscription for new notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`proximity-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proximity_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('New proximity notification:', payload);
          setNotifications(prev => [payload.new as NotificationHistoryItem, ...prev.slice(0, 19)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    notifications,
    isLoading,
    loadNotifications,
  };
};
