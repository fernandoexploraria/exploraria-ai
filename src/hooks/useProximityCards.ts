import { useState, useEffect, useRef, useCallback } from 'react';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useNearbyLandmarks } from '@/hooks/useNearbyLandmarks';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { TourLandmark } from '@/data/tourLandmarks';

interface CardCooldownEntry {
  placeId: string;
  timestamp: number;
}

interface CardLandmark {
  landmark: TourLandmark;
  distance: number;
}

const CARD_COOLDOWN_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

export const useProximityCards = () => {
  const { proximitySettings } = useProximityAlerts();
  const { userLocation } = useLocationTracking();
  const [cardCooldown, setCardCooldown] = useState<CardCooldownEntry[]>([]);
  const [activeCardLandmark, setActiveCardLandmark] = useState<TourLandmark | null>(null);
  
  // Get nearby landmarks for card display (using card_distance)
  const cardNearbyLandmarks = useNearbyLandmarks({
    userLocation,
    notificationDistance: proximitySettings?.card_distance || 50
  });

  // Cleanup expired cooldown entries
  const cleanupCooldown = useCallback(() => {
    const now = Date.now();
    setCardCooldown(prev => 
      prev.filter(entry => now - entry.timestamp < CARD_COOLDOWN_DURATION)
    );
  }, []);

  // Check if a landmark is in cooldown
  const isInCooldown = useCallback((placeId: string): boolean => {
    const now = Date.now();
    return cardCooldown.some(entry => 
      entry.placeId === placeId && 
      (now - entry.timestamp) < CARD_COOLDOWN_DURATION
    );
  }, [cardCooldown]);

  // Add landmark to cooldown
  const addToCooldown = useCallback((placeId: string) => {
    setCardCooldown(prev => [...prev, { placeId, timestamp: Date.now() }]);
  }, []);

  // Process card display logic
  useEffect(() => {
    if (!userLocation || !proximitySettings || cardNearbyLandmarks.length === 0) {
      return;
    }

    // Find the closest landmark that's not in cooldown
    const eligibleLandmark = cardNearbyLandmarks.find(({ landmark }) => 
      !isInCooldown(landmark.placeId)
    );

    if (eligibleLandmark && !activeCardLandmark) {
      console.log(`💳 Showing card for ${eligibleLandmark.landmark.name} at ${Math.round(eligibleLandmark.distance)}m`);
      addToCooldown(eligibleLandmark.landmark.placeId);
      setActiveCardLandmark(eligibleLandmark.landmark);
    }
  }, [cardNearbyLandmarks, isInCooldown, addToCooldown, activeCardLandmark, userLocation, proximitySettings]);

  // Cleanup cooldown entries every minute
  useEffect(() => {
    const interval = setInterval(cleanupCooldown, 60000);
    return () => clearInterval(interval);
  }, [cleanupCooldown]);

  // Close card handler
  const closeCard = useCallback(() => {
    setActiveCardLandmark(null);
  }, []);

  return {
    cardNearbyLandmarks,
    activeCardLandmark,
    cardCooldown,
    closeCard,
    // Debug info
    debugInfo: {
      cardNearbyCount: cardNearbyLandmarks.length,
      cooldownCount: cardCooldown.length,
      cardDistance: proximitySettings?.card_distance || 50,
      hasActiveCard: !!activeCardLandmark
    }
  };
};