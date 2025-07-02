
import { useState, useCallback, useEffect } from 'react';
import { useEnhancedStreetViewMulti } from '@/hooks/useEnhancedStreetViewMulti';
import { Landmark } from '@/data/landmarks';

interface StreetViewNavigationState {
  isModalOpen: boolean;
  currentIndex: number;
  streetViewItems: Array<{
    landmark: Landmark;
    streetViewData: any | null;
    hasPanorama: boolean;
    panoramaIds: string[];
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
    getViewpointStrategy,
    hasPanoramaData,
    getPanoramaIds
  } = useEnhancedStreetViewMulti();

  const openStreetViewModal = useCallback(async (
    landmarks: Landmark[], 
    initialLandmark?: Landmark,
    userLocation?: { latitude: number; longitude: number }
  ) => {
    console.log(`🔍 Opening enhanced Street View modal with panorama support for ${landmarks.length} landmarks`);
    console.log('📍 Landmarks to process:', landmarks.map(l => l.name));
    
    if (landmarks.length === 0) {
      console.error('❌ No landmarks provided to openStreetViewModal');
      return;
    }

    try {
      // If user location is provided, use proximity-based preloading with panorama prioritization
      if (userLocation) {
        console.log('🔄 Using proximity-based enhanced Street View preloading with panorama support...');
        await preloadForProximity(landmarks, userLocation);
      }
      
      let streetViewItems = [];
      
      // Fetch enhanced Street View data individually with distance-based strategies and panorama support
      for (const landmark of landmarks) {
        try {
          console.log(`🔍 Getting enhanced Street View with panorama for ${landmark.name}...`);
          
          // Calculate distance if user location is available
          let distance;
          if (userLocation) {
            distance = Math.sqrt(
              Math.pow((landmark.coordinates[1] - userLocation.latitude) * 111000, 2) +
              Math.pow((landmark.coordinates[0] - userLocation.longitude) * 111000, 2)
            );
          }
          
          const streetViewData = await fetchEnhancedStreetView(landmark, distance);
          
          // Extract panorama information
          const hasPanorama = streetViewData?.metadata.panoramaStats?.availableCount || 0 > 0;
          const panoramaIds = streetViewData?.metadata.panoramaStats?.panoramaIds || [];
          
          streetViewItems.push({
            landmark,
            streetViewData,
            hasPanorama,
            panoramaIds
          });
          
          if (streetViewData) {
            const isMultiViewpoint = 'viewpoints' in streetViewData;
            const viewCount = isMultiViewpoint ? streetViewData.viewpoints.length : 1;
            const dataUsage = isMultiViewpoint ? streetViewData.metadata.dataUsage : 'Single view';
            const panoramaStats = streetViewData.metadata.panoramaStats;
            
            console.log(`✅ Got enhanced Street View for ${landmark.name}:`, {
              viewpoints: viewCount,
              dataUsage,
              hasPanorama,
              panoramaCount: panoramaStats?.availableCount || 0,
              connected: panoramaStats?.hasConnectedViews || false
            });
          } else {
            console.log(`❌ No enhanced Street View available for ${landmark.name}`);
          }
        } catch (error) {
          console.log(`❌ Failed to get enhanced Street View for ${landmark.name}:`, error);
          streetViewItems.push({
            landmark,
            streetViewData: null,
            hasPanorama: false,
            panoramaIds: []
          });
        }
      }

      console.log('📋 Final enhanced street view items with panorama support:', {
        total: streetViewItems.length,
        withData: streetViewItems.filter(item => item.streetViewData).length,
        withPanorama: streetViewItems.filter(item => item.hasPanorama).length,
        totalPanoramaIds: streetViewItems.reduce((sum, item) => sum + item.panoramaIds.length, 0)
      });
      
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

      console.log('✅ Enhanced Street View modal with panorama support ready');
      
    } catch (error) {
      console.error('❌ Error in openStreetViewModal with panorama support:', error);
    }
  }, [fetchEnhancedStreetView, preloadForProximity]);

  const closeStreetViewModal = useCallback(() => {
    console.log('🔒 Closing enhanced Street View modal');
    setState(prev => ({ ...prev, isModalOpen: false }));
  }, []);

  const navigateToIndex = useCallback((index: number) => {
    const newIndex = Math.max(0, Math.min(index, state.streetViewItems.length - 1));
    const item = state.streetViewItems[newIndex];
    
    console.log(`🧭 Navigating to index ${newIndex}:`, {
      landmark: item?.landmark.name,
      hasPanorama: item?.hasPanorama,
      panoramaIds: item?.panoramaIds.length || 0
    });
    
    setState(prev => ({ 
      ...prev, 
      currentIndex: newIndex
    }));
  }, [state.streetViewItems]);

  const navigateNext = useCallback(() => {
    const nextIndex = state.currentIndex < state.streetViewItems.length - 1 
      ? state.currentIndex + 1 
      : 0;
    
    navigateToIndex(nextIndex);
  }, [state.currentIndex, state.streetViewItems.length, navigateToIndex]);

  const navigatePrevious = useCallback(() => {
    const prevIndex = state.currentIndex > 0 
      ? state.currentIndex - 1 
      : state.streetViewItems.length - 1;
    
    navigateToIndex(prevIndex);
  }, [state.currentIndex, state.streetViewItems.length, navigateToIndex]);

  // Get current item's panorama information
  const getCurrentPanoramaInfo = useCallback(() => {
    const currentItem = state.streetViewItems[state.currentIndex];
    if (!currentItem) return null;
    
    return {
      hasPanorama: currentItem.hasPanorama,
      panoramaIds: currentItem.panoramaIds,
      landmark: currentItem.landmark.name
    };
  }, [state.streetViewItems, state.currentIndex]);

  return {
    isModalOpen: state.isModalOpen,
    currentIndex: state.currentIndex,
    streetViewItems: state.streetViewItems,
    openStreetViewModal,
    closeStreetViewModal,
    navigateToIndex,
    navigateNext,
    navigatePrevious,
    getCurrentPanoramaInfo,
    getViewpointStrategy // Expose for external use
  };
};
