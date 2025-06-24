
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Star, Clock, Navigation, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SearchResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  types: string[];
  openNow?: boolean;
  photoUrl?: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface ProximitySearchProps {
  coordinates: [number, number];
  radius?: number;
  onClose: () => void;
  onSelectPlace: (place: SearchResult) => void;
}

const ProximitySearch: React.FC<ProximitySearchProps> = ({
  coordinates,
  radius = 1000,
  onClose,
  onSelectPlace
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'nearby'>('nearby');

  React.useEffect(() => {
    if (activeTab === 'nearby') {
      fetchNearbyPlaces();
    }
  }, [activeTab, coordinates]);

  const fetchNearbyPlaces = async () => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places-nearby', {
        body: {
          coordinates,
          radius,
          type: 'restaurant|cafe|tourist_attraction|store'
        }
      });

      if (error) {
        console.error('Error fetching nearby places:', error);
        return;
      }

      if (data?.success && data?.places) {
        setNearbyPlaces(data.places);
      }
    } catch (error) {
      console.error('Error fetching nearby places:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: {
          query: searchQuery,
          coordinates,
          radius
        }
      });

      if (error) {
        console.error('Error searching places:', error);
        return;
      }

      if (data?.success && data?.results) {
        setSearchResults(data.results);
        setActiveTab('search');
      }
    } catch (error) {
      console.error('Error searching places:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const formatDistance = (place: SearchResult): string => {
    const lat1 = coordinates[1];
    const lon1 = coordinates[0];
    const lat2 = place.geometry.location.lat;
    const lon2 = place.geometry.location.lng;

    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;

    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    }
    return `${(distance / 1000).toFixed(1)}km`;
  };

  const renderPlaceCard = (place: SearchResult) => (
    <Card key={place.placeId} className="mb-2 cursor-pointer hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="flex gap-3">
          {place.photoUrl && (
            <img
              src={place.photoUrl}
              alt={place.name}
              className="w-16 h-16 object-cover rounded-md flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{place.name}</h4>
            <p className="text-xs text-muted-foreground truncate mb-1">
              {place.formattedAddress || place.vicinity}
            </p>
            
            <div className="flex items-center gap-2 mb-2">
              {place.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs">{place.rating.toFixed(1)}</span>
                </div>
              )}
              {place.openNow !== undefined && (
                <Badge variant={place.openNow ? "default" : "destructive"} className="text-xs h-5">
                  <Clock className="h-2 w-2 mr-1" />
                  {place.openNow ? 'Open' : 'Closed'}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs h-5">
                <MapPin className="h-2 w-2 mr-1" />
                {formatDistance(place)}
              </Badge>
            </div>

            <Button
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => onSelectPlace(place)}
            >
              <Navigation className="h-3 w-3 mr-1" />
              Get Directions
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const currentResults = activeTab === 'search' ? searchResults : nearbyPlaces;

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto bg-background/95 backdrop-blur-sm shadow-xl border-2 max-h-[70vh] flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Search Near Here</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search Input */}
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Search for restaurants, cafes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button
            onClick={handleSearch}
            disabled={!searchQuery.trim() || isSearching}
            size="sm"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-2">
          <Button
            variant={activeTab === 'nearby' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('nearby')}
            className="flex-1"
          >
            Nearby ({nearbyPlaces.length})
          </Button>
          {searchResults.length > 0 && (
            <Button
              variant={activeTab === 'search' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('search')}
              className="flex-1"
            >
              Search ({searchResults.length})
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-1 overflow-y-auto">
        {isSearching ? (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 animate-pulse" />
            Searching...
          </div>
        ) : currentResults.length > 0 ? (
          currentResults.map(renderPlaceCard)
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2" />
            {activeTab === 'nearby' ? 'No nearby places found' : 'No search results'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProximitySearch;
