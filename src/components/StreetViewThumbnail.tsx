
import React from 'react';

interface StreetViewThumbnailProps {
  imageUrl: string;
  landmarkName: string;
  onClick?: () => void;
  className?: string;
}

const StreetViewThumbnail: React.FC<StreetViewThumbnailProps> = ({
  imageUrl,
  landmarkName,
  onClick,
  className = ""
}) => {
  return (
    <div 
      className={`relative overflow-hidden rounded-lg cursor-pointer transition-transform hover:scale-105 ${className}`}
      onClick={onClick}
    >
      <img
        src={imageUrl}
        alt={`Street View of ${landmarkName}`}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      <div className="absolute bottom-2 left-2 right-2">
        <div className="flex items-center justify-between text-white text-xs">
          <span className="font-medium truncate">{landmarkName}</span>
          <span className="bg-blue-500 px-2 py-1 rounded text-xs ml-2 whitespace-nowrap">
            Street View
          </span>
        </div>
      </div>
    </div>
  );
};

export default StreetViewThumbnail;
