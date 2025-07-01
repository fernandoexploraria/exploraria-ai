
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { PhotoData } from '@/hooks/useEnhancedPhotos';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePhotoOptimization } from '@/hooks/photo-optimization/usePhotoOptimization';

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
  const [optimizationInfo, setOptimizationInfo] = useState<string>('');
  
  const { getOptimalImageQuality } = useNetworkStatus();
  const photoOptimization = usePhotoOptimization();

  useEffect(() => {
    // Reset state when photo changes
    setIsLoaded(false);
    setHasError(false);
    setLoadAttempts(0);
    setOptimizationInfo('');
    
    // Enhanced progressive loading with optimization
    const loadImageWithOptimization = async () => {
      const networkQuality = getOptimalImageQuality();
      
      // Determine URL priority based on network quality and availability
      let urlsToTry: Array<{ url: string; size: 'thumb' | 'medium' | 'large' }> = [];
      
      if (networkQuality === 'high') {
        urlsToTry = [
          { url: photo.urls.large, size: 'large' as const },
          { url: photo.urls.medium, size: 'medium' as const },
          { url: photo.urls.thumb, size: 'thumb' as const }
        ].filter(item => item.url);
      } else if (networkQuality === 'medium') {
        urlsToTry = [
          { url: photo.urls.medium, size: 'medium' as const },
          { url: photo.urls.thumb, size: 'thumb' as const },
          { url: photo.urls.large, size: 'large' as const }
        ].filter(item => item.url);
      } else {
        urlsToTry = [
          { url: photo.urls.thumb, size: 'thumb' as const },
          { url: photo.urls.medium, size: 'medium' as const },
          { url: photo.urls.large, size: 'large' as const }
        ].filter(item => item.url);
      }
      
      // If no URLs available, try optimization on photo reference
      if (urlsToTry.length === 0 && photo.photoReference) {
        console.log(`📸 No URLs available, trying optimization for: ${photo.photoReference}`);
        try {
          const optimizedResult = await photoOptimization.getOptimizedPhotoUrl(
            photo.photoReference,
            networkQuality === 'low' ? 'thumb' : networkQuality === 'high' ? 'large' : 'medium'
          );
          
          urlsToTry = [{ url: optimizedResult.url, size: 'medium' as const }];
          setOptimizationInfo(`Optimized (${optimizedResult.source})`);
          
          if (optimizedResult.isPreValidated) {
            console.log(`✅ Using pre-validated optimized URL`);
          }
        } catch (error) {
          console.error(`❌ Photo optimization failed:`, error);
          setHasError(true);
          onError?.();
          return;
        }
      }
      
      if (urlsToTry.length === 0) {
        console.error('❌ No valid URLs available for photo:', photo);
        setHasError(true);
        onError?.();
        return;
      }
      
      // Try each URL in order with enhanced error handling
      for (let i = 0; i < urlsToTry.length; i++) {
        const { url, size } = urlsToTry[i];
        setLoadAttempts(i + 1);
        
        try {
          console.log(`📷 Attempting to load photo (attempt ${i + 1}/${urlsToTry.length}):`, { url, size });
          
          // Record the attempt for metrics
          const startTimer = photoOptimization.metrics.startPhotoLoadTimer(photo.id.toString());
          
          await loadImagePromise(url);
          
          // Record successful load
          const loadTime = startTimer();
          photoOptimization.metrics.recordPhotoLoad({
            photoId: photo.id.toString(),
            url,
            source: photo.photoSource || 'google_places_api',
            size,
            loadTime,
            success: true,
            qualityScore: photo.qualityScore
          });
          
          console.log(`✅ Successfully loaded photo:`, { url, size, loadTime });
          setCurrentSrc(url);
          setIsLoaded(true);
          onLoad?.();
          return; // Success, exit the loop
          
        } catch (error) {
          console.warn(`⚠️ Failed to load photo (attempt ${i + 1}):`, { url, size, error });
          
          // Record failed load
          const loadTime = photoOptimization.metrics.startPhotoLoadTimer(photo.id.toString())();
          photoOptimization.metrics.recordPhotoLoad({
            photoId: photo.id.toString(),
            url,
            source: photo.photoSource || 'google_places_api',
            size,
            loadTime,
            success: false,
            errorType: error instanceof Error ? error.message : 'Unknown error',
            qualityScore: photo.qualityScore
          });
          
          // If this was the last attempt, show error
          if (i === urlsToTry.length - 1) {
            console.error('❌ All photo URLs failed to load for:', photo);
            setHasError(true);
            onError?.();
          }
        }
      }
    };

    loadImageWithOptimization();
  }, [photo, getOptimalImageQuality, onLoad, onError, photoOptimization]);

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
          <div className="text-xs mt-1">
            Tried {loadAttempts} URL{loadAttempts !== 1 ? 's' : ''}
            {optimizationInfo && ` (${optimizationInfo})`}
          </div>
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
            Loading{loadAttempts > 0 ? ` (${loadAttempts})` : ''}
            {optimizationInfo && ` - ${optimizationInfo}`}...
          </div>
        </div>
      )}

      {showAttribution && photo.attributions && photo.attributions.length > 0 && isLoaded && (
        <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
          {photo.attributions[0].displayName}
        </div>
      )}
      
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && optimizationInfo && (
        <div className="absolute top-1 left-1 bg-blue-600 bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
          {optimizationInfo}
        </div>
      )}
    </div>
  );
};

export default EnhancedProgressiveImage;
