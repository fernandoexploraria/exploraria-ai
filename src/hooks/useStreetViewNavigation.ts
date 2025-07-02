
import { useState, useCallback, useEffect } from 'react';
import { useEnhancedStreetViewMulti } from '@/hooks/useEnhancedStreetViewMulti';
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

  const { 
    fetchEnhancedStreetView, 
    preloadForProximity,
    getViewpointStrategy 
  } = useEnhancedStreetViewMulti();

  const openStreetViewModal = useCallback(async (
    landmarks: Landmark[], 
    initialLandmark?: Landmark,
    userLocation?: { latitude: number; longitude: number }
  ) => {
    console.log(`🔍 Opening enhanced Street View modal for ${landmarks.length} landmarks`);
    console.log('📍 Landmarks to process:', landmarks.map(l => l.name));
    
    if (landmarks.length === 0) {
      console.error('❌ No landmarks provided to openStreetViewModal');
      return;
    }

    try {
      // If user location is provided, use proximity-based preloading
      if (userLocation) {
        console.log('🔄 Using proximity-based enhanced Street View preloading...');
        await preloadForProximity(landmarks, userLocation);
      }
      
      let streetViewItems = [];
      
      // Fetch enhanced Street View data individually with distance-based strategies
      for (const landmark of landmarks) {
        try {
          console.log(`🔍 Getting enhanced Street View for ${landmark.name}...`);
          
          // Calculate distance if user location is available
          let distance;
          if (userLocation) {
            distance = Math.sqrt(
              Math.pow((landmark.coordinates[1] - userLocation.latitude) * 111000, 2) +
              Math.pow((landmark.coordinates[0] - userLocation.longitude) * 111000, 2)
            );
          }
          
          const streetViewData = await fetchEnhancedStreetView(landmark, distance);
          streetViewItems.push({
            landmark,
            streetViewData
          });
          
          if (streetViewData) {
            const isMultiViewpoint = 'viewpoints' in streetViewData;
            const viewCount = isMultiViewpoint ? streetViewData.viewpoints.length : 1;
            const dataUsage = isMultiViewpoint ? streetViewData.metadata.dataUsage : 'Single view';
            console.log(`✅ Got enhanced Street View for ${landmark.name}: ${viewCount} viewpoints (${dataUsage})`);
          } else {
            console.log(`❌ No enhanced Street View available for ${landmark.name}`);
          }
        } catch (error) {
          console.log(`❌ Failed to get enhanced Street View for ${landmark.name}:`, error);
          streetViewItems.push({
            landmark,
            streetViewData: null
          });
        }
      }

      console.log('📋 Final enhanced street view items:', streetViewItems.length);
      
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

      console.log('✅ Enhanced Street View modal state updated, should be visible now');
      
    } catch (error) {
      console.error('❌ Error in openStreetViewModal:', error);
    }
  }, [fetchEnhancedStreetView, preloadForProximity]);

  const closeStreetViewModal = useCallback(() => {
    console.log('🔒 Closing enhanced Street View modal');
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

  return {
    isModalOpen: state.isModalOpen,
    currentIndex: state.currentIndex,
    streetViewItems: state.streetViewItems,
    openStreetViewModal,
    closeStreetViewModal,
    navigateToIndex,
    navigateNext,
    navigatePrevious,
    getViewpointStrategy // Expose for external use
  };
};
