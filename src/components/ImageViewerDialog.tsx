import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { PhotoData } from '@/hooks/useEnhancedPhotos';
import { usePhotoNavigation } from '@/hooks/usePhotoNavigation';
import { usePhotoKeyboard } from '@/hooks/usePhotoKeyboard';
import EnhancedProgressiveImage from './EnhancedProgressiveImage';
import PhotoAttribution from './photo-carousel/PhotoAttribution';
import PhotoThumbnailGrid from './photo-carousel/PhotoThumbnailGrid';
import FullscreenPhotoViewer from './FullscreenPhotoViewer';

interface ImageViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl?: string;
  photo?: PhotoData;
  photos?: PhotoData[];
  imageName: string;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
}

const ImageViewerDialog: React.FC<ImageViewerDialogProps> = ({
  open,
  onOpenChange,
  imageUrl,
  photo,
  photos,
  imageName,
  initialIndex = 0,
  onIndexChange,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showAttribution, setShowAttribution] = useState(false);

  // Create photos array from props
  const photosList = photos || (photo ? [photo] : []);
  const hasMultiplePhotos = photosList.length > 1;

  const {
    currentIndex,
    isFullscreen,
    currentPhoto,
    hasNext,
    hasPrevious,
    totalCount,
    goToNext,
    goToPrevious,
    goToIndex,
    openFullscreen,
    closeFullscreen
  } = usePhotoNavigation({
    photos: photosList,
    initialIndex,
    onIndexChange
  });

  const handleDownload = async () => {
    try {
      let downloadUrl: string;
      
      if (currentPhoto) {
        downloadUrl = currentPhoto.urls.large || currentPhoto.urls.medium || currentPhoto.urls.thumb;
      } else if (imageUrl) {
        downloadUrl = imageUrl;
      } else {
        return;
      }

      // Create a temporary link element for download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${imageName.replace(/[^a-zA-Z0-9]/g, '_')}-${hasMultiplePhotos ? currentIndex + 1 : ''}.jpg`;
      link.target = '_blank';
      
      // For mobile devices, open in new tab so users can long-press and save
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        window.open(downloadUrl, '_blank');
      } else {
        // For desktop, try direct download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      // Fallback: open image in new tab
      const fallbackUrl = currentPhoto ? 
        (currentPhoto.urls.large || currentPhoto.urls.medium || currentPhoto.urls.thumb) : 
        imageUrl;
      if (fallbackUrl) {
        window.open(fallbackUrl, '_blank');
      }
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.5, 4));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.5));
  };

  const resetZoom = () => {
    setZoomLevel(1);
  };

  const handleClose = () => {
    onOpenChange(false);
    setZoomLevel(1);
  };

  // Keyboard navigation
  usePhotoKeyboard({
    isActive: open && !isFullscreen,
    onNext: goToNext,
    onPrevious: goToPrevious,
    onClose: handleClose,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onResetZoom: resetZoom,
    onFullscreen: openFullscreen
  });

  // Reset zoom when photo changes
  React.useEffect(() => {
    setZoomLevel(1);
  }, [currentIndex]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span>
                {imageName}
                {hasMultiplePhotos && ` (${currentIndex + 1} of ${totalCount})`}
              </span>
              <div className="flex gap-2">
                {hasMultiplePhotos && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPrevious}
                      disabled={!hasPrevious}
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNext}
                      disabled={!hasNext}
                      className="flex items-center gap-2"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 0.5}
                  className="flex items-center gap-2"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetZoom}
                  className="text-xs min-w-12"
                >
                  {Math.round(zoomLevel * 100)}%
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 4}
                  className="flex items-center gap-2"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openFullscreen}
                  className="flex items-center gap-2"
                >
                  <Maximize2 className="w-4 h-4" />
                  Fullscreen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-6 pt-2 relative">
            <div 
              className="overflow-hidden rounded-lg"
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center', transition: 'transform 0.2s ease' }}
            >
              {currentPhoto ? (
                <EnhancedProgressiveImage
                  photo={currentPhoto}
                  alt={`${imageName} - Photo ${currentIndex + 1}`}
                  className="w-full h-auto max-h-[70vh] object-contain"
                  showAttribution={false}
                />
              ) : imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt={imageName}
                  className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                />
              ) : (
                <div className="w-full h-64 bg-gray-100 flex items-center justify-center rounded-lg">
                  <span className="text-gray-500">No image available</span>
                </div>
              )}
            </div>

            {/* Attribution overlay */}
            {currentPhoto && currentPhoto.attributions && currentPhoto.attributions.length > 0 && (
              <PhotoAttribution
                photo={currentPhoto}
                isVisible={showAttribution}
                onToggle={() => setShowAttribution(!showAttribution)}
                className="rounded-b-lg"
              />
            )}

            {/* Thumbnail grid for multiple photos */}
            {hasMultiplePhotos && (
              <div className="mt-4">
                <PhotoThumbnailGrid
                  photos={photosList}
                  currentIndex={currentIndex}
                  onThumbnailClick={goToIndex}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen viewer */}
      <FullscreenPhotoViewer
        photos={photosList.length > 0 ? photosList : (imageUrl ? [{
          id: 0,
          photoReference: 'dialog',
          urls: { thumb: imageUrl, medium: imageUrl, large: imageUrl },
          attributions: [],
          width: 800,
          height: 600
        }] : [])}
        currentIndex={currentIndex}
        isOpen={isFullscreen}
        onClose={closeFullscreen}
        onIndexChange={goToIndex}
      />
    </>
  );
};

export default ImageViewerDialog;
