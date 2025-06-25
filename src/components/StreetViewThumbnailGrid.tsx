
import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

interface StreetViewData {
  imageUrl: string;
  heading: number;
  pitch: number;
  fov: number;
  location: {
    lat: number;
    lng: number;
  };
  landmarkName: string;
  metadata: {
    status: string;
    copyright?: string;
  };
}

interface ThumbnailData {
  landmark: any;
  streetViewData: StreetViewData | null;
  isSelected?: boolean;
}

interface StreetViewThumbnailGridProps {
  thumbnails: ThumbnailData[];
  onThumbnailClick: (index: number) => void;
  selectedIndex?: number;
  className?: string;
}

const StreetViewThumbnailGrid: React.FC<StreetViewThumbnailGridProps> = ({
  thumbnails,
  onThumbnailClick,
  selectedIndex = 0,
  className = ""
}) => {
  if (thumbnails.length === 0) return null;

  return (
    <div className={`flex gap-2 overflow-x-auto pb-2 ${className}`}>
      {thumbnails.map((thumbnail, index) => (
        <div
          key={thumbnail.landmark.id || index}
          className="flex-shrink-0"
        >
          <Button
            variant="ghost"
            className={`relative p-0 h-16 w-24 rounded-lg overflow-hidden border-2 transition-all ${
              selectedIndex === index 
                ? 'border-blue-500 ring-2 ring-blue-500/50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => onThumbnailClick(index)}
          >
            {thumbnail.streetViewData ? (
              <>
                <img
                  src={thumbnail.streetViewData.imageUrl}
                  alt={`Street View of ${thumbnail.landmark.name}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute top-1 right-1">
                  <Eye className="h-3 w-3 text-white" />
                </div>
                <div className="absolute bottom-1 left-1 right-1">
                  <span className="text-white text-xs font-medium truncate block">
                    {thumbnail.landmark.name}
                  </span>
                </div>
              </>
            ) : (
              <div className="w-full h-full bg-gray-200 flex flex-col items-center justify-center">
                <EyeOff className="h-4 w-4 text-gray-400 mb-1" />
                <span className="text-xs text-gray-500 text-center px-1 leading-tight">
                  {thumbnail.landmark.name}
                </span>
              </div>
            )}
          </Button>
        </div>
      ))}
    </div>
  );
};

export default StreetViewThumbnailGrid;
