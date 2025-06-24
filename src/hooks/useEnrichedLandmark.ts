
import { useState, useCallback } from 'react';
import { Landmark } from '@/data/landmarks';

interface GooglePlacesDetails {
  name?: string;
  rating?: number;
  userRatingsTotal?: number;
  phoneNumber?: string;
  address?: string;
  website?: string;
  priceLevel?: number;
  openingHours?: string[];
  isOpenNow?: boolean;
  photos?: string[];
  placeId?: string;
}

interface EnrichedLandmark extends Landmark {
  googlePlaces?: GooglePlacesDetails;
  enrichedAt?: number;
}

export const useEnrichedLandmark = () => {
  const [enrichedLandmarks, setEnrichedLandmarks] = useState<Map<string, EnrichedLandmark>>(new Map());

  const enrichLandmark = useCallback((landmark: Landmark, googlePlacesDetails: GooglePlacesDetails) => {
    const enriched: EnrichedLandmark = {
      ...landmark,
      googlePlaces: googlePlacesDetails,
      enrichedAt: Date.now()
    };

    setEnrichedLandmarks(prev => new Map(prev.set(landmark.id, enriched)));
    return enriched;
  }, []);

  const getEnrichedLandmark = useCallback((landmarkId: string): EnrichedLandmark | null => {
    return enrichedLandmarks.get(landmarkId) || null;
  }, [enrichedLandmarks]);

  const isLandmarkEnriched = useCallback((landmarkId: string): boolean => {
    const enriched = enrichedLandmarks.get(landmarkId);
    if (!enriched?.enrichedAt) return false;
    
    // Consider data stale after 1 hour
    const oneHour = 60 * 60 * 1000;
    return (Date.now() - enriched.enrichedAt) < oneHour;
  }, [enrichedLandmarks]);

  const clearEnrichedData = useCallback(() => {
    setEnrichedLandmarks(new Map());
  }, []);

  return {
    enrichLandmark,
    getEnrichedLandmark,
    isLandmarkEnriched,
    clearEnrichedData,
    enrichedLandmarks: Array.from(enrichedLandmarks.values())
  };
};
