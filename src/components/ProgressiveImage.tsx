
import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { PhotoData } from '@/hooks/useEnhancedPhotos';
import EnhancedProgressiveImage from './EnhancedProgressiveImage';

interface ProgressiveImageProps {
  src?: string;
  photo?: PhotoData;
  alt: string;
  lowQualitySrc?: string;
  className?: string;
  placeholder?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  priority?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
  showAttribution?: boolean;
}

const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  photo,
  alt,
  lowQualitySrc,
  className = '',
  placeholder,
  onLoad,
  onError,
  priority = false,
  sizes,
  width,
  height,
  showAttribution = false
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { getOptimalImageQuality, isOnline } = useNetworkStatus();

  // If PhotoData is provided, use the enhanced component
  if (photo) {
    return (
      <EnhancedProgressiveImage
        photo={photo}
        alt={alt}
        className={className}
        onLoad={onLoad}
        onError={onError}
        showAttribution={showAttribution}
      />
    );
  }

  // Fallback to original implementation if no PhotoData
  if (!src) {
    return (
      <div className={cn('bg-gray-100 flex items-center justify-center', className)}>
        <div className="text-gray-500 text-sm">No image source provided</div>
      </div>
    );
  }

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px'
      }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [priority]);

  // Determine which image source to use based on network conditions
  useEffect(() => {
    if (!isInView || !isOnline) return;

    const quality = getOptimalImageQuality();
    let imageSrc = src;

    // Use low quality image for slow connections if available
    if (quality === 'low' && lowQualitySrc) {
      imageSrc = lowQualitySrc;
    }

    setCurrentSrc(imageSrc);
  }, [isInView, src, lowQualitySrc, getOptimalImageQuality, isOnline]);

  // Progressive loading: start with low quality, then upgrade
  useEffect(() => {
    if (!currentSrc || !lowQualitySrc || hasError) return;

    const img = new Image();
    img.onload = () => {
      setIsLoaded(true);
      onLoad?.();
      
      // If we loaded the low quality version, upgrade to high quality
      if (currentSrc === lowQualitySrc && getOptimalImageQuality() !== 'low') {
        const highQualityImg = new Image();
        highQualityImg.onload = () => {
          setCurrentSrc(src);
        };
        highQualityImg.src = src;
      }
    };
    
    img.onerror = () => {
      setHasError(true);
      onError?.();
    };
    
    img.src = currentSrc;
  }, [currentSrc, lowQualitySrc, src, onLoad, onError, hasError, getOptimalImageQuality]);

  const defaultPlaceholder = (
    <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  );

  const errorPlaceholder = (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <div className="text-gray-500 text-sm">Failed to load image</div>
    </div>
  );

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      {!isInView || !currentSrc ? (
        placeholder || defaultPlaceholder
      ) : hasError ? (
        errorPlaceholder
      ) : (
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          sizes={sizes}
          width={width}
          height={height}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          loading={priority ? 'eager' : 'lazy'}
        />
      )}
      
      {!isLoaded && currentSrc && !hasError && (
        <div className="absolute inset-0">
          {placeholder || defaultPlaceholder}
        </div>
      )}
      
      {!isOnline && (
        <div className="absolute top-2 right-2 bg-gray-800 text-white text-xs px-2 py-1 rounded">
          Offline
        </div>
      )}
    </div>
  );
};

export default ProgressiveImage;
