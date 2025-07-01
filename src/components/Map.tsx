
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MapPin, Star, Clock, Globe, DollarSign, Phone, Navigation, Image as ImageIcon, Info } from 'lucide-react';
import { Landmark, EnhancedLandmark } from '@/data/landmarks';
import { toast } from 'sonner';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { useEnhancedStreetView } from '@/hooks/useEnhancedStreetView';
import { supabase } from '@/integrations/supabase/client';
import EnhancedStreetViewModal from './EnhancedStreetViewModal';
import StreetViewThumbnail from './StreetViewThumbnail';
import EnhancedProgressiveImage from './EnhancedProgressiveImage';
import PhotoCarousel from './photo-carousel/PhotoCarousel';
import { useLandmarkPhotos } from '@/hooks/useLandmarkPhotos';
import { PhotoData } from '@/hooks/useEnhancedPhotos';

interface MapProps {
  mapboxToken?: string; // Add mapboxToken as optional prop
  landmarks: Landmark[];
  userLocation: [number, number] | null;
  selectedLandmark: Landmark | null;
  onLandmarkSelect?: (landmark: Landmark | null) => void;
  showUserLocation?: boolean;
  className?: string;
  showControls?: boolean;
  showInfoPanel?: boolean;
  mapStyle?: string;
  zoom?: number;
  onLocationUpdate?: (location: [number, number]) => void;
  proximityLandmarks?: Landmark[];
  smartTourLandmarks?: Landmark[];
  plannedLandmarks?: Landmark[]; // Add this for compatibility
}

interface ProximityInfo {
  landmark: Landmark;
  distance: number;
}

// Function to calculate distance between two coordinates
const calculateDistance = (coord1: [number, number], coord2: [number, number]): number => {
  const R = 6371; // Radius of the Earth in kilometers
  const lat1 = coord1[1] * Math.PI / 180;
  const lon1 = coord1[0] * Math.PI / 180;
  const lat2 = coord2[1] * Math.PI / 180;
  const lon2 = coord2[0] * Math.PI / 180;

  const dlon = lon2 - lon1;
  const dlat = lat2 - lat1;

  const a = Math.sin(dlat / 2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distance in kilometers
  return distance;
};

const Map: React.FC<MapProps> = ({ 
  mapboxToken: propMapboxToken,
  landmarks, 
  userLocation, 
  selectedLandmark, 
  onLandmarkSelect,
  showUserLocation = true,
  className = '',
  showControls = true,
  showInfoPanel = true,
  mapStyle = "mapbox://styles/mapbox/streets-v12",
  zoom = 13,
  onLocationUpdate,
  proximityLandmarks = [],
  smartTourLandmarks = []
}) => {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [userCoordinates, setUserCoordinates] = useState<[number, number] | null>(userLocation);
  const [isStreetViewOpen, setIsStreetViewOpen] = useState(false);
  const mapContainer = useRef(null);
  const [proximityInfo, setProximityInfo] = useState<ProximityInfo[]>([]);

  // Enhanced photo fetching with database-first approach - Fix Map constructor usage
  const { fetchLandmarkPhotos } = useLandmarkPhotos();
  const [landmarkPhotos, setLandmarkPhotos] = useState(new Map<string, PhotoData[]>());
  const [photoLoadingStates, setPhotoLoadingStates] = useState(new Map<string, boolean>());

  // Use hook if no token provided via props
  const { mapboxToken: hookMapboxToken } = useMapboxToken();
  const mapboxToken = propMapboxToken || hookMapboxToken;

  // Fix hook destructuring
  const streetViewHook = useEnhancedStreetView(
    selectedLandmark?.coordinates || [0, 0]
  );

  // Enhanced photo fetching function with performance logging
  const handleFetchLandmarkPhotos = useCallback(async (landmark: Landmark | EnhancedLandmark) => {
    const landmarkKey = landmark.id || landmark.name;
    
    // Skip if already loading or photos already exist
    if (photoLoadingStates.get(landmarkKey) || landmarkPhotos.has(landmarkKey)) {
      return;
    }

    console.log(`🖼️ Phase 2: Fetching photos for landmark: ${landmark.name}`);
    console.log(`🔍 Landmark type: ${(landmark as any).tourId ? 'tour-generated' : 'regular'}`);
    
    setPhotoLoadingStates(prev => new Map(prev).set(landmarkKey, true));

    try {
      const startTime = Date.now();
      
      // Use the new database-first approach
      const result = await fetchLandmarkPhotos(landmark, {
        maxWidth: 800,
        quality: 'medium',
        preferredSource: 'database'
      });

      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Phase 2 Photo fetching complete for ${landmark.name}:`, {
        photosFound: result.totalPhotos,
        sourceUsed: result.sourceUsed,
        processingTimeMs: processingTime,
        qualityDistribution: result.qualityDistribution
      });

      if (result.photos.length > 0) {
        setLandmarkPhotos(prev => new Map(prev).set(landmarkKey, result.photos));
        
        // Log API call reduction achievement
        if (result.sourceUsed.startsWith('database')) {
          console.log(`🎯 API Call Avoided! Used ${result.sourceUsed} instead of Google Places API`);
        }
      } else {
        console.log(`ℹ️ No photos found for ${landmark.name}`);
      }

    } catch (error) {
      console.error(`❌ Error fetching photos for ${landmark.name}:`, error);
      toast.error(`Failed to load photos for ${landmark.name}`);
    } finally {
      setPhotoLoadingStates(prev => {
        const newMap = new Map(prev);
        newMap.delete(landmarkKey);
        return newMap;
      });
    }
  }, [fetchLandmarkPhotos, photoLoadingStates, landmarkPhotos]);

  useEffect(() => {
    if (!mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    const initializeMap = () => {
      const newMap = new mapboxgl.Map({
        container: mapContainer.current || 'map',
        style: mapStyle,
        center: userCoordinates || [-99.1332, 19.4326],
        zoom: zoom
      });

      newMap.on('load', () => {
        setMap(newMap);

        // Add navigation control (the +/- zoom buttons)
        if (showControls) {
          const navigationControl = new mapboxgl.NavigationControl();
          newMap.addControl(navigationControl, 'top-right');
        }

        // Add geolocate control (the locate me button)
        if (showUserLocation) {
          const geolocateControl = new mapboxgl.GeolocateControl({
            positionOptions: {
              enableHighAccuracy: true
            },
            trackUserLocation: true,
            showUserHeading: true
          });
          newMap.addControl(geolocateControl, 'top-left');

          // Listen for the 'geolocate' event - Fix event handler type
          geolocateControl.on('geolocate', (e: any) => {
            const lon = e.coords.longitude;
            const lat = e.coords.latitude;
            const newCoordinates: [number, number] = [lon, lat];
            setUserCoordinates(newCoordinates);
            onLocationUpdate?.(newCoordinates);
          });
        }
      });

      // Clean up on unmount
      return () => newMap.remove();
    };

    if (!map) {
      initializeMap();
    }

  }, [mapboxToken, mapStyle, showControls, showUserLocation, zoom, onLocationUpdate, map]);

  // Update user coordinates if prop changes
  useEffect(() => {
    if (userLocation) {
      setUserCoordinates(userLocation);
      // Fly to the new location if the map is initialized
      if (map) {
        map.flyTo({
          center: userLocation,
          zoom: zoom,
          duration: 2000 // Animation duration in milliseconds
        });
      }
    }
  }, [userLocation, map, zoom]);

  // Add markers for landmarks
  useEffect(() => {
    if (!map) return;

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.landmark-marker');
    existingMarkers.forEach(marker => marker.remove());

    landmarks.forEach(landmark => {
      const el = document.createElement('div');
      el.className = 'landmark-marker';
      el.style.backgroundImage = `url(/images/map-marker.svg)`;
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.backgroundSize = '100%';
      el.style.cursor = 'pointer';

      el.addEventListener('click', () => {
        onLandmarkSelect?.(landmark);
        // Fly to the landmark
        map.flyTo({
          center: landmark.coordinates,
          zoom: 14,
          essential: true // this animation is considered essential with respect to prefers-reduced-motion
        });
      });

      new mapboxgl.Marker(el)
        .setLngLat(landmark.coordinates)
        .addTo(map);
    });
  }, [landmarks, map, onLandmarkSelect]);

  // Calculate proximity information
  useEffect(() => {
    if (!userCoordinates) return;

    const calculatedProximity = landmarks.map(landmark => {
      const distance = calculateDistance(userCoordinates, landmark.coordinates);
      return { landmark, distance };
    }).sort((a, b) => a.distance - b.distance).slice(0, 5);

    setProximityInfo(calculatedProximity);
  }, [landmarks, userCoordinates]);

  // Auto-fetch photos for selected landmark
  useEffect(() => {
    if (selectedLandmark && showInfoPanel) {
      handleFetchLandmarkPhotos(selectedLandmark);
    }
  }, [selectedLandmark, showInfoPanel, handleFetchLandmarkPhotos]);

  const selectedLandmarkPhotos = useMemo(() => {
    if (!selectedLandmark) return [];
    const landmarkKey = selectedLandmark.id || selectedLandmark.name;
    return landmarkPhotos.get(landmarkKey) || [];
  }, [selectedLandmark, landmarkPhotos]);

  const isLoadingPhotos = useMemo(() => {
    if (!selectedLandmark) return false;
    const landmarkKey = selectedLandmark.id || selectedLandmark.name;
    return photoLoadingStates.get(landmarkKey) || false;
  }, [selectedLandmark, photoLoadingStates]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />
      
      {showInfoPanel && selectedLandmark && (
        <Card className="absolute top-4 left-4 w-80 max-h-[calc(100vh-2rem)] bg-background/95 backdrop-blur-sm shadow-lg border-0 lg:w-96">
          <CardContent className="p-4">
            <ScrollArea className="max-h-[calc(100vh-6rem)]">
              <div className="space-y-4">
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-lg leading-tight pr-2">{selectedLandmark.name}</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onLandmarkSelect?.(null)}
                      className="h-6 w-6 p-0 shrink-0"
                    >
                      ×
                    </Button>
                  </div>
                  
                  {selectedLandmark.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedLandmark.description}
                    </p>
                  )}
                </div>

                {/* Enhanced Photo Section with Database-First Approach */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">Photos</span>
                    {selectedLandmarkPhotos.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedLandmarkPhotos.length}
                      </Badge>
                    )}
                  </div>

                  {isLoadingPhotos ? (
                    <div className="flex items-center justify-center p-8 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading photos...
                      </div>
                    </div>
                  ) : selectedLandmarkPhotos.length > 0 ? (
                    <PhotoCarousel
                      photos={selectedLandmarkPhotos}
                      initialIndex={0}
                      className="h-48 rounded-lg"
                      showThumbnails={selectedLandmarkPhotos.length > 1}
                      allowZoom={true}
                    />
                  ) : (
                    <div className="flex items-center justify-center p-8 bg-muted/50 rounded-lg">
                      <div className="text-center text-sm text-muted-foreground">
                        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No photos available
                      </div>
                    </div>
                  )}
                </div>

                {/* Enhanced Landmark Details */}
                {(selectedLandmark as EnhancedLandmark).rating && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{(selectedLandmark as EnhancedLandmark).rating}</span>
                    {(selectedLandmark as EnhancedLandmark).user_ratings_total && (
                      <span className="text-muted-foreground">
                        ({(selectedLandmark as EnhancedLandmark).user_ratings_total} reviews)
                      </span>
                    )}
                  </div>
                )}

                {/* Additional Details for Enhanced Landmarks */}
                {(selectedLandmark as EnhancedLandmark).price_level !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4" />
                    <span>Price Level: {(selectedLandmark as EnhancedLandmark).price_level}/4</span>
                  </div>
                )}

                {(selectedLandmark as EnhancedLandmark).website_uri && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4" />
                    <a 
                      href={(selectedLandmark as EnhancedLandmark).website_uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      Visit Website
                    </a>
                  </div>
                )}

                {(selectedLandmark as EnhancedLandmark).opening_hours && (
                  <div className="flex items-start gap-2 text-sm">
                    <Clock className="h-4 w-4 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-medium">Hours:</span>
                      <div className="text-muted-foreground mt-1">
                        {(selectedLandmark as EnhancedLandmark).opening_hours.weekday_text?.slice(0, 3).map((hours: string, index: number) => (
                          <div key={index} className="text-xs">{hours}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Street View Section - Fix component props */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-4 w-4" />
                    <span className="text-sm font-medium">Street View</span>
                  </div>
                  
                  <StreetViewThumbnail
                    landmark={selectedLandmark}
                    streetViewData={null}
                    onClick={() => setIsStreetViewOpen(true)}
                    className="h-32"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsStreetViewOpen(true)}
                    className="flex-1"
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Street View
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Street View Modal - Fix component props */}
      <EnhancedStreetViewModal
        isOpen={isStreetViewOpen}
        onClose={() => setIsStreetViewOpen(false)}
        streetViewItems={selectedLandmark ? [{
          landmark: selectedLandmark,
          streetViewData: null
        }] : []}
        landmarkName={selectedLandmark?.name || ''}
      />
    </div>
  );
};

export default Map;
