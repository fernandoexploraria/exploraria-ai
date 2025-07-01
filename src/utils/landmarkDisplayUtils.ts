
import { Landmark } from '@/data/landmarks';

export interface EnhancedLandmarkData {
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  editorial_summary?: string;
  formatted_address?: string;
  website?: string;
  types?: string[];
  price_level?: number;
  raw_data?: any;
  photos?: any[];
}

// Smart content detection functions
export const shouldShowRating = (data: EnhancedLandmarkData): boolean => {
  return !!(data.rating && data.rating >= 4.0 && data.user_ratings_total);
};

export const shouldShowHours = (data: EnhancedLandmarkData): boolean => {
  // Skip for parks, natural features, and 24/7 places
  const skipTypes = ['park', 'natural_feature', 'establishment', 'point_of_interest'];
  const hasRelevantTypes = data.types?.some(type => 
    !skipTypes.includes(type) && 
    ['restaurant', 'museum', 'store', 'tourist_attraction'].includes(type)
  );
  
  return !!(data.opening_hours && hasRelevantTypes);
};

export const shouldShowPriceLevel = (data: EnhancedLandmarkData): boolean => {
  // Only show for commercial places
  const commercialTypes = ['restaurant', 'store', 'shopping_mall', 'lodging'];
  const hasCommercialType = data.types?.some(type => commercialTypes.includes(type));
  
  return !!(data.price_level && hasCommercialType);
};

export const isEnhancedLandmark = (landmark: Landmark, data?: EnhancedLandmarkData): boolean => {
  // Check if landmark has rich database data
  return !!(
    data?.raw_data || 
    data?.editorial_summary || 
    data?.formatted_address || 
    (landmark as any).tourId // Has tour association
  );
};

export const getRelevantTypes = (types?: string[]): string[] => {
  if (!types) return [];
  
  // Priority order for display
  const priorityTypes = [
    'tourist_attraction',
    'museum', 
    'restaurant',
    'cafe',
    'park',
    'church',
    'shopping_mall',
    'lodging'
  ];
  
  const relevant = types.filter(type => priorityTypes.includes(type));
  return relevant.slice(0, 2); // Max 2 types
};

export const formatEditorialSummary = (summary?: string, maxLength: number = 60): string => {
  if (!summary) return '';
  
  if (summary.length <= maxLength) return summary;
  
  const truncated = summary.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return truncated.substring(0, lastSpace) + '...';
};

export const formatPlaceType = (type: string): string => {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
