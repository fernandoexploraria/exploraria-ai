
import { MapPin, Camera, TreePine, Building } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface PlaceTypeIconResult {
  icon: LucideIcon;
  color: string;
  priority: number;
}

export const getPlaceTypeIcon = (types: string[]): PlaceTypeIconResult => {
  // Priority order: locality > sublocality > tourist_attraction > park > museum > default
  
  // Check for locality/administrative areas (highest priority)
  if (types.some(type => ['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'country'].includes(type))) {
    return {
      icon: MapPin,
      color: 'text-blue-600',
      priority: 1
    };
  }
  
  // Check for sublocality/neighborhoods (second priority)
  if (types.some(type => ['sublocality', 'neighborhood', 'sublocality_level_1'].includes(type))) {
    return {
      icon: MapPin,
      color: 'text-blue-500',
      priority: 2
    };
  }
  
  // Check for tourist attractions (third priority)
  if (types.some(type => ['tourist_attraction', 'point_of_interest', 'establishment'].includes(type))) {
    return {
      icon: Camera,
      color: 'text-purple-600',
      priority: 3
    };
  }
  
  // Check for parks/nature (fourth priority)
  if (types.some(type => ['park', 'natural_feature', 'campground'].includes(type))) {
    return {
      icon: TreePine,
      color: 'text-green-600',
      priority: 4
    };
  }
  
  // Check for museums/cultural institutions (fifth priority)
  if (types.some(type => ['museum', 'library', 'university', 'school'].includes(type))) {
    return {
      icon: Building,
      color: 'text-amber-600',
      priority: 5
    };
  }
  
  // Default fallback
  return {
    icon: MapPin,
    color: 'text-gray-500',
    priority: 6
  };
};

export const getPlaceTypeLabel = (types: string[]): string => {
  if (types.some(type => ['locality', 'administrative_area_level_1'].includes(type))) {
    return 'City';
  }
  if (types.some(type => ['sublocality', 'neighborhood'].includes(type))) {
    return 'Area';
  }
  if (types.some(type => ['tourist_attraction'].includes(type))) {
    return 'Attraction';
  }
  if (types.some(type => ['park'].includes(type))) {
    return 'Park';
  }
  if (types.some(type => ['museum'].includes(type))) {
    return 'Museum';
  }
  return 'Place';
};
