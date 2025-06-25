
import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StreetViewNavigationControls from './StreetViewNavigationControls';
import StreetViewThumbnailGrid from './StreetViewThumbnailGrid';

interface StreetViewData {
  imageUrl: string;
  heading: number;
  pitch: number;
  fov: number;
  location: {
    lat: number;
    lng: number;
  };
  landmarkName: string;
  metadata: {
    status: string;
    copyright?: string;
  };
}

interface StreetViewItem {
  landmark: any;
  streetViewData: StreetViewData | null;
}

interface EnhancedStreetViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  streetViewItems: StreetViewItem[];
  initialIndex?: number;
  onLocationSelect?: (coordinates: [number, number]) => void;
}

const EnhancedStreetViewModal: React.FC<EnhancedStreetViewModalProps> = ({
  isOpen,
  onClose,
  streetViewItems,
  initialIndex = 0,
  onLocationSelect
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Reset index when modal opens or items change
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, streetViewItems]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, currentIndex, streetViewItems.length]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex(prev => prev > 0 ? prev - 1 : streetViewItems.length - 1);
  }, [streetViewItems.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => prev < streetViewItems.length - 1 ? prev + 1 : 0);
  }, [streetViewItems.length]);

  const handleThumbnailClick = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const handleShowOnMap = useCallback(() => {
    const currentItem = streetViewItems[currentIndex];
    if (currentItem?.streetViewData && onLocationSelect) {
      const { lat, lng } = currentItem.streetViewData.location;
      onLocationSelect([lng, lat]);
      onClose();
    }
  }, [currentIndex, streetViewItems, onLocationSelect, onClose]);

  if (!isOpen || streetViewItems.length === 0) return null;

  const currentItem = streetViewItems[currentIndex];
  const currentStreetView = currentItem?.streetViewData;

  if (!currentStreetView) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="bg-white rounded-lg p-8 max-w-md text-center">
          <h2 className="text-xl font-bold mb-4">Street View Not Available</h2>
          <p className="text-gray-600 mb-4">
            Street View is not available for {currentItem?.landmark.name}.
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  const availableItems = streetViewItems.filter(item => item.streetViewData);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 ${isFullscreen ? 'p-0' : 'p-4'}`}>
      <div className={`relative w-full h-full bg-black rounded-lg overflow-hidden ${isFullscreen ? 'max-w-none max-h-none' : 'max-w-7xl max-h-[95vh]'}`}>
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between text-white">
            <div className="flex-1">
              <h2 className="text-xl font-bold">{currentStreetView.landmarkName}</h2>
              <p className="text-sm opacity-90">
                Street View • {currentStreetView.location.lat.toFixed(6)}, {currentStreetView.location.lng.toFixed(6)}
              </p>
            </div>
            
            {/* Navigation Controls */}
            <div className="flex items-center gap-4">
              <StreetViewNavigationControls
                onPrevious={handlePrevious}
                onNext={handleNext}
                onFullscreen={toggleFullscreen}
                onShowOnMap={onLocationSelect ? handleShowOnMap : undefined}
                hasPrevious={currentIndex > 0}
                hasNext={currentIndex < streetViewItems.length - 1}
                currentIndex={currentIndex}
                totalCount={streetViewItems.length}
              />
              
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* Street View Image */}
        <div className="w-full h-full">
          <img
            src={currentStreetView.imageUrl}
            alt={`Street View of ${currentStreetView.landmarkName}`}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Thumbnail Navigation */}
        {availableItems.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <StreetViewThumbnailGrid
              thumbnails={streetViewItems}
              onThumbnailClick={handleThumbnailClick}
              selectedIndex={currentIndex}
              className="justify-center"
            />
          </div>
        )}

        {/* Footer with metadata */}
        {currentStreetView.metadata.copyright && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <p className="text-white text-xs opacity-75">
              {currentStreetView.metadata.copyright}
            </p>
          </div>
        )}

        {/* Keyboard shortcuts hint */}
        <div className="absolute bottom-4 right-4 text-white text-xs opacity-50">
          ← → Navigate • F Fullscreen • ESC Close
        </div>
      </div>
    </div>
  );
};

export default EnhancedStreetViewModal;
