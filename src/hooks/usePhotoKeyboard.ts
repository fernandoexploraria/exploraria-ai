
import { useEffect } from 'react';

interface UsePhotoKeyboardProps {
  isActive: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onFirst?: () => void;
  onLast?: () => void;
  onClose?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onFullscreen?: () => void;
  onSlideshow?: () => void;
}

export const usePhotoKeyboard = ({
  isActive,
  onNext,
  onPrevious,
  onFirst,
  onLast,
  onClose,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFullscreen,
  onSlideshow
}: UsePhotoKeyboardProps) => {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowRight':
        case ' ':
          event.preventDefault();
          onNext();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          onPrevious();
          break;
        case 'Home':
          event.preventDefault();
          onFirst?.();
          break;
        case 'End':
          event.preventDefault();
          onLast?.();
          break;
        case 'Escape':
          event.preventDefault();
          onClose?.();
          break;
        case '+':
        case '=':
          event.preventDefault();
          onZoomIn?.();
          break;
        case '-':
          event.preventDefault();
          onZoomOut?.();
          break;
        case '0':
          event.preventDefault();
          onResetZoom?.();
          break;
        case 'f':
        case 'F':
          event.preventDefault();
          onFullscreen?.();
          break;
        case 's':
        case 'S':
          event.preventDefault();
          onSlideshow?.();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    isActive,
    onNext,
    onPrevious,
    onFirst,
    onLast,
    onClose,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onFullscreen,
    onSlideshow
  ]);
};
