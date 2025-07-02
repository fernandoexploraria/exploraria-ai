
import { useState, useCallback } from 'react';
import { Landmark } from '@/data/landmarks';

interface PanoramaState {
  isOpen: boolean;
  location: { lat: number; lng: number } | null;
  landmarkName: string;
}

interface PanoramaAvailability {
  [key: string]: boolean;
}

export const useGoogleStreetViewPanorama = () => {
  const [panoramaState, setPanoramaState] = useState<PanoramaState>({
    isOpen: false,
    location: null,
    landmarkName: ''
  });
  
  const [availability, setAvailability] = useState<PanoramaAvailability>({});
  const [isCheckingAvailability, setIsCheckingAvailability] = useState<{[key: string]: boolean}>({});

  const checkPanoramaAvailability = useCallback(async (landmark: Landmark): Promise<boolean> => {
    const landmarkId = landmark.id;
    
    // Return cached result if available
    if (availability[landmarkId] !== undefined) {
      return availability[landmarkId];
    }

    // Don't check again if already checking
    if (isCheckingAvailability[landmarkId]) {
      return false;
    }

    setIsCheckingAvailability(prev => ({ ...prev, [landmarkId]: true }));

    try {
      // Check if google is available
      if (typeof google === 'undefined' || !google.maps) {
        console.warn('Google Maps API not loaded');
        return false;
      }

      return new Promise((resolve) => {
        const streetViewService = new google.maps.StreetViewService();
        const location = {
          lat: landmark.coordinates[1],
          lng: landmark.coordinates[0]
        };

        streetViewService.getPanorama({
          location: location,
          radius: 50
        }, (data, status) => {
          const isAvailable = status === google.maps.StreetViewStatus.OK;
          
          setAvailability(prev => ({ ...prev, [landmarkId]: isAvailable }));
          setIsCheckingAvailability(prev => ({ ...prev, [landmarkId]: false }));
          
          console.log(`Street View panorama availability for ${landmark.name}:`, isAvailable);
          resolve(isAvailable);
        });
      });
    } catch (error) {
      console.error(`Error checking panorama availability for ${landmark.name}:`, error);
      setAvailability(prev => ({ ...prev, [landmarkId]: false }));
      setIsCheckingAvailability(prev => ({ ...prev, [landmarkId]: false }));
      return false;
    }
  }, [availability, isCheckingAvailability]);

  const openPanorama = useCallback((landmark: Landmark) => {
    setPanoramaState({
      isOpen: true,
      location: {
        lat: landmark.coordinates[1],
        lng: landmark.coordinates[0]
      },
      landmarkName: landmark.name
    });
  }, []);

  const closePanorama = useCallback(() => {
    setPanoramaState({
      isOpen: false,
      location: null,
      landmarkName: ''
    });
  }, []);

  const isPanoramaAvailable = useCallback((landmarkId: string): boolean => {
    return availability[landmarkId] === true;
  }, [availability]);

  const isPanoramaCheckingAvailability = useCallback((landmarkId: string): boolean => {
    return isCheckingAvailability[landmarkId] === true;
  }, [isCheckingAvailability]);

  return {
    panoramaState,
    openPanorama,
    closePanorama,
    checkPanoramaAvailability,
    isPanoramaAvailable,
    isPanoramaCheckingAvailability
  };
};
