
import { useState, useCallback } from 'react';

interface PanoramaLocation {
  lat: number;
  lng: number;
  name: string;
}

// Test locations in Mexico City for demonstration
const TEST_LOCATIONS: PanoramaLocation[] = [
  {
    lat: 19.432608,
    lng: -99.133209,
    name: 'Zócalo (Mexico City Main Square)'
  },
  {
    lat: 19.435278,
    lng: -99.141111,
    name: 'Palacio de Bellas Artes'
  },
  {
    lat: 19.426017,
    lng: -99.137222,
    name: 'Palacio Nacional'
  }
];

export const useGoogleStreetViewTest = () => {
  const [isPanoramaOpen, setIsPanoramaOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<PanoramaLocation | null>(null);

  const openPanorama = useCallback((location: PanoramaLocation) => {
    console.log('🗺️ Opening Google Street View panorama for:', location.name);
    setCurrentLocation(location);
    setIsPanoramaOpen(true);
  }, []);

  const closePanorama = useCallback(() => {
    console.log('🚪 Closing Google Street View panorama');
    setIsPanoramaOpen(false);
    setCurrentLocation(null);
  }, []);

  return {
    isPanoramaOpen,
    currentLocation,
    testLocations: TEST_LOCATIONS,
    openPanorama,
    closePanorama
  };
};
