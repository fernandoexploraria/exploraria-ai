
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
    // Convert top landmarks to Landmark format
    const convertedTopLandmarks = TOP_LANDMARKS.map(convertTopLandmarkToLandmark);
    
    // Combine both landmark sets
    const combinedLandmarks = [...convertedTopLandmarks, ...tourLandmarks];
    
    console.log(`🗺️ Combined landmarks: ${convertedTopLandmarks.length} top landmarks + ${tourLandmarks.length} tour landmarks = ${combinedLandmarks.length} total`);
    
    return combinedLandmarks;
  }, [tourLandmarks]);
};
