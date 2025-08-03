import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, MapPin, Star, Clock, Phone, Globe, Camera, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PhotoData } from '@/hooks/useEnhancedPhotos';
import { Landmark, EnhancedLandmark } from '@/data/landmarks';

interface FullscreenPhotoViewerProps {
  isOpen: boolean;
  onClose: () => void;
  photos: PhotoData[];
  currentIndex: number;
  landmark: Landmark | EnhancedLandmark | any; // any to handle database landmarks
  onIndexChange: (index: number) => void;
}

export const FullscreenPhotoViewer: React.FC<FullscreenPhotoViewerProps> = ({
  isOpen,
  onClose,
  photos,
  currentIndex,
  landmark,
  onIndexChange
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  
  const currentPhoto = photos[currentIndex];
  
  // Detect landmark type and available data
  const isGeneratedLandmark = landmark?.raw_data || landmark?.place_id || landmark?.formatted_address;
  const isTop100Landmark = !isGeneratedLandmark && landmark?.types;
  
  // Extract data based on landmark type
  const getLandmarkData = () => {
    if (isGeneratedLandmark) {
      // Generated landmark - rich data from database
      const rawData = landmark.raw_data || {};
      return {
        type: 'generated',
        name: landmark.name,
        rating: landmark.rating || rawData.rating,
        userRatingsTotal: landmark.user_ratings_total || rawData.user_ratings_total,
        address: landmark.formatted_address || rawData.formatted_address,
        website: landmark.website_uri || rawData.website,
        phone: rawData.formatted_phone_number,
        openingHours: landmark.opening_hours || rawData.opening_hours,
        priceLevel: landmark.price_level || rawData.price_level,
        types: landmark.types || rawData.types || [],
        editorialSummary: landmark.editorial_summary || rawData.editorial_summary?.text,
        reviews: rawData.reviews?.slice(0, 3) || [], // First 3 reviews
        photos: landmark.photos || rawData.photos || []
      };
    } else if (isTop100Landmark) {
      // Top100 landmark - limited persisted data
      return {
        type: 'top100',
        name: landmark.name,
        description: landmark.description,
        rating: landmark.rating,
        address: landmark.formattedAddress,
        types: landmark.types || [],
        coordinates: landmark.coordinates
      };
    }
    
    return { type: 'unknown', name: landmark?.name || 'Unknown' };
  };
  
  const landmarkData = getLandmarkData();
  
  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    } else if (direction === 'next' && currentIndex < photos.length - 1) {
      onIndexChange(currentIndex + 1);
    }
    setImageLoading(true);
  };
  
  const formatPriceLevel = (level: number) => {
    return '€'.repeat(level);
  };
  
  const getStatusBadge = () => {
    if (landmarkData.type === 'generated') {
      return <Badge variant="secondary" className="text-xs">Smart Tour</Badge>;
    } else if (landmarkData.type === 'top100') {
      return <Badge variant="outline" className="text-xs">Top Landmark</Badge>;
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-none w-full h-full p-0 bg-black">
        <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-white text-lg font-semibold truncate max-w-md">
                  {landmarkData.name}
                </h2>
                {getStatusBadge()}
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <Share2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Main photo area */}
          <div className="flex-1 relative flex items-center justify-center bg-black">
            {currentPhoto && (
              <>
                <img
                  src={currentPhoto.urls?.large || currentPhoto.urls?.medium || currentPhoto.urls?.thumb}
                  alt={`${landmarkData.name} - Photo ${currentIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                />
                
                {/* Photo navigation */}
                {photos.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigatePhoto('prev')}
                      disabled={currentIndex === 0}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigatePhoto('next')}
                      disabled={currentIndex === photos.length - 1}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 disabled:opacity-30"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </Button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Bottom info panel */}
          <div className="bg-background border-t p-4 max-h-80 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-4">
              
              {/* Basic info row */}
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">{landmarkData.name}</h3>
                  
                  {landmarkData.rating && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{landmarkData.rating}</span>
                      </div>
                      {landmarkData.userRatingsTotal && (
                        <span className="text-muted-foreground text-sm">
                          ({landmarkData.userRatingsTotal.toLocaleString()} reviews)
                        </span>
                      )}
                      {landmarkData.priceLevel && (
                        <span className="text-sm font-medium">
                          {formatPriceLevel(landmarkData.priceLevel)}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {landmarkData.address && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm">{landmarkData.address}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Camera className="w-4 h-4" />
                    <span className="text-sm">{currentIndex + 1} of {photos.length}</span>
                  </div>
                  {currentPhoto?.attributions && currentPhoto.attributions.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Photo by {currentPhoto.attributions[0].displayName}
                    </span>
                  )}
                </div>
              </div>

              {/* Type-specific content */}
              {landmarkData.type === 'generated' && (
                <div className="space-y-4">
                  {/* Contact info */}
                  {(landmarkData.website || landmarkData.phone) && (
                    <div className="flex gap-4">
                      {landmarkData.website && (
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-muted-foreground" />
                          <a 
                            href={landmarkData.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm"
                          >
                            Website
                          </a>
                        </div>
                      )}
                      {landmarkData.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <a href={`tel:${landmarkData.phone}`} className="text-primary hover:underline text-sm">
                            {landmarkData.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Opening hours */}
                  {landmarkData.openingHours?.weekday_text && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Hours</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm text-muted-foreground">
                        {landmarkData.openingHours.weekday_text.slice(0, 4).map((hours: string, index: number) => (
                          <div key={index}>{hours}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Editorial summary */}
                  {landmarkData.editorialSummary && (
                    <div className="space-y-2">
                      <h4 className="font-medium">About</h4>
                      <p className="text-sm text-muted-foreground">{landmarkData.editorialSummary}</p>
                    </div>
                  )}

                  {/* Recent reviews preview */}
                  {landmarkData.reviews.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Recent Reviews</h4>
                      <div className="space-y-2">
                        {landmarkData.reviews.map((review: any, index: number) => (
                          <div key={index} className="text-sm border-l-2 border-muted pl-3">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                <span className="font-medium">{review.rating}</span>
                              </div>
                              <span className="text-muted-foreground">by {review.author_name}</span>
                            </div>
                            <p className="text-muted-foreground line-clamp-2">{review.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {landmarkData.type === 'top100' && (
                <div className="space-y-4">
                  {landmarkData.description && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Description</h4>
                      <p className="text-sm text-muted-foreground">{landmarkData.description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Categories */}
              {landmarkData.types && landmarkData.types.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Categories</h4>
                  <div className="flex flex-wrap gap-2">
                    {landmarkData.types.slice(0, 5).map((type: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FullscreenPhotoViewer;