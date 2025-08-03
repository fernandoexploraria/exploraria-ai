import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, Maximize2 } from 'lucide-react';
import { PhotoData } from '@/hooks/useEnhancedPhotos';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePhotoNavigation } from '@/hooks/usePhotoNavigation';
import { usePhotoKeyboard } from '@/hooks/usePhotoKeyboard';
import EnhancedProgressiveImage from '@/components/EnhancedProgressiveImage';
import PhotoThumbnailGrid from './PhotoThumbnailGrid';
import PhotoQualityIndicator from './PhotoQualityIndicator';
import PhotoAttribution from './PhotoAttribution';
import FullscreenPhotoViewer from '../FullscreenPhotoViewer';
import { cn } from '@/lib/utils';

interface PhotoCarouselProps {
  photos: PhotoData[];
  initialIndex?: number;
  onClose?: () => void;
  showThumbnails?: boolean;
  allowZoom?: boolean;
  allowFullscreen?: boolean;
  className?: string;
  landmark?: any; // Add landmark prop
}

const PhotoCarousel: React.FC<PhotoCarouselProps> = ({
  photos,
  initialIndex = 0,
  onClose,
  showThumbnails = true,
  allowZoom = true,
  allowFullscreen = true,
  className,
  landmark
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showAttribution, setShowAttribution] = useState(false);
  const { getOptimalImageQuality } = useNetworkStatus();

  console.log(`🎠 [PhotoCarousel] Rendering with ${photos.length} photos, initialIndex: ${initialIndex}`);

  const {
    currentIndex,
    isFullscreen,
    currentPhoto,
    hasNext,
    hasPrevious,
    totalCount,
    goToNext,
    goToPrevious,
    goToFirst,
    goToLast,
    goToIndex,
    openFullscreen,
    closeFullscreen
  } = usePhotoNavigation({
    photos,
    initialIndex,
    onIndexChange: (newIndex) => {
      console.log(`🎠 [PhotoCarousel] Photo navigation changed to index: ${newIndex}`);
    }
  });

  console.log(`🎠 [PhotoCarousel] Current state - index: ${currentIndex}, photo: ${currentPhoto?.id || 'none'}`);

  const zoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev * 1.5, 4));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.5));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(1);
  }, []);

  // Reset zoom when changing photos
  useEffect(() => {
    console.log(`🎠 [PhotoCarousel] Resetting zoom due to photo change (index: ${currentIndex})`);
    setZoomLevel(1);
  }, [currentIndex]);

  // Keyboard navigation
  usePhotoKeyboard({
    isActive: !isFullscreen,
    onNext: goToNext,
    onPrevious: goToPrevious,
    onFirst: goToFirst,
    onLast: goToLast,
    onClose,
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onResetZoom: resetZoom,
    onFullscreen: allowFullscreen ? openFullscreen : undefined
  });

  const handleThumbnailClick = useCallback((index: number) => {
    console.log(`🎠 [PhotoCarousel] Thumbnail ${index} clicked, calling goToIndex`);
    goToIndex(index);
  }, [goToIndex]);

  if (!currentPhoto) {
    console.log(`🎠 [PhotoCarousel] No current photo available`);
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <p className="text-gray-500">No photos available</p>
      </div>
    );
  }

  console.log(`🎠 [PhotoCarousel] Rendering main photo: ${currentPhoto.id}`);

  return (
    <>
      <div className={cn('relative bg-black rounded-lg overflow-hidden', className)}>
        {/* Header with controls - ADJUSTED POSITIONING */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent pt-6 px-4 pb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-white text-sm">
                  {currentIndex + 1} / {totalCount}
                </span>
              </div>
              <PhotoQualityIndicator photo={currentPhoto} />
            </div>
            
            <div className="flex items-center gap-2">
              
              {allowFullscreen && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    console.log('🎠 [PhotoCarousel] Maximize button clicked, calling openFullscreen');
                    openFullscreen();
                  }}
                  className="text-green-500 hover:bg-green-500/20 relative z-30 border border-green-500"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
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
              showAttribution={false}
              key={`photo-${currentPhoto.id}-${currentIndex}`}
            />
          </div>
          
          {/* Navigation arrows */}
          {totalCount > 1 && (
            <>
              <Button
                variant="ghost"
                size="lg"
                onClick={goToPrevious}
                disabled={!hasPrevious && totalCount <= 1}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              
              <Button
                variant="ghost"
                size="lg"
                onClick={goToNext}
                disabled={!hasNext && totalCount <= 1}
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
        {showThumbnails && totalCount > 1 && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <PhotoThumbnailGrid
              photos={photos}
              currentIndex={currentIndex}
              onThumbnailClick={handleThumbnailClick}
            />
          </div>
        )}

      </div>

      {/* Fullscreen viewer */}
      {allowFullscreen && (
        <FullscreenPhotoViewer
          photos={photos}
          currentIndex={currentIndex}
          landmark={landmark || { name: 'Photo Gallery', type: 'unknown' }}
          isOpen={isFullscreen}
          onClose={closeFullscreen}
          onIndexChange={goToIndex}
        />
      )}
    </>
  );
};

export default PhotoCarousel;
