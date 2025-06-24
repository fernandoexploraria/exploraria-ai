
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, Phone, Globe, Clock, Navigation, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Landmark } from '@/data/landmarks';
import { supabase } from '@/integrations/supabase/client';

interface GooglePlaceDetails {
  name: string;
  rating?: number;
  userRatingsTotal?: number;
  phoneNumber?: string;
  address?: string;
  website?: string;
  priceLevel?: number;
  openingHours?: string[];
  isOpenNow?: boolean;
  photos?: string[];
}

interface ProximityFloatingCardProps {
  landmark: Landmark;
  distance: number;
  onClose: () => void;
  onGetDirections: () => void;
  onShowNearby: () => void;
  userLocation: [number, number] | null;
}

const ProximityFloatingCard: React.FC<ProximityFloatingCardProps> = ({
  landmark,
  distance,
  onClose,
  onGetDirections,
  onShowNearby,
  userLocation
}) => {
  const [placeDetails, setPlaceDetails] = useState<GooglePlaceDetails | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchPlaceDetails();
  }, [landmark]);

  const fetchPlaceDetails = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places-details', {
        body: {
          landmarkName: landmark.name,
          coordinates: landmark.coordinates
        }
      });

      if (error) {
        console.error('Error fetching place details:', error);
        return;
      }

      if (data?.success && data?.data) {
        setPlaceDetails(data.data);
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const renderRating = (rating?: number, total?: number) => {
    if (!rating) return null;
    
    return (
      <div className="flex items-center gap-1">
        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        <span className="text-sm font-medium">{rating.toFixed(1)}</span>
        {total && (
          <span className="text-xs text-muted-foreground">({total})</span>
        )}
      </div>
    );
  };

  const renderPriceLevel = (level?: number) => {
    if (!level) return null;
    
    return (
      <div className="text-sm text-muted-foreground">
        {'$'.repeat(level)}
      </div>
    );
  };

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto bg-background/95 backdrop-blur-sm shadow-xl border-2 animate-slide-up">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-bold text-foreground">
              {placeDetails?.name || landmark.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                <MapPin className="h-3 w-3 mr-1" />
                {formatDistance(distance)}
              </Badge>
              {placeDetails?.isOpenNow !== undefined && (
                <Badge variant={placeDetails.isOpenNow ? "default" : "destructive"} className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {placeDetails.isOpenNow ? 'Open' : 'Closed'}
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Rating and Price */}
        {(placeDetails?.rating || placeDetails?.priceLevel) && (
          <div className="flex items-center justify-between mb-3">
            {renderRating(placeDetails?.rating, placeDetails?.userRatingsTotal)}
            {renderPriceLevel(placeDetails?.priceLevel)}
          </div>
        )}

        {/* Photos */}
        {placeDetails?.photos && placeDetails.photos.length > 0 && (
          <div className="mb-3">
            <img
              src={placeDetails.photos[0]}
              alt={landmark.name}
              className="w-full h-24 object-cover rounded-md"
            />
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {landmark.description}
        </p>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-3">
          <Button
            onClick={onGetDirections}
            size="sm"
            className="flex-1"
          >
            <Navigation className="h-4 w-4 mr-1" />
            Directions
          </Button>
          <Button
            onClick={onShowNearby}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <MapPin className="h-4 w-4 mr-1" />
            Nearby
          </Button>
        </div>

        {/* Expandable Details */}
        {placeDetails && (placeDetails.address || placeDetails.phoneNumber || placeDetails.website) && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full justify-between p-2 h-8"
            >
              <span className="text-xs">More Details</span>
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>

            {isExpanded && (
              <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                {placeDetails.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{placeDetails.address}</span>
                  </div>
                )}
                {placeDetails.phoneNumber && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 flex-shrink-0" />
                    <span>{placeDetails.phoneNumber}</span>
                  </div>
                )}
                {placeDetails.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-3 w-3 flex-shrink-0" />
                    <a
                      href={placeDetails.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {isLoading && (
          <div className="text-center text-xs text-muted-foreground">
            Loading details...
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProximityFloatingCard;
