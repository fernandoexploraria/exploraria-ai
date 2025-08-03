
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

  // Only update currentIndex when initialIndex changes AND we haven't been manually navigated
  useEffect(() => {
    // Only reset to initialIndex if it's a significant change and we're not in the middle of navigation
    const isSignificantChange = Math.abs(initialIndex - currentIndex) > 0;
    const isValidIndex = initialIndex >= 0 && initialIndex < photos.length;
    
    if (isSignificantChange && isValidIndex) {
      console.log(`🔍 [usePhotoNavigation] Setting currentIndex to initialIndex: ${currentIndex} → ${initialIndex}`);
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, photos.length]); // Remove currentIndex from dependencies to prevent reset loop

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
    console.log('🔍 [usePhotoNavigation] openFullscreen called');
    setIsFullscreen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    console.log('🔍 [usePhotoNavigation] closeFullscreen called');
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
