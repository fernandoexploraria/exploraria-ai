
import React from 'react';
import { Star } from 'lucide-react';

interface LandmarkRatingProps {
  rating: number;
  userRatingsTotal?: number;
}

const LandmarkRating: React.FC<LandmarkRatingProps> = ({ 
  rating, 
  userRatingsTotal 
}) => {
  return (
    <div className="flex items-center gap-1">
      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      {userRatingsTotal && (
        <span className="text-xs text-gray-500">({userRatingsTotal})</span>
      )}
    </div>
  );
};

export default LandmarkRating;
