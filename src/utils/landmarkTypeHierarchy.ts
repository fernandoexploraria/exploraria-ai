// Utility for determining landmark types based on destination type hierarchy

export const getHierarchicalLandmarkTypes = (destinationTypes: string[]): string[] => {
  // Google Places API allows MAXIMUM 5 types and only specific valid types
  // Reference: https://developers.google.com/maps/documentation/places/web-service/place-types
  
  console.log('🏛️ Input destination types:', destinationTypes);
  
  // Determine destination level and return appropriate LIMITED types (max 5)
  const hasLocality = destinationTypes.includes('locality') || destinationTypes.includes('administrative_area_level_1');
  const hasSublocality = destinationTypes.includes('sublocality') || destinationTypes.includes('administrative_area_level_2');
  const hasTouristAttraction = destinationTypes.includes('tourist_attraction') || destinationTypes.includes('point_of_interest');
  const hasPark = destinationTypes.includes('park');
  const hasMuseum = destinationTypes.includes('museum');

  let hierarchicalTypes: string[] = [];

  // If destination is locality level, include broader search types
  if (hasLocality) {
    hierarchicalTypes = ['tourist_attraction', 'point_of_interest', 'establishment', 'park', 'museum'];
  }
  // If destination is sublocality level, focus on attractions and establishments
  else if (hasSublocality) {
    hierarchicalTypes = ['tourist_attraction', 'point_of_interest', 'establishment', 'restaurant', 'park'];
  }
  // If destination is tourist attraction level, focus on nearby points of interest
  else if (hasTouristAttraction) {
    hierarchicalTypes = ['point_of_interest', 'establishment', 'restaurant', 'park', 'museum'];
  }
  // If destination is park level, focus on specific nearby amenities
  else if (hasPark) {
    hierarchicalTypes = ['point_of_interest', 'establishment', 'restaurant', 'cafe', 'museum'];
  }
  // If destination is museum level, focus on cultural and dining nearby
  else if (hasMuseum) {
    hierarchicalTypes = ['point_of_interest', 'establishment', 'restaurant', 'cafe', 'park'];
  }
  // Fallback for any other destination type
  else {
    hierarchicalTypes = ['tourist_attraction', 'point_of_interest', 'establishment', 'restaurant', 'park'];
  }
  
  console.log('🏛️ Hierarchical landmark types (max 5):', hierarchicalTypes);
  
  return hierarchicalTypes;
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