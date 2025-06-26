
import { useState, useCallback } from 'react';
import { PhotoData } from './useEnhancedPhotos';

export const usePhotoCarouselState = () => {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const showCarousel = useCallback((photoData: PhotoData[], initialIndex: number = 0) => {
    setPhotos(photoData);
    setCurrentIndex(initialIndex);
    setIsVisible(true);
  }, []);

  const hideCarousel = useCallback(() => {
    setPhotos([]);
    setCurrentIndex(0);
    setIsVisible(false);
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < photos.length) {
      setCurrentIndex(index);
    }
  }, [photos.length]);

  return {
    photos,
    currentIndex,
    isVisible,
    currentPhoto: photos[currentIndex] || null,
    showCarousel,
    hideCarousel,
    goToNext,
    goToPrevious,
    goToIndex,
    hasMultiplePhotos: photos.length > 1,
    totalPhotos: photos.length
  };
};

