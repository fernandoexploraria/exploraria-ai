
import React, { useState, useRef, useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEnhancedPhotos } from '@/hooks/useEnhancedPhotos';
import { usePhotoCarouselState } from '@/hooks/usePhotoCarouselState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,  
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, MapPin, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from "@/components/ui/skeleton"
import { PhotoCarousel } from './photo-carousel';
import { PhotoData } from '@/hooks/useEnhancedPhotos';
import { Landmark } from '@/data/landmarks';

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
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [lng, setLng] = useState(-73.9857);
  const [lat, setLat] = useState(40.7589);
  const [zoom, setZoom] = useState(12);
  const [radius, setRadius] = useState(1000);
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [maxResults, setMaxResults] = useState(10);
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carouselState = usePhotoCarouselState();
  const { 
    fetchPhotos,
    getOptimalPhotoUrl,
    loading: photosLoading,
    error: photosError
  } = useEnhancedPhotos();

  // Set the mapbox token
  useEffect(() => {
    if (mapboxToken) {
      mapboxgl.accessToken = mapboxToken;
    }
  }, [mapboxToken]);

  useEffect(() => {
    if (mapRef.current) return; // prevent initialize map twice
    if (!mapContainerRef.current) return; // container is not rendered
    if (!mapboxToken) return; // wait for token

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: zoom
    });

    mapRef.current = map;

    map.on('move', () => {
      const center = map.getCenter();
      setLng(parseFloat(center.lng.toFixed(4)));
      setLat(parseFloat(center.lat.toFixed(4)));
      setZoom(parseFloat(map.getZoom().toFixed(2)));
    });

    map.on('load', () => {
      // Load initial places
      handleSearch();
    });

    // Clean up on unmount
    return () => {
      map.remove();
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing landmark markers and popups
    const existingMarkers = document.querySelectorAll('.landmark-marker');
    existingMarkers.forEach(marker => marker.remove());

    const existingPopups = document.querySelectorAll('.mapboxgl-popup');
    existingPopups.forEach(popup => popup.remove());

    // Add landmarks from props
    if (landmarks && landmarks.length > 0) {
      landmarks.forEach(landmark => {
        // Create a custom marker.
        const markerElement = document.createElement('div');
        markerElement.className = 'landmark-marker';
        markerElement.style.backgroundImage = 'url(/images/map-pin.svg)';
        markerElement.style.backgroundSize = 'cover';
        markerElement.style.width = '30px';
        markerElement.style.height = '30px';
        markerElement.style.cursor = 'pointer';

        // Add marker to map
        new mapboxgl.Marker(markerElement)
          .setLngLat([landmark.lng, landmark.lat])
          .addTo(mapRef.current!);

        // Add click event listener to marker
        markerElement.addEventListener('click', () => {
          handleLandmarkClick(landmark);
        });
      });
    }

    // Add places markers
    if (places && places.length > 0) {
      places.forEach(place => {
        // Create a custom marker.
        const markerElement = document.createElement('div');
        markerElement.className = 'place-marker';
        markerElement.style.backgroundImage = 'url(/images/map-pin.svg)';
        markerElement.style.backgroundSize = 'cover';
        markerElement.style.width = '25px';
        markerElement.style.height = '25px';
        markerElement.style.cursor = 'pointer';

        // Add marker to map
        new mapboxgl.Marker(markerElement)
          .setLngLat([place.geometry.location.lng, place.geometry.location.lat])
          .addTo(mapRef.current!);

        // Add click event listener to marker
        markerElement.addEventListener('click', () => {
          handlePlaceClick(place);
        });
      });
    }
  }, [landmarks, places]);

  const handleSearch = useCallback(async () => {
    if (!mapRef.current) return;

    const center = mapRef.current.getCenter();
    const newLat = center.lat;
    const newLng = center.lng;

    setLoading(true);
    setError(null);

    try {
      // This is a placeholder - you would implement actual places search here
      console.log('Searching for places near:', { lat: newLat, lng: newLng, radius, keyword, type });
      setPlaces([]);
    } catch (err) {
      setError('Failed to search places');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [radius, keyword, type, minRating, maxResults]);

  const displayPhotosInPopup = useCallback((photos: PhotoData[], landmark: any) => {
    if (!photos || photos.length === 0) {
      console.log('No photos available for landmark:', landmark.name);
      return;
    }

    // Create popup content with React component
    const popupContent = document.createElement('div');
    const popupWrapper = document.createElement('div');
    popupWrapper.className = 'photo-carousel-popup';
    popupWrapper.style.cssText = `
      width: 400px;
      max-width: 90vw;
      height: 300px;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
      position: relative;
    `;

    // Add landmark info header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'popup-header';
    headerDiv.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
      color: white;
      padding: 12px;
      z-index: 10;
      font-size: 14px;
      font-weight: 600;
    `;
    headerDiv.textContent = landmark.name;

    // Add photo carousel container
    const carouselDiv = document.createElement('div');
    carouselDiv.id = `photo-carousel-${landmark.id}`;
    carouselDiv.className = 'photo-carousel-container';
    carouselDiv.style.cssText = `
      width: 100%;
      height: 100%;
      position: relative;
    `;

    popupWrapper.appendChild(headerDiv);
    popupWrapper.appendChild(carouselDiv);
    popupContent.appendChild(popupWrapper);

    // Create popup
    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: '420px',
      className: 'photo-popup'
    })
      .setLngLat([landmark.lng, landmark.lat])
      .setDOMContent(popupContent)
      .addTo(mapRef.current!);

    // Handle popup close
    popup.on('close', () => {
      carouselState.hideCarousel();
    });

    // Render React component into the carousel div
    import('react-dom/client').then(({ createRoot }) => {
      const carouselContainer = document.getElementById(`photo-carousel-${landmark.id}`);
      if (carouselContainer) {
        const root = createRoot(carouselContainer);
        root.render(
          React.createElement(PhotoCarousel, {
            photos: photos,
            initialIndex: 0,
            showThumbnails: photos.length > 1,
            allowZoom: true,
            className: 'w-full h-full'
          })
        );
      }
    });

  }, [carouselState]);

  const handleLandmarkClick = useCallback(async (landmark: Landmark) => {
    if (!landmark.id) {
      console.warn('No place_id available for landmark:', landmark.name);
      return;
    }

    try {
      console.log(`🖼️ Fetching photos for landmark: ${landmark.name}`);
      
      const photosResponse = await fetchPhotos(
        landmark.id,
        800,
        'medium'
      );

      if (photosResponse?.photos && photosResponse.photos.length > 0) {
        console.log(`✅ Found ${photosResponse.photos.length} photos for ${landmark.name}`);
        displayPhotosInPopup(photosResponse.photos, landmark);
      } else {
        console.log(`ℹ️ No photos found for ${landmark.name}`);
        
        // Create simple popup without photos
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          maxWidth: '300px'
        })
          .setLngLat([landmark.lng, landmark.lat])
          .setHTML(`
            <div style="padding: 16px; text-align: center;">
              <h3 style="margin: 0 0 8px 0; font-weight: 600;">${landmark.name}</h3>
              <p style="margin: 0; color: #666; font-size: 14px;">No photos available</p>
            </div>
          `)
          .addTo(mapRef.current!);
      }
    } catch (error) {
      console.error('❌ Error fetching photos:', error);
      
      // Show error popup
      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '300px'
      })
        .setLngLat([landmark.lng, landmark.lat])
        .setHTML(`
          <div style="padding: 16px; text-align: center;">
            <h3 style="margin: 0 0 8px 0; font-weight: 600;">${landmark.name}</h3>
            <p style="margin: 0; color: #e74c3c; font-size: 14px;">Error loading photos</p>
          </div>
        `)
        .addTo(mapRef.current!);
    }
  }, [fetchPhotos, displayPhotosInPopup]);

  const handlePlaceClick = useCallback(async (place: any) => {
    if (!place.place_id) {
      console.warn('No place_id available for place:', place.name);
      return;
    }

    try {
      console.log(`🖼️ Fetching photos for place: ${place.name}`);
      
      const photosResponse = await fetchPhotos(
        place.place_id,
        800,
        'medium'
      );

      if (photosResponse?.photos && photosResponse.photos.length > 0) {
        console.log(`✅ Found ${photosResponse.photos.length} photos for ${place.name}`);
        displayPhotosInPopup(photosResponse.photos, place);
      } else {
        console.log(`ℹ️ No photos found for ${place.name}`);
        
        // Create simple popup without photos
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          maxWidth: '300px'
        })
          .setLngLat([place.geometry.location.lng, place.geometry.location.lat])
          .setHTML(`
            <div style="padding: 16px; text-align: center;">
              <h3 style="margin: 0 0 8px 0; font-weight: 600;">${place.name}</h3>
              <p style="margin: 0; color: #666; font-size: 14px;">No photos available</p>
            </div>
          `)
          .addTo(mapRef.current!);
      }
    } catch (error) {
      console.error('❌ Error fetching photos:', error);
      
      // Show error popup
      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '300px'
      })
        .setLngLat([place.geometry.location.lng, place.geometry.location.lat])
        .setHTML(`
          <div style="padding: 16px; text-align: center;">
            <h3 style="margin: 0 0 8px 0; font-weight: 600;">${place.name}</h3>
            <p style="margin: 0; color: #e74c3c; font-size: 14px;">Error loading photos</p>
          </div>
        `)
        .addTo(mapRef.current!);
    }
  }, [fetchPhotos, displayPhotosInPopup]);

  return (
    <div className="flex h-screen">
      {/* Map */}
      <div className="w-3/4">
        <div ref={mapContainerRef} className="map-container h-full" />
      </div>

      {/* Sidebar */}
      <div className="w-1/4 p-4 bg-gray-100 border-l">
        <Card>
          <CardHeader>
            <CardTitle>Search Places</CardTitle>
            <CardDescription>Find interesting places near you.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="keyword">Keyword</Label>
              <Input
                id="keyword"
                placeholder="e.g. restaurant, museum"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <Select onValueChange={setType}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="museum">Museum</SelectItem>
                  <SelectItem value="park">Park</SelectItem>
                  <SelectItem value="store">Store</SelectItem>
                  <SelectItem value="cafe">Cafe</SelectItem>
                  <SelectItem value="lodging">Lodging</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="radius">Radius (meters)</Label>
              <Slider
                id="radius"
                defaultValue={[radius]}
                max={5000}
                step={100}
                onValueChange={(value) => setRadius(value[0])}
              />
              <p className="text-sm text-muted-foreground">
                Current radius: {radius} meters
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="minRating">Minimum Rating</Label>
              <Select onValueChange={(value) => setMinRating(parseFloat(value))}>
                <SelectTrigger id="minRating">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any</SelectItem>
                  <SelectItem value="3">3 stars</SelectItem>
                  <SelectItem value="4">4 stars</SelectItem>
                  <SelectItem value="4.5">4.5 stars</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxResults">Max Results</Label>
              <Input
                id="maxResults"
                type="number"
                value={maxResults}
                onChange={(e) => setMaxResults(parseInt(e.target.value))}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            {loading ? (
              <Button variant="secondary" disabled>
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Searching...
              </Button>
            ) : (
              <Button onClick={handleSearch}>
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            )}
            {error && <p className="text-red-500">{error}</p>}
          </CardFooter>
        </Card>

        {/* Landmark List */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Landmarks</h2>
          <ScrollArea className="h-[300px] w-full rounded-md border">
            <div className="p-4">
              {landmarks && landmarks.length > 0 ? (
                <ul className="list-none p-0">
                  {landmarks.map((landmark) => (
                    <li key={landmark.id} className="py-2 border-b last:border-b-0">
                      <button
                        onClick={() => handleLandmarkClick(landmark)}
                        className="flex items-center space-x-3 w-full text-left"
                      >
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span>{landmark.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No landmarks available.</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default Map;
