
import { useMemo } from 'react';
import { Landmark } from '@/data/landmarks';
import { TOP_LANDMARKS, TopLandmark } from '@/data/topLandmarks';
import { getGlobalTourLandmarks } from '@/data/tourLandmarks';

// Convert TopLandmark to Landmark format
const convertTopLandmarkToLandmark = (topLandmark: TopLandmark): Landmark => {
  return {
    id: `top-${topLandmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: topLandmark.name,
    coordinates: topLandmark.coordinates, // Already in [lng, lat] format
    description: topLandmark.description
  };
};

export const useCombinedLandmarks = (): Landmark[] => {
  return useMemo(() => {
    // Convert Top 100 landmarks to Landmark format
    const topLandmarksConverted = TOP_LANDMARKS.map(convertTopLandmarkToLandmark);
    
    // Get current tour landmarks from global store
    const tourLandmarks = getGlobalTourLandmarks();
    
    // Combine both landmark sources
    const combined = [...topLandmarksConverted, ...tourLandmarks];
    
    console.log(`🗺️ Combined landmarks: ${topLandmarksConverted.length} top landmarks + ${tourLandmarks.length} tour landmarks = ${combined.length} total`);
    
    return combined;
  }, []); // No dependencies needed since we read from global store
};
