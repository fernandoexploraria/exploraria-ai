
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Image as ImageIcon, ExternalLink } from 'lucide-react';
import EnhancedProgressiveImage from './EnhancedProgressiveImage';
import { useEnhancedPhotos, PhotoData } from '@/hooks/useEnhancedPhotos';

interface InteractionCardImageProps {
  imageUrl?: string;
  destination: string;
  userInput: string;
  interaction?: any;
  placeId?: string;
  placeName?: string;
  fallbackImageUrl?: string;
  className?: string;
  onViewMorePhotos?: () => void;
}

const InteractionCardImage: React.FC<InteractionCardImageProps> = ({
  imageUrl,
  destination,
  userInput,
  interaction,
  placeId,
  placeName,
  fallbackImageUrl,
  className = '',
  onViewMorePhotos
}) => {
  const { fetchPhotos, getBestPhoto, getOptimalPhotoUrl } = useEnhancedPhotos();
  const [bestPhoto, setBestPhoto] = useState<PhotoData | null>(null);
  const [totalPhotos, setTotalPhotos] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const displayName = placeName || destination;
  const displayImageUrl = imageUrl || fallbackImageUrl;

  useEffect(() => {
    if (!placeId) return;

    const fetchBestPhoto = async () => {
      setIsLoading(true);
      try {
        const photosResponse = await fetchPhotos(placeId, 600, 'medium');
        
        if (photosResponse?.photos && photosResponse.photos.length > 0) {
          const selected = getBestPhoto(photosResponse.photos);
          setBestPhoto(selected);
          setTotalPhotos(photosResponse.photos.length);
        }
      } catch (error) {
        console.error('Error fetching photos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBestPhoto();
  }, [placeId, fetchPhotos, getBestPhoto]);

  const finalImageUrl = bestPhoto ? getOptimalPhotoUrl(bestPhoto, 'medium') : displayImageUrl;
  const qualityScore = bestPhoto?.qualityScore || 0;

  if (!finalImageUrl && !isLoading) {
    return null;
  }

  return (
    <Card className={`relative overflow-hidden ${className}`}>
      {isLoading ? (
        <div className="w-full h-48 bg-gray-100 animate-pulse flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-gray-400" />
        </div>
      ) : finalImageUrl ? (
        <>
          {bestPhoto ? (
            <EnhancedProgressiveImage
              photo={bestPhoto}
              alt={displayName}
              className="w-full h-48 object-cover"
            />
          ) : (
            <img
              src={finalImageUrl}
              alt={displayName}
              className="w-full h-48 object-cover"
            />
          )}
          
          {/* Quality and count indicators */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {bestPhoto && (
              <Badge variant="secondary" className="bg-black/60 text-white text-xs">
                <Star className="h-3 w-3 mr-1 text-yellow-400" fill="currentColor" />
                Quality: {Math.round(qualityScore)}
              </Badge>
            )}
            
            {totalPhotos > 1 && (
              <Badge variant="secondary" className="bg-black/60 text-white text-xs">
                <ImageIcon className="h-3 w-3 mr-1" />
                +{totalPhotos - 1} more
              </Badge>
            )}
          </div>

          {/* Attribution */}
          {bestPhoto?.attributions && bestPhoto.attributions.length > 0 && (
            <div className="absolute bottom-2 left-2">
              <Badge variant="secondary" className="bg-black/60 text-white text-xs">
                © {bestPhoto.attributions[0].displayName}
              </Badge>
            </div>
          )}

          {/* View More Photos Button */}
          {totalPhotos > 1 && onViewMorePhotos && (
            <div className="absolute bottom-2 right-2">
              <Button
                size="sm"
                variant="secondary"
                className="bg-black/60 hover:bg-black/80 text-white text-xs h-6"
                onClick={onViewMorePhotos}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View All
              </Button>
            </div>
          )}
        </>
      ) : null}
    </Card>
  );
};

export default InteractionCardImage;
