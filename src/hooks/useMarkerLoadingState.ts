
import { useState, useCallback } from 'react';

interface UseMarkerLoadingStateReturn {
  isMarkersLoading: boolean;
  markersLoaded: boolean;
  startMarkerLoading: () => void;
  finishMarkerLoading: () => Promise<void>;
  resetMarkerState: () => void;
}

export const useMarkerLoadingState = (delayMs: number = 750): UseMarkerLoadingStateReturn => {
  const [isMarkersLoading, setIsMarkersLoading] = useState(false);
  const [markersLoaded, setMarkersLoaded] = useState(false);

  const startMarkerLoading = useCallback(() => {
    setIsMarkersLoading(true);
    setMarkersLoaded(false);
  }, []);

  const finishMarkerLoading = useCallback(async () => {
    // Wait for markers to be added to DOM
    await new Promise(resolve => setTimeout(resolve, delayMs));
    setIsMarkersLoading(false);
    setMarkersLoaded(true);
  }, [delayMs]);

  const resetMarkerState = useCallback(() => {
    setIsMarkersLoading(false);
    setMarkersLoaded(false);
  }, []);

  return {
    isMarkersLoading,
    markersLoaded,
    startMarkerLoading,
    finishMarkerLoading,
    resetMarkerState
  };
};
