
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Clock, Phone, Globe, MapPin } from 'lucide-react';

interface GooglePlacesDetails {
  name?: string;
  rating?: number;
  userRatingsTotal?: number;
  phoneNumber?: string;
  address?: string;
  website?: string;
  priceLevel?: number;
  openingHours?: string[];
  isOpenNow?: boolean;
  photos?: string[];
  placeId?: string;
}

interface GooglePlacesDetailsProps {
  details: GooglePlacesDetails;
  className?: string;
}

const GooglePlacesDetails: React.FC<GooglePlacesDetailsProps> = ({ details, className = "" }) => {
  const getPriceLevelText = (level?: number) => {
    if (!level) return null;
    return '💰'.repeat(level);
  };

  const formatOpeningHours = (hours?: string[]) => {
    if (!hours || hours.length === 0) return null;
    return hours.slice(0, 3); // Show first 3 days
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Rating and Status */}
      <div className="flex items-center gap-2 flex-wrap">
        {details.rating && (
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-medium">{details.rating.toFixed(1)}</span>
            {details.userRatingsTotal && (
              <span className="text-sm text-muted-foreground">
                ({details.userRatingsTotal})
              </span>
            )}
          </div>
        )}
        
        {details.isOpenNow !== undefined && (
          <Badge variant={details.isOpenNow ? "default" : "secondary"}>
            <Clock className="h-3 w-3 mr-1" />
            {details.isOpenNow ? "Open Now" : "Closed"}
          </Badge>
        )}
        
        {details.priceLevel && (
          <Badge variant="outline">
            {getPriceLevelText(details.priceLevel)}
          </Badge>
        )}
      </div>

      {/* Contact Information */}
      <div className="space-y-2">
        {details.address && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <span>{details.address}</span>
          </div>
        )}
        
        {details.phoneNumber && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <a 
              href={`tel:${details.phoneNumber}`}
              className="text-primary hover:underline"
            >
              {details.phoneNumber}
            </a>
          </div>
        )}
        
        {details.website && (
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <a 
              href={details.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline truncate"
            >
              Visit Website
            </a>
          </div>
        )}
      </div>

      {/* Opening Hours */}
      {formatOpeningHours(details.openingHours) && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium">Hours</h4>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {formatOpeningHours(details.openingHours)?.map((hour, index) => (
              <div key={index}>{hour}</div>
            ))}
            {details.openingHours && details.openingHours.length > 3 && (
              <div className="text-primary cursor-pointer hover:underline">
                +{details.openingHours.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photos Preview */}
      {details.photos && details.photos.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Photos</h4>
          <div className="flex gap-2 overflow-x-auto">
            {details.photos.slice(0, 3).map((photo, index) => (
              <img
                key={index}
                src={photo}
                alt={`${details.name} photo ${index + 1}`}
                className="w-16 h-16 object-cover rounded-md flex-shrink-0"
              />
            ))}
            {details.photos.length > 3 && (
              <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">
                +{details.photos.length - 3}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GooglePlacesDetails;
