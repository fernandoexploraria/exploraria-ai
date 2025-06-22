
import { useState, useEffect, useCallback, useRef } from 'react';
import { landmarks } from '@/data/landmarks';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface ProximityAlert {
  landmark: any;
  distance: number;
  timestamp: number;
}

interface UseProximityAlertsProps {
  location: LocationData | null;
  proximityDistance: number;
  transportationMode: 'walking' | 'driving';
  enabled: boolean;
  onAlert: (alert: ProximityAlert) => void;
}

export const useProximityAlerts = ({
  location,
  proximityDistance,
  transportationMode,
  enabled,
  onAlert
}: UseProximityAlertsProps) => {
  const [nearbyLandmarks, setNearbyLandmarks] = useState<any[]>([]);
  const alertCooldowns = useRef<Map<string, number>>(new Map());
  
  // Cooldown period: 30 minutes to prevent spam
  const COOLDOWN_PERIOD = 30 * 60 * 1000;

  // Calculate distance between two points in meters
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }, []);

  // Check if landmark is on cooldown
  const isOnCooldown = useCallback((landmarkId: string) => {
    const lastAlertTime = alertCooldowns.current.get(landmarkId);
    if (!lastAlertTime) return false;
    
    return Date.now() - lastAlertTime < COOLDOWN_PERIOD;
  }, []);

  // Add landmark to cooldown
  const addToCooldown = useCallback((landmarkId: string) => {
    alertCooldowns.current.set(landmarkId, Date.now());
  }, []);

  // Check proximity to landmarks
  const checkProximity = useCallback(() => {
    if (!location || !enabled) {
      setNearbyLandmarks([]);
      return;
    }

    const nearby: any[] = [];
    const alerts: ProximityAlert[] = [];

    landmarks.forEach((landmark) => {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        landmark.coordinates[1], // lat
        landmark.coordinates[0]  // lng
      );

      // Check if within proximity distance
      if (distance <= proximityDistance) {
        nearby.push({ ...landmark, distance });

        // Check if we should trigger an alert
        if (!isOnCooldown(landmark.id)) {
          alerts.push({
            landmark,
            distance,
            timestamp: Date.now()
          });
          
          // Add to cooldown to prevent repeated alerts
          addToCooldown(landmark.id);
        }
      }
    });

    setNearbyLandmarks(nearby);

    // Trigger alerts for new discoveries
    alerts.forEach((alert) => {
      console.log(`Proximity alert: ${alert.landmark.name} at ${Math.round(alert.distance)}m`);
      onAlert(alert);
    });
  }, [location, enabled, proximityDistance, calculateDistance, isOnCooldown, addToCooldown, onAlert]);

  // Effect to check proximity when location changes
  useEffect(() => {
    checkProximity();
  }, [checkProximity]);

  // Get distance-based recommendations (further landmarks user might want to visit)
  const getRecommendations = useCallback(() => {
    if (!location) return [];

    const recommendations = landmarks
      .map((landmark) => ({
        ...landmark,
        distance: calculateDistance(
          location.latitude,
          location.longitude,
          landmark.coordinates[1],
          landmark.coordinates[0]
        )
      }))
      .filter((landmark) => landmark.distance > proximityDistance && landmark.distance <= proximityDistance * 3)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);

    return recommendations;
  }, [location, proximityDistance, calculateDistance]);

  // Clear all cooldowns (useful for testing or user preference)
  const clearCooldowns = useCallback(() => {
    alertCooldowns.current.clear();
  }, []);

  return {
    nearbyLandmarks,
    getRecommendations,
    clearCooldowns,
    isOnCooldown: (landmarkId: string) => isOnCooldown(landmarkId)
  };
};
