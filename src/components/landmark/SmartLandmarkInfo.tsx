
import React from 'react';
import { Landmark, EnhancedLandmark } from '@/data/landmarks';
import LandmarkRating from './LandmarkRating';
import OpeningStatus from './OpeningStatus';
import LandmarkTypes from './LandmarkTypes';
import EnhancedBadge from './EnhancedBadge';
import EditorialSummary from './EditorialSummary';
import {
  shouldShowRating,
  shouldShowOpeningHours,
  formatEditorialSummary,
  getRelevantTypes,
  isEnhancedLandmark,
  formatOpeningStatus
} from '@/utils/landmarkDisplayUtils';

interface SmartLandmarkInfoProps {
  landmark: Landmark | EnhancedLandmark;
  className?: string;
}

const SmartLandmarkInfo: React.FC<SmartLandmarkInfoProps> = ({ 
  landmark, 
  className = "" 
}) => {
  const enhanced = landmark as EnhancedLandmark;
  const showRating = shouldShowRating(landmark);
  const showOpeningHours = shouldShowOpeningHours(landmark);
  const relevantTypes = getRelevantTypes(landmark.types);
  const isEnhanced = isEnhancedLandmark(landmark);
  const editorialSummary = formatEditorialSummary(enhanced.editorial_summary);
  const openingStatus = showOpeningHours ? formatOpeningStatus(enhanced.opening_hours) : null;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Enhanced Badge and Rating Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEnhanced && <EnhancedBadge />}
          {showRating && (
            <LandmarkRating 
              rating={landmark.rating!} 
              userRatingsTotal={enhanced.user_ratings_total}
            />
          )}
        </div>
        {openingStatus && <OpeningStatus status={openingStatus} />}
      </div>

      {/* Place Types */}
      {relevantTypes.length > 0 && (
        <LandmarkTypes types={relevantTypes} />
      )}

      {/* Editorial Summary */}
      {editorialSummary && (
        <EditorialSummary summary={editorialSummary} />
      )}

      {/* Formatted Address (if available and different from name) */}
      {enhanced.formattedAddress && (
        <p className="text-xs text-gray-500">{enhanced.formattedAddress}</p>
      )}
    </div>
  );
};

export default SmartLandmarkInfo;
