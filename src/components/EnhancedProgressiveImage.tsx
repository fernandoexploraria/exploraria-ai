
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
  const [currentSrc, setCurrentSrc] = useState<string>(photo.urls.thumb);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { getOptimalImageQuality } = useNetworkStatus();

  useEffect(() => {
    // Start with thumbnail, then progressively load higher quality
    const loadImage = async () => {
      try {
        // Load thumbnail first
        await loadImagePromise(photo.urls.thumb);
        setCurrentSrc(photo.urls.thumb);
        setIsLoaded(true);
        onLoad?.();

        // Then upgrade to optimal quality based on network
        const networkQuality = getOptimalImageQuality();
        let targetUrl = photo.urls.medium;
        
        if (networkQuality === 'high') {
          targetUrl = photo.urls.large;
        } else if (networkQuality === 'low') {
          targetUrl = photo.urls.thumb; // Stay with thumb for slow connections
          return;
        }

        // Load higher quality version
        if (targetUrl !== photo.urls.thumb) {
          await loadImagePromise(targetUrl);
          setCurrentSrc(targetUrl);
        }
      } catch (error) {
        console.error('Error loading photo:', error);
        setHasError(true);
        onError?.();
      }
    };

    loadImage();
  }, [photo, getOptimalImageQuality, onLoad, onError]);

  const loadImagePromise = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = src;
    });
  };

  if (hasError) {
    return (
      <div className={cn('bg-gray-100 flex items-center justify-center', className)}>
        <div className="text-gray-500 text-sm">Failed to load image</div>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
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
      
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      )}

      {showAttribution && photo.attributions && photo.attributions.length > 0 && (
        <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
          {photo.attributions[0].displayName}
        </div>
      )}
    </div>
  );
};

export default EnhancedProgressiveImage;
