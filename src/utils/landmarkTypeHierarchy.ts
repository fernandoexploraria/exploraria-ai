// Utility for determining landmark types based on destination type hierarchy

export const getHierarchicalLandmarkTypes = (destinationTypes: string[]): string[] => {
  // Base granular types that are always included for landmarks
  const baseGranularTypes = [
    'restaurant', 'cafe', 'bar', 'bakery',
    'art_gallery', 'book_store', 'shopping_mall', 'store',
    'historic_site', 'statue', 'monument',
    'church', 'synagogue', 'mosque', 'hindu_temple', 'place_of_worship',
    'square', 'zoo', 'aquarium', 'amusement_park',
    'convenience_store', 'pharmacy', 'gas_station',
    'subway_station', 'bus_station', 'train_station', 'transit_station',
    'hospital', 'school', 'university', 'library',
    'hotel', 'lodging', 'travel_agency',
    'bank', 'atm', 'post_office',
    'gym', 'spa', 'beauty_salon',
    'night_club', 'movie_theater', 'bowling_alley'
  ];

  // Hierarchical types based on destination level
  const hierarchicalTypes: string[] = [];

  // Determine destination level and add appropriate hierarchical types
  const hasLocality = destinationTypes.includes('locality') || destinationTypes.includes('administrative_area_level_1');
  const hasSublocality = destinationTypes.includes('sublocality') || destinationTypes.includes('administrative_area_level_2');
  const hasTouristAttraction = destinationTypes.includes('tourist_attraction') || destinationTypes.includes('point_of_interest');
  const hasPark = destinationTypes.includes('park');
  const hasMuseum = destinationTypes.includes('museum');

  // If destination is locality level, include all hierarchical types
  if (hasLocality) {
    hierarchicalTypes.push('locality', 'sublocality', 'tourist_attraction', 'park', 'museum', 'establishment', 'point_of_interest');
  }
  // If destination is sublocality level, exclude locality but include rest
  else if (hasSublocality) {
    hierarchicalTypes.push('sublocality', 'tourist_attraction', 'park', 'museum', 'establishment', 'point_of_interest');
  }
  // If destination is tourist attraction level, exclude locality and sublocality
  else if (hasTouristAttraction) {
    hierarchicalTypes.push('tourist_attraction', 'park', 'museum', 'establishment', 'point_of_interest');
  }
  // If destination is park level, exclude broader geographic types
  else if (hasPark) {
    hierarchicalTypes.push('park', 'museum', 'establishment', 'point_of_interest');
  }
  // If destination is museum level, include only specific types
  else if (hasMuseum) {
    hierarchicalTypes.push('museum', 'establishment', 'point_of_interest');
  }
  // Fallback for any other destination type
  else {
    hierarchicalTypes.push('establishment', 'point_of_interest', 'tourist_attraction');
  }

  // Combine hierarchical types with base granular types, removing duplicates
  const allTypes = [...new Set([...hierarchicalTypes, ...baseGranularTypes])];
  
  console.log('🏛️ Landmark types for destination types', destinationTypes, ':', allTypes);
  
  return allTypes;
};

// Helper function to calculate distance between two coordinates (for UX)
export const calculateDistance = (
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
};