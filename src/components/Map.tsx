import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleMap, Marker, useJsApiLoader, InfoWindow } from '@react-google-maps/api';
import { Loader } from '@googlemaps/js-api-loader';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useDebounce } from 'usehooks-ts';
import { Eye, Locate, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from "@/components/ui/skeleton"

import { Landmark } from '@/data/landmarks';
import { getLandmarks } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useStreetViewNavigation } from '@/hooks/useStreetViewNavigation';

interface MapProps {
  mapboxToken: string;
  landmarks: Landmark[];
  onSelectLandmark: (landmark: Landmark) => void;
  selectedLandmark: Landmark | null;
  plannedLandmarks: Landmark[];
}

const Map: React.FC<MapProps> = ({ 
  mapboxToken, 
  landmarks, 
  onSelectLandmark, 
  selectedLandmark, 
  plannedLandmarks 
}) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 300);
  const [currentLandmark, setCurrentLandmark] = useState<Landmark | null>(null);
  const [showTraffic, setShowTraffic] = useLocalStorage<boolean>('showTraffic', false);
  const [showTransit, setShowTransit] = useLocalStorage<boolean>('showTransit', false);
  const { location: userLocation, error: geolocationError, isLoading: locationLoading } = useGeolocation();
  const { isOnline } = useNetworkStatus();

  const { 
    isModalOpen, 
    openStreetViewModal, 
    closeStreetViewModal, 
    currentIndex, 
    streetViewItems 
  } = useStreetViewNavigation();

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: mapboxToken, // Using mapboxToken as Google Maps API key for now
  });

  const { data: apiLandmarks, isLoading, error } = useQuery(
    ['landmarks', debouncedSearch],
    () => getLandmarks(debouncedSearch),
    {
      retry: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false
    }
  );

  // Combine provided landmarks with API landmarks
  const allLandmarks = [...landmarks, ...(apiLandmarks || [])];

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
    }
  }, [initialSearch]);

  const mapContainerStyle = {
    width: '100%',
    height: '100%',
  };

  const center = userLocation
    ? { lat: userLocation.latitude, lng: userLocation.longitude }
    : { lat: 40.7128, lng: -74.0060 }; // Default to New York

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const handleMarkerClick = (landmark: Landmark) => {
    setCurrentLandmark(landmark);
    onSelectLandmark(landmark);
  };

  const handleTrafficToggle = (checked: boolean) => {
    setShowTraffic(checked);
  };

  const handleTransitToggle = (checked: boolean) => {
    setShowTransit(checked);
  };

  useEffect(() => {
    if (mapRef.current) {
      if (showTraffic) {
        const trafficLayer = new google.maps.TrafficLayer();
        trafficLayer.setMap(mapRef.current);
      } else {
        // Remove traffic layer by setting map to null
        const trafficLayer = new google.maps.TrafficLayer();
        trafficLayer.setMap(null);
      }
    }
  }, [showTraffic]);

  useEffect(() => {
    if (mapRef.current) {
      if (showTransit) {
        const transitLayer = new google.maps.TransitLayer();
        transitLayer.setMap(mapRef.current);
      } else {
        const transitLayer = new google.maps.TransitLayer();
        transitLayer.setMap(null);
      }
    }
  }, [showTransit]);

  const handleEnhancedStreetViewOpen = useCallback(async () => {
    if (!currentLandmark) {
      console.log('❌ No landmark selected for Street View');
      return;
    }

    console.log('🚀 Opening enhanced Street View modal with panorama context for:', currentLandmark.name);
    
    try {
      // Calculate distance for strategy selection if user location is available
      let distance = 1000; // Default distance for strategy selection
      if (userLocation) {
        distance = Math.sqrt(
          Math.pow((currentLandmark.coordinates[1] - userLocation.latitude) * 111000, 2) +
          Math.pow((currentLandmark.coordinates[0] - userLocation.longitude) * 111000, 2)
        );
      }

      console.log(`📏 Distance to ${currentLandmark.name}: ${Math.round(distance)}m`);

      // Use the enhanced Street View navigation system with panorama support
      await openStreetViewModal(
        [currentLandmark], // Pass as array for the enhanced system
        currentLandmark,   // Initial landmark
        userLocation       // User location for distance-based strategies
      );

      console.log('✅ Enhanced Street View modal opened with panorama support');
    } catch (error) {
      console.error('❌ Error opening enhanced Street View modal:', error);
      
      // Fallback to show error message
      const errorMessage = !isOnline 
        ? 'Street View is not available offline'
        : 'Street View is temporarily unavailable';
      
      console.log(`ℹ️ ${errorMessage} for ${currentLandmark.name}`);
    }
  }, [currentLandmark, userLocation, openStreetViewModal, isOnline]);

  return (
    <div className="h-full w-full relative">
      {/* Map Interface */}
      <div className="absolute top-2 left-2 z-10 w-80 p-4 rounded-lg bg-white/80 backdrop-blur-sm shadow-md">
        <Card>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="search">Search Landmarks</Label>
              <Input
                id="search"
                placeholder="Enter landmark name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="traffic">Show Traffic</Label>
              <Switch
                id="traffic"
                checked={showTraffic}
                onCheckedChange={handleTrafficToggle}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="transit">Show Transit</Label>
              <Switch
                id="transit"
                checked={showTransit}
                onCheckedChange={handleTransitToggle}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Geolocation Loading Indicator */}
      {locationLoading && (
        <div className="absolute top-2/4 left-1/2 z-20 p-4 rounded-lg bg-white/80 backdrop-blur-sm shadow-md transform -translate-x-1/2 -translate-y-1/2">
          <p>Detecting your location...</p>
        </div>
      )}

      {/* Error Handling */}
      {!isLoaded && !isLoading && (
        <div className="absolute top-2/4 left-1/2 z-20 p-4 rounded-lg bg-red-500 text-white transform -translate-x-1/2 -translate-y-1/2">
          <p>
            {loadError ? 'Error loading Google Maps' : error ? 'Error fetching landmarks' : 'Loading...'}
          </p>
        </div>
      )}

      {/* Map Rendering */}
      {isLoaded && (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={12}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            mapId: 'YOUR_MAP_ID',
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'greedy'
          }}
        >
          {userLocation && (
            <Marker
              position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: 'blue',
                fillOpacity: 0.8,
                strokeWeight: 1,
                strokeColor: 'white',
              }}
            />
          )}
          {allLandmarks?.map((landmark) => (
            <Marker
              key={landmark.id}
              position={{ lat: landmark.coordinates[1], lng: landmark.coordinates[0] }}
              onClick={() => handleMarkerClick(landmark)}
            />
          ))}

          {currentLandmark && (
            <InfoWindow
              position={{ lat: currentLandmark.coordinates[1], lng: currentLandmark.coordinates[0] }}
              onCloseClick={() => setCurrentLandmark(null)}
            >
              <div className="p-2">
                <h3 className="text-lg font-semibold">{currentLandmark.name}</h3>
                <p>{currentLandmark.description}</p>
                <Button variant="outline" size="sm" onClick={handleEnhancedStreetViewOpen}>
                  <Eye className="mr-2 h-4 w-4" />
                  Street View
                </Button>
              </div>
            </InfoWindow>
          )}

          {/* Locate Me Button */}
          {userLocation && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute bottom-4 right-4 z-10 shadow-md"
              onClick={() => {
                mapRef.current?.panTo({ lat: userLocation.latitude, lng: userLocation.longitude });
              }}
            >
              <Locate className="h-5 w-5" />
            </Button>
          )}
        </GoogleMap>
      )}
    </div>
  );
};

export default Map;
