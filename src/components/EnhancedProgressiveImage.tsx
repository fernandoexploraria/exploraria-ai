
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { PhotoData } from '@/hooks/useEnhancedPhotos';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface EnhancedProgressiveImageProps {
  photo: PhotoData;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  showAttribution?: boolean;
}

const EnhancedProgressiveImage: React.FC<EnhancedProgressiveImageProps> = ({
  photo,
  alt,
  className = '',
  onLoad,
  onError,
  showAttribution = true
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const { getOptimalImageQuality } = useNetworkStatus();

  useEffect(() => {
    // Reset state when photo changes
    setIsLoaded(false);
    setHasError(false);
    setLoadAttempts(0);
    
    // Progressive loading with fallback strategy
    const loadImageWithFallback = async () => {
      const networkQuality = getOptimalImageQuality();
      
      // Determine URL priority based on network quality and availability
      let urlsToTry: string[] = [];
      
      if (networkQuality === 'high') {
        urlsToTry = [photo.urls.large, photo.urls.medium, photo.urls.thumb].filter(Boolean);
      } else if (networkQuality === 'medium') {
        urlsToTry = [photo.urls.medium, photo.urls.thumb, photo.urls.large].filter(Boolean);
      } else {
        urlsToTry = [photo.urls.thumb, photo.urls.medium, photo.urls.large].filter(Boolean);
      }
      
      // If no URLs available, show error
      if (urlsToTry.length === 0) {
        console.error('❌ No valid URLs available for photo:', photo);
        setHasError(true);
        onError?.();
        return;
      }
      
      // Try each URL in order
      for (let i = 0; i < urlsToTry.length; i++) {
        const url = urlsToTry[i];
        setLoadAttempts(i + 1);
        
        try {
          console.log(`📷 Attempting to load photo (attempt ${i + 1}/${urlsToTry.length}):`, url);
          await loadImagePromise(url);
          
          console.log(`✅ Successfully loaded photo:`, url);
          setCurrentSrc(url);
          setIsLoaded(true);
          onLoad?.();
          return; // Success, exit the loop
          
        } catch (error) {
          console.warn(`⚠️ Failed to load photo (attempt ${i + 1}):`, url, error);
          
          // If this was the last attempt, show error
          if (i === urlsToTry.length - 1) {
            console.error('❌ All photo URLs failed to load for:', photo);
            setHasError(true);
            onError?.();
          }
        }
      }
    };

    loadImageWithFallback();
  }, [photo, getOptimalImageQuality, onLoad, onError]);

  const loadImagePromise = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = (error) => {
        console.log('Error loading photo:', error);
        reject(error);
      };
      img.src = src;
    });
  };

  if (hasError) {
    return (
      <div className={cn('bg-gray-100 flex items-center justify-center', className)}>
        <div className="text-gray-500 text-sm text-center p-2">
          <div>Failed to load image</div>
          <div className="text-xs mt-1">Tried {loadAttempts} URL{loadAttempts !== 1 ? 's' : ''}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          width={photo.width}
          height={photo.height}
        />
      )}
      
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="text-gray-400 text-sm">
            Loading{loadAttempts > 0 ? ` (${loadAttempts})` : ''}...
          </div>
        </div>
      )}

      {showAttribution && photo.attributions && photo.attributions.length > 0 && isLoaded && (
        <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
          {photo.attributions[0].displayName}
        </div>
      )}
    </div>
  );
};

export default EnhancedProgressiveImage;
