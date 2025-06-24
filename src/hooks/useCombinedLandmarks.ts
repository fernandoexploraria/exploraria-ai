
import { useState, useEffect } from 'react';
import { Landmark } from '@/data/landmarks';
import { getGlobalTourLandmarks } from '@/data/tourLandmarks';
import { getGlobalProximityMarkers } from '@/data/proximityMarkers';

export const useCombinedLandmarks = (baseLandmarks: Landmark[]) => {
  const [tourLandmarks, setTourLandmarks] = useState<Landmark[]>([]);
  const [proximityMarkers, setProximityMarkers] = useState<Landmark[]>([]);

  // Poll for tour landmarks changes
  useEffect(() => {
    const interval = setInterval(() => {
      const currentTourLandmarks = getGlobalTourLandmarks();
      setTourLandmarks(currentTourLandmarks);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Poll for proximity markers changes
  useEffect(() => {
    const interval = setInterval(() => {
      const currentProximityMarkers = getGlobalProximityMarkers();
      // Convert proximity markers to landmarks format
      const landmarkFormat = currentProximityMarkers.map(marker => ({
        id: marker.id,
        name: marker.name,
        coordinates: marker.coordinates,
        description: marker.description
      }));
      setProximityMarkers(landmarkFormat);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Combine all landmarks
  const allLandmarks = [...baseLandmarks, ...tourLandmarks, ...proximityMarkers];

  return {
    allLandmarks,
    tourLandmarks,
    proximityMarkers
  };
};
