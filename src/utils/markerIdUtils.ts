
export interface TourLandmark {
  name: string;
  coordinates: [number, number];
  description: string;
}

/**
 * Generates a consistent ID for tour landmarks
 * Uses both index and sanitized name for uniqueness and debugging
 */
export const generateTourLandmarkId = (landmark: TourLandmark, index: number): string => {
  const sanitizedName = landmark.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `tour-landmark-${index}-${sanitizedName}`;
};

/**
 * Generates popup ID for tour landmarks (same as marker ID for consistency)
 */
export const generateTourPopupId = (landmark: TourLandmark, index: number): string => {
  return generateTourLandmarkId(landmark, index);
};

/**
 * Extracts the index from a tour landmark ID for debugging purposes
 */
export const extractIndexFromTourId = (markerId: string): number | null => {
  const match = markerId.match(/^tour-landmark-(\d+)-/);
  return match ? parseInt(match[1], 10) : null;
};
