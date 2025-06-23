
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
    // TEMPORARY DEBUG: Return only tour-generated landmarks
    console.log(`🔍 DEBUG MODE: Returning only tour-generated landmarks`);
    console.log(`📍 Tour landmarks count: ${plannedLandmarks.length}`);
    
    if (plannedLandmarks.length > 0) {
      console.log(`🗺️ Tour landmarks details:`, plannedLandmarks.map(landmark => ({
        id: landmark.id,
        name: landmark.name,
        coordinates: landmark.coordinates,
        description: landmark.description?.substring(0, 50) + '...'
      })));
    }
    
    // Return only tour landmarks for debugging
    return plannedLandmarks;
    
    // ORIGINAL CODE (commented out for debugging):
    // const topLandmarksConverted = TOP_LANDMARKS.map(convertTopLandmarkToLandmark);
    // const combined = [...topLandmarksConverted, ...plannedLandmarks];
    // console.log(`🗺️ Combined landmarks generated: ${topLandmarksConverted.length} top landmarks + ${plannedLandmarks.length} tour landmarks = ${combined.length} total`);
    // return combined;
  }, [plannedLandmarks]);
};
