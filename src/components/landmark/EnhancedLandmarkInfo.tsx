
import React from 'react';
import { Landmark } from '@/data/landmarks';
import { EnhancedLandmarkData, shouldShowRating, shouldShowHours, shouldShowPriceLevel, isEnhancedLandmark, getRelevantTypes } from '@/utils/landmarkDisplayUtils';
import LandmarkRating from './LandmarkRating';
import OpeningStatus from './OpeningStatus';
import LandmarkTypes from './LandmarkTypes';
import EnhancedBadge from './EnhancedBadge';
import EditorialSummary from './EditorialSummary';

interface EnhancedLandmarkInfoProps {
  landmark: Landmark;
  enhancedData?: EnhancedLandmarkData;
  className?: string;
}

const EnhancedLandmarkInfo: React.FC<EnhancedLandmarkInfoProps> = ({
  landmark,
  enhancedData,
  className = ''
}) => {
  const showRating = enhancedData && shouldShowRating(enhancedData);
  const showHours = enhancedData && shouldShowHours(enhancedData);
  const showPriceLevel = enhancedData && shouldShowPriceLevel(enhancedData);
  const isEnhanced = isEnhancedLandmark(landmark, enhancedData);
  const relevantTypes = getRelevantTypes(enhancedData?.types);

  const getPriceLevelDisplay = (level: number): string => {
    return '$'.repeat(level);
  };

  if (!enhancedData && !isEnhanced) {
    return null; // No enhanced data to display
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with Enhanced Badge */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">{landmark.name}</h3>
        {isEnhanced && <EnhancedBadge />}
      </div>

      {/* Rich Info Section */}
      <div className="flex flex-wrap items-center gap-3">
        {showRating && (
          <LandmarkRating 
            rating={enhancedData.rating!}
            reviewCount={enhancedData.user_ratings_total}
          />
        )}
        
        {showHours && (
          <OpeningStatus isOpen={enhancedData.opening_hours?.open_now} />
        )}
        
        {showPriceLevel && (
          <div className="flex items-center gap-1">
            <span className="text-sm text-gray-400">Price:</span>
            <span className="text-sm text-white font-medium">
              {getPriceLevelDisplay(enhancedData.price_level!)}
            </span>
          </div>
        )}
      </div>

      {/* Place Types */}
      {relevantTypes.length > 0 && (
        <LandmarkTypes types={relevantTypes} />
      )}

      {/* Editorial Summary */}
      {enhancedData?.editorial_summary && (
        <EditorialSummary summary={enhancedData.editorial_summary} />
      )}

      {/* Address */}
      {enhancedData?.formatted_address && (
        <div className="text-xs text-gray-400">
          {enhancedData.formatted_address}
        </div>
      )}

      {/* Website */}
      {enhancedData?.website && (
        <div>
          <a 
            href={enhancedData.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            Visit Website
          </a>
        </div>
      )}
    </div>
  );
};

export default EnhancedLandmarkInfo;
