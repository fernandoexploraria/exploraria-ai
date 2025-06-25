
import { useState, useCallback, useEffect } from 'react';
import { useStreetViewBatch } from '@/hooks/useStreetViewBatch';
import { Landmark } from '@/data/landmarks';

interface StreetViewNavigationState {
  isModalOpen: boolean;
  currentIndex: number;
  streetViewItems: Array<{
    landmark: Landmark;
    streetViewData: any | null;
  }>;
}

export const useStreetViewNavigation = () => {
  const [state, setState] = useState<StreetViewNavigationState>({
    isModalOpen: false,
    currentIndex: 0,
    streetViewItems: []
  });

  const { batchPreloadStreetView, results } = useStreetViewBatch();

  const openStreetViewModal = useCallback(async (
    landmarks: Landmark[], 
    initialLandmark?: Landmark
  ) => {
    console.log(`🔍 Opening Street View modal for ${landmarks.length} landmarks`);
    
    // Start batch pre-loading
    await batchPreloadStreetView(landmarks);
    
    // Convert results to street view items
    const streetViewItems = results.map(result => ({
      landmark: result.landmark,
      streetViewData: result.data
    }));

    // Find initial index
    const initialIndex = initialLandmark 
      ? landmarks.findIndex(l => l.id === initialLandmark.id)
      : 0;

    setState({
      isModalOpen: true,
      currentIndex: Math.max(0, initialIndex),
      streetViewItems
    });
  }, [batchPreloadStreetView, results]);

  const closeStreetViewModal = useCallback(() => {
    setState(prev => ({ ...prev, isModalOpen: false }));
  }, []);

  const navigateToIndex = useCallback((index: number) => {
    setState(prev => ({ 
      ...prev, 
      currentIndex: Math.max(0, Math.min(index, prev.streetViewItems.length - 1))
    }));
  }, []);

  const navigateNext = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentIndex: prev.currentIndex < prev.streetViewItems.length - 1 
        ? prev.currentIndex + 1 
        : 0
    }));
  }, []);

  const navigatePrevious = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentIndex: prev.currentIndex > 0 
        ? prev.currentIndex - 1 
        : prev.streetViewItems.length - 1
    }));
  }, []);

  // Update street view items when batch results change
  useEffect(() => {
    if (results.length > 0) {
      setState(prev => ({
        ...prev,
        streetViewItems: results.map(result => ({
          landmark: result.landmark,
          streetViewData: result.data
        }))
      }));
    }
  }, [results]);

  return {
    isModalOpen: state.isModalOpen,
    currentIndex: state.currentIndex,
    streetViewItems: state.streetViewItems,
    openStreetViewModal,
    closeStreetViewModal,
    navigateToIndex,
    navigateNext,
    navigatePrevious
  };
};
