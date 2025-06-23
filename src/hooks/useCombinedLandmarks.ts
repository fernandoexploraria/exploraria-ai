
import { useMemo } from 'react';
import { Landmark } from '@/data/landmarks';
import { TOP_LANDMARKS, TopLandmark } from '@/data/topLandmarks';
import { useTourPlanner } from '@/hooks/useTourPlanner';

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
  const { plannedLandmarks } = useTourPlanner();

  return useMemo(() => {
    // Convert Top 100 landmarks to Landmark format
    const topLandmarksConverted = TOP_LANDMARKS.map(convertTopLandmarkToLandmark);
    
    // Combine with tour-generated landmarks
    const combined = [...topLandmarksConverted, ...plannedLandmarks];
    
    console.log(`🗺️ Combined landmarks generated: ${topLandmarksConverted.length} top landmarks + ${plannedLandmarks.length} tour landmarks = ${combined.length} total`);
    
    return combined;
  }, [plannedLandmarks]);
};
