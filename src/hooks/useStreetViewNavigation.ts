
import { useState, useCallback, useEffect } from 'react';
import { useStreetViewBatch } from '@/hooks/useStreetViewBatch';
import { useEnhancedStreetView } from '@/hooks/useEnhancedStreetView';
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
  const { getStreetViewWithOfflineSupport } = useEnhancedStreetView();

  const openStreetViewModal = useCallback(async (
    landmarks: Landmark[], 
    initialLandmark?: Landmark
  ) => {
    console.log(`🔍 Opening Street View modal for ${landmarks.length} landmarks`);
    console.log('📍 Landmarks to process:', landmarks.map(l => l.name));
    
    if (landmarks.length === 0) {
      console.error('❌ No landmarks provided to openStreetViewModal');
      return;
    }

    try {
      // Try batch pre-loading first
      console.log('🔄 Attempting batch pre-loading...');
      await batchPreloadStreetView(landmarks);
      
      let streetViewItems = [];
      
      // If batch results are available, use them
      if (results.length > 0) {
        console.log('✅ Using batch results:', results.length);
        streetViewItems = results.map(result => ({
          landmark: result.landmark,
          streetViewData: result.data
        }));
      } else {
        // Fallback: try to get Street View data individually
        console.log('🔄 Batch failed, trying individual Street View requests...');
        
        for (const landmark of landmarks) {
          try {
            console.log(`🔍 Getting Street View for ${landmark.name}...`);
            const streetViewData = await getStreetViewWithOfflineSupport(landmark);
            streetViewItems.push({
              landmark,
              streetViewData
            });
            console.log(`✅ Got Street View data for ${landmark.name}`);
          } catch (error) {
            console.log(`❌ Failed to get Street View for ${landmark.name}:`, error);
            streetViewItems.push({
              landmark,
              streetViewData: null
            });
          }
        }
      }

      console.log('📋 Final street view items:', streetViewItems.length);
      
      // Find initial index
      const initialIndex = initialLandmark 
        ? landmarks.findIndex(l => l.id === initialLandmark.id)
        : 0;

      console.log('🎯 Setting initial index:', initialIndex);

      setState({
        isModalOpen: true,
        currentIndex: Math.max(0, initialIndex),
        streetViewItems
      });

      console.log('✅ Street View modal state updated, should be visible now');
      
    } catch (error) {
      console.error('❌ Error in openStreetViewModal:', error);
    }
  }, [batchPreloadStreetView, results, getStreetViewWithOfflineSupport]);

  const closeStreetViewModal = useCallback(() => {
    console.log('🔒 Closing Street View modal');
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
      console.log('🔄 Updating street view items from batch results:', results.length);
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
