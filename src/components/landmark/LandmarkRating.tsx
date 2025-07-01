
import React from 'react';
import { Star } from 'lucide-react';

interface LandmarkRatingProps {
  rating: number;
  reviewCount?: number;
  className?: string;
}

const LandmarkRating: React.FC<LandmarkRatingProps> = ({
  rating,
  reviewCount,
  className = ''
}) => {
  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
      );
    }
    
    if (hasHalfStar) {
      stars.push(
        <Star key="half" className="w-3 h-3 fill-yellow-400/50 text-yellow-400" />
      );
    }

    const remainingStars = 5 - Math.ceil(rating);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(
        <Star key={`empty-${i}`} className="w-3 h-3 text-gray-300" />
      );
    }

    return stars;
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex">
        {renderStars()}
      </div>
      <span className="text-sm font-medium text-white">
        {rating.toFixed(1)}
      </span>
      {reviewCount && (
        <span className="text-xs text-gray-300">
          ({reviewCount})
        </span>
      )}
    </div>
  );
};

export default LandmarkRating;
