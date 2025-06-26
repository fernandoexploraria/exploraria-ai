
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from 'lucide-react';
import { PhotoData } from '@/hooks/useEnhancedPhotos';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import EnhancedProgressiveImage from '@/components/EnhancedProgressiveImage';
import PhotoThumbnailGrid from './PhotoThumbnailGrid';
import PhotoQualityIndicator from './PhotoQualityIndicator';
import PhotoAttribution from './PhotoAttribution';
import { cn } from '@/lib/utils';

interface PhotoCarouselProps {
  photos: PhotoData[];
  initialIndex?: number;
  onClose?: () => void;
  showThumbnails?: boolean;
  allowZoom?: boolean;
  className?: string;
}

const PhotoCarousel: React.FC<PhotoCarouselProps> = ({
  photos,
  initialIndex = 0,
  onClose,
  showThumbnails = true,
  allowZoom = true,
  className
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showAttribution, setShowAttribution] = useState(false);
  const { getOptimalImageQuality } = useNetworkStatus();

  const currentPhoto = photos[currentIndex];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
          event.preventDefault();
          goToNext();
          break;
        case 'Escape':
          event.preventDefault();
          onClose?.();
          break;
        case ' ':
          event.preventDefault();
          goToNext();
          break;
        case '+':
        case '=':
          event.preventDefault();
          zoomIn();
          break;
        case '-':
          event.preventDefault();
          zoomOut();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
    setZoomLevel(1); // Reset zoom when changing photos
  }, [photos.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setZoomLevel(1); // Reset zoom when changing photos
  }, [photos.length]);

  const zoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev * 1.5, 4));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev / 1.5, 0.5));
  }, []);

  const handleThumbnailClick = useCallback((index: number) => {
    setCurrentIndex(index);
    setZoomLevel(1);
  }, []);

  if (!currentPhoto) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <p className="text-gray-500">No photos available</p>
      </div>
    );
  }

  return (
    <div className={cn('relative bg-black rounded-lg overflow-hidden', className)}>
      {/* Header with controls */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm">
              {currentIndex + 1} / {photos.length}
            </span>
            <PhotoQualityIndicator photo={currentPhoto} />
          </div>
          
          <div className="flex items-center gap-2">
            {allowZoom && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={zoomOut}
                  disabled={zoomLevel <= 0.5}
                  className="text-white hover:bg-white/20"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-white text-sm min-w-12 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={zoomIn}
                  disabled={zoomLevel >= 4}
                  className="text-white hover:bg-white/20"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </>
            )}
            
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main photo display */}
      <div className="relative aspect-video overflow-hidden">
        <div 
          className="w-full h-full transition-transform duration-200 ease-out"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <EnhancedProgressiveImage
            photo={currentPhoto}
            alt={`Photo ${currentIndex + 1}`}
            className="w-full h-full"
            showAttribution={false} // We'll show it separately
          />
        </div>
        
        {/* Navigation arrows */}
        {photos.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="lg"
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            
            <Button
              variant="ghost"
              size="lg"
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </>
        )}
      </div>

      {/* Attribution overlay */}
      <PhotoAttribution
        photo={currentPhoto}
        isVisible={showAttribution}
        onToggle={() => setShowAttribution(!showAttribution)}
      />

      {/* Thumbnail grid */}
      {showThumbnails && photos.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <PhotoThumbnailGrid
            photos={photos}
            currentIndex={currentIndex}
            onThumbnailClick={handleThumbnailClick}
          />
        </div>
      )}
    </div>
  );
};

export default PhotoCarousel;
