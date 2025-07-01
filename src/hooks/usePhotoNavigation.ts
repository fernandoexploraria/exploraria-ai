
import { useState, useCallback, useEffect } from 'react';
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

  console.log(`🔍 [usePhotoNavigation] Hook initialized - photos: ${photos.length}, initialIndex: ${initialIndex}, currentIndex: ${currentIndex}`);

  // Declare currentPhoto before using it
  const currentPhoto = photos[currentIndex];

  // Only update currentIndex if initialIndex changes and it's different from current
  useEffect(() => {
    if (initialIndex !== currentIndex && initialIndex >= 0 && initialIndex < photos.length) {
      console.log(`🔍 [usePhotoNavigation] Updating currentIndex due to initialIndex change: ${currentIndex} → ${initialIndex}`);
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, photos.length, currentIndex]);

  const handleIndexChange = useCallback((newIndex: number) => {
    console.log(`🔍 [usePhotoNavigation] handleIndexChange called: ${currentIndex} → ${newIndex}`);
    setCurrentIndex(newIndex);
    onIndexChange?.(newIndex);
  }, [onIndexChange, currentIndex]);

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
  }, [handleIndexChange, currentIndex]);

  const goToLast = useCallback(() => {
    const lastIndex = photos.length - 1;
    console.log(`🔍 [usePhotoNavigation] goToLast: ${currentIndex} → ${lastIndex}`);
    handleIndexChange(lastIndex);
  }, [photos.length, handleIndexChange, currentIndex]);

  const openFullscreen = useCallback(() => {
    setIsFullscreen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  console.log(`🔍 [usePhotoNavigation] Returning state - currentIndex: ${currentIndex}, currentPhoto: ${currentPhoto?.id || 'none'}`);

  return {
    currentIndex,
    isFullscreen,
    currentPhoto,
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
