
import React from 'react';
import { PhotoData } from '@/hooks/useEnhancedPhotos';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

interface PhotoThumbnailGridProps {
  photos: PhotoData[];
  currentIndex: number;
  onThumbnailClick: (index: number) => void;
  maxVisible?: number;
  className?: string;
}

const PhotoThumbnailGrid: React.FC<PhotoThumbnailGridProps> = ({
  photos,
  currentIndex,
  onThumbnailClick,
  maxVisible = 8,
  className
}) => {
  // Calculate which thumbnails to show based on current index
  const getVisiblePhotos = () => {
    if (photos.length <= maxVisible) {
      return photos.map((photo, index) => ({ photo, originalIndex: index }));
    }

    const halfVisible = Math.floor(maxVisible / 2);
    let startIndex = Math.max(0, currentIndex - halfVisible);
    let endIndex = Math.min(photos.length, startIndex + maxVisible);

    // Adjust if we're near the end
    if (endIndex - startIndex < maxVisible) {
      startIndex = Math.max(0, endIndex - maxVisible);
    }

    return photos
      .slice(startIndex, endIndex)
      .map((photo, index) => ({ photo, originalIndex: startIndex + index }));
  };

  const visiblePhotos = getVisiblePhotos();

  const getQualityColor = (score?: number) => {
    if (!score) return 'bg-gray-400';
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getQualityText = (score?: number) => {
    if (!score) return 'Unknown';
    if (score >= 80) return 'High';
    if (score >= 60) return 'Good';
    return 'Fair';
  };

  return (
    <div className={cn('flex items-center justify-center gap-2 overflow-hidden', className)}>
      {/* Show indicator if there are photos before the visible range */}
      {photos.length > maxVisible && visiblePhotos[0]?.originalIndex > 0 && (
        <div className="text-white/60 text-xs px-2">
          +{visiblePhotos[0].originalIndex} more
        </div>
      )}

      {visiblePhotos.map(({ photo, originalIndex }) => (
        <button
          key={originalIndex}
          onClick={() => onThumbnailClick(originalIndex)}
          className={cn(
            'relative group flex-shrink-0 w-16 h-12 rounded overflow-hidden transition-all duration-200',
            'border-2 hover:scale-105',
            originalIndex === currentIndex
              ? 'border-white shadow-lg scale-105'
              : 'border-transparent hover:border-white/50'
          )}
        >
          <img
            src={photo.urls.thumb}
            alt={`Thumbnail ${originalIndex + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          
          {/* Quality indicator */}
          {photo.qualityScore && (
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <div 
                className={cn(
                  'w-2 h-2 rounded-full',
                  getQualityColor(photo.qualityScore)
                )}
                title={`Quality: ${getQualityText(photo.qualityScore)} (${Math.round(photo.qualityScore)})`}
              />
            </div>
          )}
          
          {/* Current indicator */}
          {originalIndex === currentIndex && (
            <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
              <Star className="w-4 h-4 text-white fill-white" />
            </div>
          )}
          
          {/* Index number */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent">
            <span className="text-white text-xs px-1 py-0.5 block text-center">
              {originalIndex + 1}
            </span>
          </div>
        </button>
      ))}

      {/* Show indicator if there are photos after the visible range */}
      {photos.length > maxVisible && 
       visiblePhotos[visiblePhotos.length - 1]?.originalIndex < photos.length - 1 && (
        <div className="text-white/60 text-xs px-2">
          +{photos.length - visiblePhotos[visiblePhotos.length - 1].originalIndex - 1} more
        </div>
      )}
    </div>
  );
};

export default PhotoThumbnailGrid;
