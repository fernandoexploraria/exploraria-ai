
import { useState, useCallback, useRef } from 'react';
import { Landmark } from '@/data/landmarks';
import { UserLocation } from '@/types/proximityAlerts';
import { useToast } from '@/hooks/use-toast';

interface ProximityNotification {
  id: string;
  landmark: Landmark;
  distance: number;
  notificationType: 'floating-card' | 'route-visual' | 'audio' | 'toast';
  timestamp: number;
}

interface UseProximityNotificationsReturn {
  activeNotification: ProximityNotification | null;
  showFloatingCard: (landmark: Landmark, distance: number) => void;
  hideFloatingCard: () => void;
  showRouteVisualization: (landmark: Landmark, distance: number) => void;
  showSearchNearby: (landmark: Landmark, coordinates: [number, number]) => void;
  hideSearchNearby: () => void;
  isSearchNearbyOpen: boolean;
  searchNearbyLandmark: Landmark | null;
  searchNearbyCoordinates: [number, number] | null;
}

export const useProximityNotifications = (): UseProximityNotificationsReturn => {
  const { toast } = useToast();
  const [activeNotification, setActiveNotification] = useState<ProximityNotification | null>(null);
  const [isSearchNearbyOpen, setIsSearchNearbyOpen] = useState(false);
  const [searchNearbyLandmark, setSearchNearbyLandmark] = useState<Landmark | null>(null);
  const [searchNearbyCoordinates, setSearchNearbyCoordinates] = useState<[number, number] | null>(null);
  
  // Anti-spam mechanism
  const lastNotificationTime = useRef<{ [landmarkId: string]: number }>({});
  const minimumInterval = 10000; // 10 seconds between notifications for same landmark

  const shouldShowNotification = useCallback((landmarkId: string): boolean => {
    const now = Date.now();
    const lastTime = lastNotificationTime.current[landmarkId] || 0;
    
    if (now - lastTime < minimumInterval) {
      return false;
    }
    
    lastNotificationTime.current[landmarkId] = now;
    return true;
  }, []);

  const showFloatingCard = useCallback((landmark: Landmark, distance: number) => {
    if (!shouldShowNotification(landmark.id)) {
      return;
    }

    console.log('🃏 Showing floating card for:', landmark.name, 'at', distance + 'm');
    
    const notification: ProximityNotification = {
      id: `floating-${landmark.id}-${Date.now()}`,
      landmark,
      distance,
      notificationType: 'floating-card',
      timestamp: Date.now()
    };

    setActiveNotification(notification);
  }, [shouldShowNotification]);

  const hideFloatingCard = useCallback(() => {
    console.log('🃏 Hiding floating card');
    setActiveNotification(null);
  }, []);

  const showRouteVisualization = useCallback((landmark: Landmark, distance: number) => {
    console.log('🗺️ Showing route visualization for:', landmark.name, 'at', distance + 'm');
    
    // This will be handled by the Map component
    const notification: ProximityNotification = {
      id: `route-${landmark.id}-${Date.now()}`,
      landmark,
      distance,
      notificationType: 'route-visual',
      timestamp: Date.now()
    };

    // For now, we'll use a toast as fallback
    toast({
      title: "Route Available",
      description: `Route to ${landmark.name} (${Math.round(distance)}m away)`,
    });
  }, [toast]);

  const showSearchNearby = useCallback((landmark: Landmark, coordinates: [number, number]) => {
    console.log('🔍 Opening search nearby for:', landmark.name);
    setSearchNearbyLandmark(landmark);
    setSearchNearbyCoordinates(coordinates);
    setIsSearchNearbyOpen(true);
  }, []);

  const hideSearchNearby = useCallback(() => {
    console.log('🔍 Closing search nearby');
    setIsSearchNearbyOpen(false);
    setSearchNearbyLandmark(null);
    setSearchNearbyCoordinates(null);
  }, []);

  return {
    activeNotification,
    showFloatingCard,
    hideFloatingCard,
    showRouteVisualization,
    showSearchNearby,
    hideSearchNearby,
    isSearchNearbyOpen,
    searchNearbyLandmark,
    searchNearbyCoordinates
  };
};
