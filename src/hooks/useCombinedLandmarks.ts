
import { useMemo } from 'react';
import { Landmark } from '@/data/landmarks';
import { TOP_LANDMARKS, TopLandmark } from '@/data/topLandmarks';

// Convert TopLandmark to Landmark format
const convertTopLandmarkToLandmark = (topLandmark: TopLandmark): Landmark => {
  return {
    id: `top-${topLandmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: topLandmark.name,
    coordinates: topLandmark.coordinates, // Already in [lng, lat] format
    description: topLandmark.description
  };
};

export const useCombinedLandmarks = (tourLandmarks: Landmark[] = []): Landmark[] => {
  return useMemo(() => {
    // Convert top landmarks to Landmark format
    const convertedTopLandmarks = TOP_LANDMARKS.map(convertTopLandmarkToLandmark);
    
    // Combine both landmark sets
    const combinedLandmarks = [...convertedTopLandmarks, ...tourLandmarks];
    
    console.log(`🗺️ Combined landmarks: ${convertedTopLandmarks.length} top landmarks + ${tourLandmarks.length} tour landmarks = ${combinedLandmarks.length} total`);
    
    return combinedLandmarks;
  }, [tourLandmarks]);
};
