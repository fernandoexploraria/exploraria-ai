
import React from 'react';
import { Star, Image } from 'lucide-react';
import { PhotoData } from '@/hooks/useEnhancedPhotos';

interface PhotoQualityIndicatorProps {
  photo: PhotoData;
  totalPhotos?: number;
  className?: string;
}

const PhotoQualityIndicator: React.FC<PhotoQualityIndicatorProps> = ({
  photo,
  totalPhotos,
  className = ''
}) => {
  const qualityScore = photo.qualityScore || 0;
  const qualityLevel = qualityScore >= 60 ? 'High' : qualityScore >= 30 ? 'Medium' : 'Low';
  const qualityColor = qualityScore >= 60 ? 'text-green-400' : qualityScore >= 30 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1 bg-black/60 text-white px-2 py-1 rounded text-xs">
        <Star className={`h-3 w-3 ${qualityColor}`} fill="currentColor" />
        <span>{qualityLevel}</span>
      </div>
      
      {totalPhotos && totalPhotos > 1 && (
        <div className="flex items-center gap-1 bg-black/60 text-white px-2 py-1 rounded text-xs">
          <Image className="h-3 w-3" />
          <span>+{totalPhotos - 1} more</span>
        </div>
      )}
    </div>
  );
};

export default PhotoQualityIndicator;
