
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import { PhotoData } from '@/hooks/useEnhancedPhotos';
import EnhancedProgressiveImage from './EnhancedProgressiveImage';
import PhotoAttribution from './photo-carousel/PhotoAttribution';

interface ImageViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl?: string;
  photo?: PhotoData;
  imageName: string;
}

const ImageViewerDialog: React.FC<ImageViewerDialogProps> = ({
  open,
  onOpenChange,
  imageUrl,
  photo,
  imageName,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showAttribution, setShowAttribution] = useState(false);

  const handleDownload = async () => {
    try {
      let downloadUrl = imageUrl;
      
      // If PhotoData is available, use the highest quality URL
      if (photo) {
        downloadUrl = photo.urls.large || photo.urls.medium || photo.urls.thumb;
      }
      
      if (!downloadUrl) return;

      // Create a temporary link element for download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${imageName.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
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
      const fallbackUrl = photo ? (photo.urls.large || photo.urls.medium || photo.urls.thumb) : imageUrl;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span>{imageName}</span>
            <div className="flex gap-2">
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
            {photo ? (
              <EnhancedProgressiveImage
                photo={photo}
                alt={imageName}
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

          {/* Attribution overlay for PhotoData */}
          {photo && photo.attributions && photo.attributions.length > 0 && (
            <PhotoAttribution
              photo={photo}
              isVisible={showAttribution}
              onToggle={() => setShowAttribution(!showAttribution)}
              className="rounded-b-lg"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageViewerDialog;
