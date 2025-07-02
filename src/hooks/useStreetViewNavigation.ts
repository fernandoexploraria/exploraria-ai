
import { useState, useCallback, useEffect } from 'react';
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

  const openStreetViewModal = useCallback(async (
    landmarks: Landmark[], 
    initialLandmark?: Landmark,
    userLocation?: { latitude: number; longitude: number }
  ) => {
    console.log(`🔍 Opening panorama Street View modal for ${landmarks.length} landmarks`);
    console.log('📍 Landmarks to process:', landmarks.map(l => l.name));
    
    if (landmarks.length === 0) {
      console.error('❌ No landmarks provided to openStreetViewModal');
      return;
    }

    try {
      // TODO: Implement panorama metadata fetching
      // This will replace the old static Street View data fetching
      let streetViewItems = [];
      
      // For now, create placeholder items for panorama integration
      for (const landmark of landmarks) {
        console.log(`🔍 Preparing panorama data for ${landmark.name}...`);
        
        // Calculate distance if user location is available
        let distance;
        if (userLocation) {
          distance = Math.sqrt(
            Math.pow((landmark.coordinates[1] - userLocation.latitude) * 111000, 2) +
            Math.pow((landmark.coordinates[0] - userLocation.longitude) * 111000, 2)
          );
        }
        
        // TODO: Fetch panorama metadata instead of static images
        // const panoramaData = await fetchPanoramaMetadata(landmark, distance);
        
        streetViewItems.push({
          landmark,
          streetViewData: null // Will be populated with panorama data
        });
      }

      console.log('📋 Panorama street view items prepared:', streetViewItems.length);
      
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

      console.log('✅ Panorama Street View modal state updated');
      
    } catch (error) {
      console.error('❌ Error in openStreetViewModal:', error);
    }
  }, []);

  const closeStreetViewModal = useCallback(() => {
    console.log('🔒 Closing panorama Street View modal');
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
    navigatePrevious
  };
};
