
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

  console.log(`🔍 [usePhotoNavigation] Hook initialized with initialIndex: ${initialIndex}, currentIndex: ${currentIndex}`);

  const handleIndexChange = useCallback((newIndex: number) => {
    console.log(`🔍 [usePhotoNavigation] handleIndexChange called: ${currentIndex} → ${newIndex}`);
    setCurrentIndex(newIndex);
    onIndexChange?.(newIndex);
  }, [onIndexChange]); // Removed currentIndex from dependency array

  const goToNext = useCallback(() => {
    const nextIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;
    console.log(`🔍 [usePhotoNavigation] goToNext: ${currentIndex} → ${nextIndex}`);
    handleIndexChange(nextIndex);
  }, [currentIndex, photos.length, handleIndexChange]);

  const goToPrevious = useCallback(() => {
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
    console.log(`🔍 [usePhotoNavigation] goToPrevious: ${currentIndex} → ${prevIndex}`);
    handleIndexChange(prevIndex);
  }, [currentIndex, photos.length, handleIndexChange]);

  const goToFirst = useCallback(() => {
    console.log(`🔍 [usePhotoNavigation] goToFirst: ${currentIndex} → 0`);
    handleIndexChange(0);
  }, [handleIndexChange]);

  const goToLast = useCallback(() => {
    const lastIndex = photos.length - 1;
    console.log(`🔍 [usePhotoNavigation] goToLast: ${currentIndex} → ${lastIndex}`);
    handleIndexChange(lastIndex);
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
