
import { MapPin, Camera, TreePine, Building } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface PlaceTypeIconResult {
  icon: LucideIcon;
  color: string;
  priority: number;
}

export const getPlaceTypeIcon = (types: string[], name?: string): PlaceTypeIconResult => {
  console.log('🔍 Icon matching for:', name || 'unnamed place');
  console.log('🔍 Types to match:', types);
  
  // Priority order: locality > sublocality > park > tourist_attraction > museum > default
  
  // Check for locality/administrative areas (highest priority)
  if (types.some(type => ['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'country'].includes(type))) {
    console.log('🏙️ Matched as locality/city');
    return {
      icon: MapPin,
      color: 'text-blue-600',
      priority: 1
    };
  }
  
  // Check for sublocality/neighborhoods (second priority)
  if (types.some(type => ['sublocality', 'neighborhood', 'sublocality_level_1'].includes(type))) {
    console.log('🏘️ Matched as sublocality/neighborhood');
    return {
      icon: MapPin,
      color: 'text-blue-500',
      priority: 2
    };
  }
  
  // ENHANCED: Check for parks/nature with expanded type matching and name fallback
  const parkTypes = ['park', 'natural_feature', 'campground', 'rv_park'];
  const hasExplicitParkType = types.some(type => parkTypes.includes(type));
  
  // Name-based park detection as fallback
  const nameIndicatesPark = name && /park|parque|jardín|garden|verde|bosque|forest|plaza|square/i.test(name);
  
  // Enhanced park detection: explicit type OR name pattern + establishment/point_of_interest
  const isParkByType = hasExplicitParkType;
  const isParkByName = nameIndicatesPark && types.some(type => ['establishment', 'point_of_interest'].includes(type));
  
  if (isParkByType || isParkByName) {
    console.log('🌳 Matched as PARK - Method:', isParkByType ? 'by type' : 'by name pattern');
    console.log('🌳 Park types found:', types.filter(t => parkTypes.includes(t)));
    if (isParkByName) console.log('🌳 Park name pattern detected in:', name);
    
    return {
      icon: TreePine,
      color: 'text-green-600',
      priority: 3
    };
  }
  
  // Check for tourist attractions (fourth priority - moved down to allow parks precedence)
  if (types.some(type => ['tourist_attraction', 'point_of_interest', 'establishment'].includes(type))) {
    // Additional check: if it's not already classified as park and has attraction-like name
    const attractionKeywords = /museum|gallery|monument|statue|memorial|cathedral|church|temple|palace|castle|theater|theatre|stadium|arena/i;
    const nameIndicatesAttraction = name && attractionKeywords.test(name);
    
    if (nameIndicatesAttraction || types.includes('tourist_attraction')) {
      console.log('📷 Matched as tourist attraction');
      return {
        icon: Camera,
        color: 'text-purple-600',
        priority: 4
      };
    }
  }
  
  // Check for museums/cultural institutions (fifth priority)
  if (types.some(type => ['museum', 'library', 'university', 'school', 'art_gallery'].includes(type))) {
    console.log('🏛️ Matched as museum/cultural institution');
    return {
      icon: Building,
      color: 'text-amber-600',
      priority: 5
    };
  }
  
  // Default fallback
  console.log('📍 Using default icon - no specific match found');
  return {
    icon: MapPin,
    color: 'text-gray-500',
    priority: 6
  };
};

export const getPlaceTypeLabel = (types: string[], name?: string): string => {
  // Use the same enhanced logic for label determination
  if (types.some(type => ['locality', 'administrative_area_level_1'].includes(type))) {
    return 'City';
  }
  if (types.some(type => ['sublocality', 'neighborhood'].includes(type))) {
    return 'Area';
  }
  
  // Enhanced park detection for labels too
  const parkTypes = ['park', 'natural_feature', 'campground'];
  const hasExplicitParkType = types.some(type => parkTypes.includes(type));
  const nameIndicatesPark = name && /park|parque|jardín|garden|verde|bosque/i.test(name);
  const isParkByName = nameIndicatesPark && types.some(type => ['establishment', 'point_of_interest'].includes(type));
  
  if (hasExplicitParkType || isParkByName) {
    return 'Park';
  }
  
  if (types.some(type => ['tourist_attraction'].includes(type))) {
    return 'Attraction';
  }
  if (types.some(type => ['museum', 'art_gallery'].includes(type))) {
    return 'Museum';
  }
  return 'Place';
};
