
export interface TourLandmark {
  name: string;
  coordinates: [number, number];
  description: string;
}

// Mutable array that gets cleared and repopulated for each new tour
export const TOUR_LANDMARKS: TourLandmark[] = [];

// Function to clear and set new tour landmarks
export const setTourLandmarks = (landmarks: TourLandmark[]) => {
  // Clear existing landmarks
  TOUR_LANDMARKS.length = 0;
  // Add new landmarks
  TOUR_LANDMARKS.push(...landmarks);
};

// Function to clear tour landmarks
export const clearTourLandmarks = () => {
  TOUR_LANDMARKS.length = 0;
};
