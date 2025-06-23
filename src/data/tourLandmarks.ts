
import { Landmark } from '@/data/landmarks';

// Global store for current tour landmarks (in-memory, temporary)
let currentTourLandmarks: Landmark[] = [];

export const setGlobalTourLandmarks = (landmarks: Landmark[]): void => {
  console.log(`🗺️ Setting global tour landmarks: ${landmarks.length} landmarks`);
  currentTourLandmarks = [...landmarks];
};

export const getGlobalTourLandmarks = (): Landmark[] => {
  return [...currentTourLandmarks];
};

export const clearGlobalTourLandmarks = (): void => {
  console.log(`🗑️ Clearing global tour landmarks`);
  currentTourLandmarks = [];
};
