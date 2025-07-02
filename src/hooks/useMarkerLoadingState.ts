
import { useState, useCallback } from 'react';

interface UseMarkerLoadingStateReturn {
  isMarkersLoading: boolean;
  markersLoaded: boolean;
  startMarkerLoading: () => void;
  finishMarkerLoading: () => Promise<void>;
  resetMarkerState: () => void;
  setMarkerLoadingState: (markerId: string, isLoading: boolean) => void;
}

export const useMarkerLoadingState = (delayMs: number = 750): UseMarkerLoadingStateReturn => {
  const [isMarkersLoading, setIsMarkersLoading] = useState(false);
  const [markersLoaded, setMarkersLoaded] = useState(false);
  const [markerStates, setMarkerStates] = useState<{ [key: string]: boolean }>({});

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
    setMarkerStates({});
  }, []);

  const setMarkerLoadingState = useCallback((markerId: string, isLoading: boolean) => {
    setMarkerStates(prev => ({
      ...prev,
      [markerId]: isLoading
    }));
  }, []);

  return {
    isMarkersLoading,
    markersLoaded,
    startMarkerLoading,
    finishMarkerLoading,
    resetMarkerState,
    setMarkerLoadingState
  };
};
