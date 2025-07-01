import { useState, useCallback } from 'react';
import { PhotoData } from './useEnhancedPhotos';

interface UsePhotoNavigationProps {
  photos: PhotoData[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
}

export const usePhotoNavigation = ({
  photos,
  initialIndex = 0,
  onIndexChange
}: UsePhotoNavigationProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleIndexChange = useCallback((newIndex: number) => {
    setCurrentIndex(newIndex);
    onIndexChange?.(newIndex);
  }, [onIndexChange]);

  const goToNext = useCallback(() => {
    const nextIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;
    handleIndexChange(nextIndex);
  }, [currentIndex, photos.length, handleIndexChange]);

  const goToPrevious = useCallback(() => {
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
    handleIndexChange(prevIndex);
  }, [currentIndex, photos.length, handleIndexChange]);

  const goToFirst = useCallback(() => {
    handleIndexChange(0);
  }, [handleIndexChange]);

  const goToLast = useCallback(() => {
    handleIndexChange(photos.length - 1);
  }, [photos.length, handleIndexChange]);

  const openFullscreen = useCallback(() => {
    setIsFullscreen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  return {
    currentIndex,
    isFullscreen,
    currentPhoto: photos[currentIndex],
    hasNext: currentIndex < photos.length - 1,
    hasPrevious: currentIndex > 0,
    totalCount: photos.length,
    goToNext,
    goToPrevious,
    goToFirst,
    goToLast,
    goToIndex: handleIndexChange,
    openFullscreen,
    closeFullscreen
  };
};
