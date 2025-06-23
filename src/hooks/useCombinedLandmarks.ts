
import { useMemo, useEffect, useState } from 'react';
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
  const [tourLandmarks, setTourLandmarks] = useState<Landmark[]>([]);

  // Poll for tour landmarks changes (since it's a global store)
  useEffect(() => {
    const updateTourLandmarks = () => {
      const currentTourLandmarks = getGlobalTourLandmarks();
      setTourLandmarks(currentTourLandmarks);
    };

    // Initial load
    updateTourLandmarks();

    // Poll every 500ms to check for changes
    const interval = setInterval(updateTourLandmarks, 500);

    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    console.log(`🔍 DEBUG MODE: Returning only tour-generated landmarks`);
    console.log(`📍 Tour landmarks count: ${tourLandmarks.length}`);
    
    if (tourLandmarks.length > 0) {
      console.log(`🗺️ Tour landmarks details:`, tourLandmarks.map(landmark => ({
        id: landmark.id,
        name: landmark.name,
        coordinates: landmark.coordinates,
        description: landmark.description?.substring(0, 50) + '...'
      })));
    }
    
    // Return only tour landmarks for debugging
    return tourLandmarks;
  }, [tourLandmarks]);
};
