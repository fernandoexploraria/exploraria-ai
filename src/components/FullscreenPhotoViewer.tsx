import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, ZoomIn, ZoomOut, RotateCcw, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { PhotoData } from '@/hooks/useEnhancedPhotos';
import EnhancedProgressiveImage from './EnhancedProgressiveImage';
import PhotoThumbnailGrid from './photo-carousel/PhotoThumbnailGrid';
import PhotoAttribution from './photo-carousel/PhotoAttribution';
import { cn } from '@/lib/utils';

interface FullscreenPhotoViewerProps {
  photos: PhotoData[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

const FullscreenPhotoViewer: React.FC<FullscreenPhotoViewerProps> = ({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onIndexChange
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [showAttribution, setShowAttribution] = useState(false);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState<Set<number>>(new Set());
  
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const slideshowInterval = useRef<NodeJS.Timeout | null>(null);

  const currentPhoto = photos[currentIndex];

  // Preload adjacent images
  useEffect(() => {
    const preloadImage = (index: number) => {
      if (index >= 0 && index < photos.length && !preloadedImages.has(index)) {
        const img = new Image();
        img.src = photos[index].urls.large || photos[index].urls.medium;
        img.onload = () => {
          setPreloadedImages(prev => new Set(prev).add(index));
        };
      }
    };

    // Preload current, previous, and next images
    preloadImage(currentIndex);
    preloadImage(currentIndex - 1);
    preloadImage(currentIndex + 1);
  }, [currentIndex, photos, preloadedImages]);

  // Slideshow logic
  useEffect(() => {
    if (isSlideshow && photos.length > 1) {
      slideshowInterval.current = setInterval(() => {
        onIndexChange((currentIndex + 1) % photos.length);
      }, 3000);
    } else {
      if (slideshowInterval.current) {
        clearInterval(slideshowInterval.current);
        slideshowInterval.current = null;
      }
    }

    return () => {
      if (slideshowInterval.current) {
        clearInterval(slideshowInterval.current);
      }
    };
  }, [isSlideshow, currentIndex, photos.length, onIndexChange]);

  // Reset zoom and pan when photo changes
  useEffect(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
        case ' ':
          event.preventDefault();
          goToNext();
          break;
        case 'Home':
          event.preventDefault();
          onIndexChange(0);
          break;
        case 'End':
          event.preventDefault();
          onIndexChange(photos.length - 1);
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
        case '0':
          event.preventDefault();
          resetZoom();
          break;
        case 'f':
        case 'F':
          event.preventDefault();
          toggleFullscreen();
          break;
        case 's':
        case 'S':
          event.preventDefault();
          setIsSlideshow(!isSlideshow);
          break;
        case 't':
        case 'T':
          event.preventDefault();
          setShowThumbnails(!showThumbnails);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, photos.length, isSlideshow, showThumbnails]);

  const goToPrevious = useCallback(() => {
    onIndexChange(currentIndex > 0 ? currentIndex - 1 : photos.length - 1);
  }, [currentIndex, photos.length, onIndexChange]);

  const goToNext = useCallback(() => {
    onIndexChange(currentIndex < photos.length - 1 ? currentIndex + 1 : 0);
  }, [currentIndex, photos.length, onIndexChange]);

  const zoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev * 1.5, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.25));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  // Mouse drag handlers
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: event.clientX - panOffset.x, y: event.clientY - panOffset.y });
    }
  }, [zoomLevel, panOffset]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPanOffset({
        x: event.clientX - dragStart.x,
        y: event.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, zoomLevel]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers for mobile
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 1 && zoomLevel > 1) {
      const touch = event.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - panOffset.x, y: touch.clientY - panOffset.y });
    }
  }, [zoomLevel, panOffset]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 1 && isDragging && zoomLevel > 1) {
      event.preventDefault();
      const touch = event.touches[0];
      setPanOffset({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, zoomLevel]);

  if (!isOpen || !currentPhoto) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <span className="text-lg font-medium">
              {currentIndex + 1} of {photos.length}
            </span>
            {photos.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSlideshow(!isSlideshow)}
                className="text-white hover:bg-white/20"
              >
                {isSlideshow ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span className="ml-2">{isSlideshow ? 'Pause' : 'Slideshow'}</span>
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomOut}
              disabled={zoomLevel <= 0.25}
              className="text-white hover:bg-white/20"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            
            <span className="text-white min-w-16 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomIn}
              disabled={zoomLevel >= 5}
              className="text-white hover:bg-white/20"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={resetZoom}
              className="text-white hover:bg-white/20"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Photo Display */}
      <div
        ref={imageContainerRef}
        className="flex-1 flex items-center justify-center overflow-hidden cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setIsDragging(false)}
      >
        <div
          className="transition-transform duration-200 ease-out"
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
            cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
          }}
        >
          <EnhancedProgressiveImage
            photo={currentPhoto}
            alt={`Photo ${currentIndex + 1}`}
            className="max-w-screen max-h-screen object-contain"
            showAttribution={false}
          />
        </div>
      </div>

      {/* Navigation Arrows */}
      {photos.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="lg"
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>
          
          <Button
            variant="ghost"
            size="lg"
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
          >
            <ChevronRight className="w-8 h-8" />
          </Button>
        </>
      )}

      {/* Attribution */}
      <PhotoAttribution
        photo={currentPhoto}
        isVisible={showAttribution}
        onToggle={() => setShowAttribution(!showAttribution)}
      />

      {/* Thumbnail Grid */}
      {showThumbnails && photos.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <PhotoThumbnailGrid
            photos={photos}
            currentIndex={currentIndex}
            onThumbnailClick={onIndexChange}
          />
        </div>
      )}

      {/* Quick Help */}
      <div className="absolute bottom-4 right-4 text-white text-xs opacity-70 bg-black/50 rounded px-2 py-1">
        ← → Navigate • +/- Zoom • 0 Reset • F Fullscreen • S Slideshow • T Thumbnails • ESC Close
      </div>
    </div>
  );
};

export default FullscreenPhotoViewer;
