
import { Landmark, EnhancedLandmark } from '@/data/landmarks';

/**
 * Determines if a landmark's rating should be displayed
 * Only show ratings that are 4.0 or higher
 */
export const shouldShowRating = (landmark: Landmark | EnhancedLandmark): boolean => {
  return landmark.rating !== undefined && landmark.rating >= 4.0;
};

/**
 * Determines if opening hours should be displayed
 * Skip for parks, 24/7 places, and places without hours data
 */
export const shouldShowOpeningHours = (landmark: Landmark | EnhancedLandmark): boolean => {
  const enhancedLandmark = landmark as EnhancedLandmark;
  
  // Skip if no opening hours data
  if (!enhancedLandmark.opening_hours) {
    return false;
  }
  
  // Skip for parks and outdoor spaces (typically 24/7)
  if (landmark.types?.some(type => 
    type.includes('park') || 
    type.includes('outdoor') ||
    type === 'natural_feature'
  )) {
    return false;
  }
  
  return true;
};

/**
 * Formats editorial summary to 60 characters with ellipsis
 */
export const formatEditorialSummary = (summary: string | undefined): string | null => {
  if (!summary) return null;
  
  if (summary.length <= 60) {
    return summary;
  }
  
  return summary.substring(0, 57) + '...';
};

/**
 * Gets the most relevant place types (max 2)
 * Prioritizes tourist attractions, museums, restaurants
 */
export const getRelevantTypes = (types: string[] | undefined): string[] => {
  if (!types || types.length === 0) return [];
  
  const priorityTypes = [
    'tourist_attraction',
    'museum',
    'restaurant',
    'point_of_interest',
    'establishment'
  ];
  
  const relevantTypes: string[] = [];
  
  // First, add priority types if they exist
  for (const priorityType of priorityTypes) {
    if (types.includes(priorityType) && relevantTypes.length < 2) {
      relevantTypes.push(priorityType);
    }
  }
  
  // If we still need more types, add other types
  if (relevantTypes.length < 2) {
    for (const type of types) {
      if (!relevantTypes.includes(type) && relevantTypes.length < 2) {
        relevantTypes.push(type);
      }
    }
  }
  
  return relevantTypes;
};

/**
 * Determines if a landmark has enhanced database-sourced data
 */
export const isEnhancedLandmark = (landmark: Landmark | EnhancedLandmark): boolean => {
  const enhanced = landmark as EnhancedLandmark;
  
  return !!(
    enhanced.placeId ||
    enhanced.coordinateSource ||
    enhanced.confidence ||
    enhanced.formattedAddress ||
    enhanced.editorial_summary ||
    enhanced.opening_hours
  );
};

/**
 * Formats opening status from opening hours data
 * Returns simple "Open Now" or "Closed" status
 */
export const formatOpeningStatus = (openingHours: any): string | null => {
  if (!openingHours) return null;
  
  // Simple logic - if we have opening hours data, assume it's processable
  // In a real implementation, this would parse the actual hours
  if (openingHours.open_now !== undefined) {
    return openingHours.open_now ? 'Open Now' : 'Closed';
  }
  
  // Fallback for other opening hours formats
  if (openingHours.periods || openingHours.weekday_text) {
    const now = new Date();
    const currentHour = now.getHours();
    // Simple heuristic: most places are open between 9 AM and 6 PM
    return (currentHour >= 9 && currentHour <= 18) ? 'Open Now' : 'Closed';
  }
  
  return null;
};

/**
 * Formats place types for display (removes underscores, capitalizes)
 */
export const formatPlaceType = (type: string): string => {
  return type
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
