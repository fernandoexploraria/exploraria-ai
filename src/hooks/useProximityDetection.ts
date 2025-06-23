
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { findNearestLandmark } from '@/utils/proximityUtils';
import { UserLocation } from '@/types/proximityAlerts';
import { landmarks } from '@/data/landmarks';

interface ProximityNotification {
  id: string;
  user_id: string;
  landmark_id: string;
  landmark_name: string;
  distance: number;
  notification_type: string;
  created_at: string;
}

interface UseProximityDetectionProps {
  proximitySettings: any;
  isLocationTracking: boolean;
}

export const useProximityDetection = ({ proximitySettings, isLocationTracking }: UseProximityDetectionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const lastNotificationRef = useRef<{ landmarkId: string; timestamp: number } | null>(null);
  const notificationCooldownRef = useRef<Map<string, number>>(new Map());

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const showBrowserNotification = useCallback((landmarkName: string, distance: number) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(`Near ${landmarkName}`, {
        body: `You're ${Math.round(distance)}m away from ${landmarkName}`,
        icon: '/favicon.ico',
        tag: `proximity-${landmarkName}`, // Prevents duplicate notifications
      });

      // Auto-close notification after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
    }
  }, []);

  const storeNotificationHistory = useCallback(async (landmarkId: string, landmarkName: string, distance: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('proximity_notifications')
        .insert({
          user_id: user.id,
          landmark_id: landmarkId,
          landmark_name: landmarkName,
          distance: distance,
          notification_type: 'proximity_alert',
        });

      if (error) {
        console.error('Error storing notification history:', error);
      }
    } catch (error) {
      console.error('Error in storeNotificationHistory:', error);
    }
  }, [user]);

  const checkProximity = useCallback(async (location: UserLocation) => {
    if (!proximitySettings?.is_enabled || !user || !isLocationTracking) {
      return;
    }

    const nearest = findNearestLandmark(location, landmarks);
    if (!nearest) return;

    const { landmark, distance } = nearest;
    const isWithinRange = distance <= proximitySettings.default_distance;

    if (isWithinRange) {
      const now = Date.now();
      const cooldownKey = landmark.id;
      const lastNotification = notificationCooldownRef.current.get(cooldownKey);
      
      // Prevent spam notifications - only notify once every 5 minutes per landmark
      const cooldownPeriod = 5 * 60 * 1000; // 5 minutes
      const shouldNotify = !lastNotification || (now - lastNotification) > cooldownPeriod;

      if (shouldNotify) {
        console.log(`Proximity alert: Near ${landmark.name} (${Math.round(distance)}m away)`);
        
        // Update cooldown
        notificationCooldownRef.current.set(cooldownKey, now);
        
        // Show browser notification
        showBrowserNotification(landmark.name, distance);
        
        // Store in database
        await storeNotificationHistory(landmark.id, landmark.name, distance);
        
        // Show toast notification as fallback
        toast({
          title: `Near ${landmark.name}`,
          description: `You're ${Math.round(distance)}m away from ${landmark.name}`,
        });
      }
    }
  }, [proximitySettings, user, isLocationTracking, findNearestLandmark, showBrowserNotification, storeNotificationHistory, toast]);

  return {
    checkProximity,
  };
};
