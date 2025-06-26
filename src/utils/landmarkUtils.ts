
import { Landmark } from '@/data/landmarks';
import { TopLandmark } from '@/data/topLandmarks';
import { TourLandmark } from '@/data/tourLandmarks';

export interface ValidatedLandmark extends Landmark {
  location: {
    lat: number;
    lng: number;
  };
}

// Utility function to validate and normalize landmarks
export const validateAndNormalizeLandmark = (landmark: any): ValidatedLandmark | null => {
  try {
    // Check if we have coordinates
    if (!landmark.coordinates || !Array.isArray(landmark.coordinates) || landmark.coordinates.length !== 2) {
      console.warn('Invalid landmark coordinates:', landmark);
      return null;
    }

    const [lng, lat] = landmark.coordinates;
    
    // Validate coordinates are numbers
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) {
      console.warn('Invalid coordinate values:', { lng, lat }, landmark);
      return null;
    }

    // Validate coordinate ranges
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      console.warn('Coordinates out of valid range:', { lng, lat }, landmark);
      return null;
    }

    return {
      id: landmark.id || `landmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: landmark.name || 'Unknown Location',
      coordinates: [lng, lat],
      location: {
        lat: lat,
        lng: lng
      },
      description: landmark.description || 'No description available',
      placeId: landmark.placeId
    };
  } catch (error) {
    console.error('Error validating landmark:', error, landmark);
    return null;
  }
};

// Convert TopLandmark to ValidatedLandmark
export const convertTopLandmarkToLandmark = (topLandmark: TopLandmark): ValidatedLandmark | null => {
  const baseLandmark = {
    id: `top-${topLandmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: topLandmark.name,
    coordinates: topLandmark.coordinates,
    description: topLandmark.description
  };
  
  return validateAndNormalizeLandmark(baseLandmark);
};

// Convert TourLandmark to ValidatedLandmark
export const convertTourLandmarkToLandmark = (tourLandmark: TourLandmark): ValidatedLandmark | null => {
  const baseLandmark = {
    id: `tour-landmark-${tourLandmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: tourLandmark.name,
    coordinates: tourLandmark.coordinates,
    description: tourLandmark.description
  };
  
  return validateAndNormalizeLandmark(baseLandmark);
};

// Filter and validate an array of landmarks
export const validateLandmarkArray = (landmarks: any[]): ValidatedLandmark[] => {
  const validLandmarks: ValidatedLandmark[] = [];
  
  landmarks.forEach((landmark, index) => {
    const validated = validateAndNormalizeLandmark(landmark);
    if (validated) {
      validLandmarks.push(validated);
    } else {
      console.warn(`Skipping invalid landmark at index ${index}:`, landmark);
    }
  });
  
  console.log(`Validated ${validLandmarks.length} out of ${landmarks.length} landmarks`);
  return validLandmarks;
};
