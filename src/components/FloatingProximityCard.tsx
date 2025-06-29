import React, { useState, useEffect } from 'react';
import { X, MapPin, Star, Navigation, Search, Clock, Utensils, Coffee, Car, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Landmark } from '@/data/landmarks';
import { toast } from 'sonner';

interface NearbyService {
  place_id: string;
  name: string;
  vicinity: string;
  rating?: number;
  user_ratings_total?: number;
  types: string[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  opening_hours?: {
    open_now: boolean;
  };
  price_level?: number;
}

interface AutocompleteSuggestion {
  place_id: string;
  description: string;
  types: string[];
  icon: string;
  label: string;
}

interface FloatingProximityCardProps {
  landmark: Landmark;
  userLocation: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onGetDirections: (service: NearbyService) => void;
}

// Tourist service types for nearby search - UPDATED to use only 5 types as per Google API limit
const TOURIST_SERVICE_TYPES = [
  'restaurant',
  'cafe', 
  'shopping_mall',
  'subway_station',
  'public_bathroom'
];

// Service type icons - UPDATED to handle new service types
const getServiceIcon = (types: string[]) => {
  if (types.includes('restaurant') || types.includes('food')) return <Utensils className="w-4 h-4" />;
  if (types.includes('cafe')) return <Coffee className="w-4 h-4" />;
  if (types.includes('shopping_mall')) return <Car className="w-4 h-4" />; // Using Car as placeholder for shopping
  if (types.includes('subway_station')) return <Navigation className="w-4 h-4" />;
  if (types.includes('public_bathroom')) return <Plus className="w-4 h-4" />; // Using Plus as placeholder for facilities
  return <MapPin className="w-4 h-4" />;
};

const FloatingProximityCard: React.FC<FloatingProximityCardProps> = ({
  landmark,
  userLocation,
  onClose,
  onGetDirections
}) => {
  const [nearbyServices, setNearbyServices] = useState<NearbyService[]>([]);
  const [selectedService, setSelectedService] = useState<NearbyService | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load nearby services when component mounts
  useEffect(() => {
    loadNearbyServices();
  }, [landmark]);

  // Handle search input changes with autocomplete
  useEffect(() => {
    if (searchQuery.length >= 2) {
      handleSearchInput();
    } else {
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery]);

  const loadNearbyServices = async () => {
    try {
      setIsLoadingNearby(true);
      
      // FIXED: Send coordinates in the format expected by the edge function
      const { data, error } = await supabase.functions.invoke('google-places-nearby', {
        body: {
          coordinates: landmark.coordinates, // [lng, lat] format
          radius: 100, // 100 meters around landmark
          types: TOURIST_SERVICE_TYPES
        }
      });

      if (error) throw error;

      if (data?.results) {
        // Sort by rating and distance
        const sortedServices = data.results
          .filter((service: NearbyService) => service.name && service.vicinity)
          .sort((a: NearbyService, b: NearbyService) => {
            // Prioritize by rating first, then by user ratings count
            const aRating = a.rating || 0;
            const bRating = b.rating || 0;
            if (aRating !== bRating) return bRating - aRating;
            
            const aReviews = a.user_ratings_total || 0;
            const bReviews = b.user_ratings_total || 0;
            return bReviews - aReviews;
          })
          .slice(0, 10); // Limit to top 10 services

        setNearbyServices(sortedServices);
        console.log(`🏪 Loaded ${sortedServices.length} nearby services for ${landmark.name}`);
      }
    } catch (error) {
      console.error('Failed to load nearby services:', error);
      toast.error('Failed to load nearby services');
    } finally {
      setIsLoadingNearby(false);
    }
  };

  const handleSearchInput = async () => {
    try {
      setIsSearching(true);

      const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
        body: {
          input: searchQuery,
          types: TOURIST_SERVICE_TYPES,
          sessionToken: `proximity-search-${Date.now()}`,
          locationBias: {
            circle: {
              center: {
                latitude: landmark.coordinates[1],
                longitude: landmark.coordinates[0]
              },
              radius: 1000 // 1km radius from landmark
            }
          }
        }
      });

      if (error) throw error;

      if (data?.suggestions) {
        const formattedSuggestions: AutocompleteSuggestion[] = data.suggestions.map((suggestion: any) => ({
          place_id: suggestion.placePrediction.placeId,
          description: suggestion.placePrediction.text.text,
          types: suggestion.placePrediction.types || [],
          icon: suggestion.icon || 'mapPin',
          label: suggestion.label || 'Place'
        }));

        setSearchSuggestions(formattedSuggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Search autocomplete error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuggestionSelect = async (suggestion: AutocompleteSuggestion) => {
    try {
      // Get place details for the selected suggestion
      const { data, error } = await supabase.functions.invoke('google-places-details', {
        body: {
          place_id: suggestion.place_id,
          fields: ['name', 'vicinity', 'rating', 'user_ratings_total', 'types', 'geometry', 'photos', 'opening_hours', 'price_level']
        }
      });

      if (error) throw error;

      if (data?.result) {
        setSelectedService(data.result);
        setSearchQuery(suggestion.description);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Failed to get place details:', error);
      toast.error('Failed to get place details');
    }
  };

  const calculateDistance = (service: NearbyService): string => {
    if (!userLocation) return 'Unknown';
    
    const R = 6371e3; // Earth's radius in meters
    const φ1 = userLocation.latitude * Math.PI/180;
    const φ2 = service.geometry.location.lat * Math.PI/180;
    const Δφ = (service.geometry.location.lat - userLocation.latitude) * Math.PI/180;
    const Δλ = (service.geometry.location.lng - userLocation.longitude) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return distance < 1000 ? `${Math.round(distance)}m` : `${(distance/1000).toFixed(1)}km`;
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />);
    }
    
    if (hasHalfStar) {
      stars.push(<Star key="half" className="w-3 h-3 fill-yellow-400/50 text-yellow-400" />);
    }

    const remainingStars = 5 - Math.ceil(rating);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="w-3 h-3 text-gray-300" />);
    }

    return stars;
  };

  if (selectedService) {
    // Detailed service view
    return (
      <Card className="fixed bottom-4 right-4 w-80 max-h-96 bg-white/95 backdrop-blur-sm shadow-xl border z-50 overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-sm font-semibold line-clamp-2">{selectedService.name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{selectedService.vicinity}</p>
            </div>
            <div className="flex gap-1 ml-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedService(null)} className="p-1 h-6 w-6">
                ←
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="p-1 h-6 w-6">
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-3">
          {selectedService.rating && (
            <div className="flex items-center gap-2">
              <div className="flex">
                {renderStars(selectedService.rating)}
              </div>
              <span className="text-xs font-medium">{selectedService.rating.toFixed(1)}</span>
              {selectedService.user_ratings_total && (
                <span className="text-xs text-muted-foreground">({selectedService.user_ratings_total})</span>
              )}
            </div>
          )}

          {selectedService.opening_hours && (
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span className={`text-xs font-medium ${selectedService.opening_hours.open_now ? 'text-green-600' : 'text-red-600'}`}>
                {selectedService.opening_hours.open_now ? 'Open now' : 'Closed'}
              </span>
            </div>
          )}

          {selectedService.price_level && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Price:</span>
              <span className="text-xs">{'$'.repeat(selectedService.price_level)}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3" />
            <span className="text-xs text-muted-foreground">
              {userLocation ? calculateDistance(selectedService) : 'Distance unknown'}
            </span>
          </div>

          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={() => onGetDirections(selectedService)}
              className="flex-1 h-8 text-xs"
            >
              <Navigation className="w-3 h-3 mr-1" />
              Directions
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Main services list view
  return (
    <Card className="fixed bottom-4 right-4 w-80 max-h-96 bg-white/95 backdrop-blur-sm shadow-xl border z-50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Services near {landmark.name}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-1 h-6 w-6">
            <X className="w-3 h-3" />
          </Button>
        </div>
        
        {/* Search input with autocomplete */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              placeholder="Search nearby services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-7 text-xs"
              onFocus={() => searchSuggestions.length > 0 && setShowSuggestions(true)}
            />
          </div>
          
          {/* Autocomplete suggestions */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-32 overflow-y-auto">
              {searchSuggestions.map((suggestion) => (
                <button
                  key={suggestion.place_id}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 border-b last:border-b-0"
                  onClick={() => handleSuggestionSelect(suggestion)}
                >
                  <div className="flex items-center gap-2">
                    {getServiceIcon(suggestion.types)}
                    <span className="truncate">{suggestion.description}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {isLoadingNearby ? (
            <div className="text-center text-xs text-muted-foreground py-4">
              Loading nearby services...
            </div>
          ) : nearbyServices.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-4">
              No services found nearby
            </div>
          ) : (
            nearbyServices.map((service) => (
              <div
                key={service.place_id}
                className="p-2 border rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedService(service)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    {getServiceIcon(service.types)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{service.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{service.vicinity}</p>
                    
                    <div className="flex items-center gap-2 mt-1">
                      {service.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-2 h-2 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs">{service.rating.toFixed(1)}</span>
                        </div>
                      )}
                      {userLocation && (
                        <span className="text-xs text-muted-foreground">
                          {calculateDistance(service)}
                        </span>
                      )}
                      {service.opening_hours && (
                        <Badge variant={service.opening_hours.open_now ? "default" : "secondary"} className="text-xs px-1 py-0">
                          {service.opening_hours.open_now ? "Open" : "Closed"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FloatingProximityCard;
