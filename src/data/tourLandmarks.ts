
export interface TourLandmark {
  name: string;
  coordinates: [number, number];
  description: string;
  placeId?: string;
}

// Mutable array that gets cleared and repopulated for each new tour
export const TOUR_LANDMARKS: TourLandmark[] = [];

// Enhanced function to clear tour landmarks - now only handles GeoJSON layer cleanup
export const clearTourMarkers = () => {
  console.log('🧹 Enhanced clearing of tour landmarks...');
  
  // Clear the landmarks array
  const landmarksCleared = TOUR_LANDMARKS.length;
  TOUR_LANDMARKS.length = 0;
  
  console.log(`🧹 Enhanced cleanup completed: ${landmarksCleared} landmarks cleared from array`);
  console.log('🧹 Note: Tour landmarks are now handled by GeoJSON layer, no individual markers to clean');
};

// Enhanced function to clear and set new tour landmarks
export const setTourLandmarks = (landmarks: TourLandmark[]) => {
  console.log('📍 Enhanced setTourLandmarks called with:', landmarks.length, 'landmarks');
  
  // Clear existing landmarks first
  clearTourMarkers();
  
  // Verify cleanup completed
  if (TOUR_LANDMARKS.length > 0) {
    console.warn('⚠️ TOUR_LANDMARKS array not properly cleared, forcing clear');
    TOUR_LANDMARKS.length = 0;
  }
  
  // Add new landmarks with validation
  const validLandmarks = landmarks.filter(landmark => {
    const isValid = landmark.name && 
      landmark.coordinates && 
      landmark.coordinates.length === 2 &&
      !isNaN(landmark.coordinates[0]) && 
      !isNaN(landmark.coordinates[1]);
    
    if (!isValid) {
      console.warn('⚠️ Invalid landmark filtered out:', landmark);
    }
    
    return isValid;
  });
  
  TOUR_LANDMARKS.push(...validLandmarks);
  console.log('📍 Enhanced tour landmarks set:', validLandmarks.length, 'valid landmarks added');
  
  // Log first few landmarks for verification
  if (validLandmarks.length > 0) {
    console.log('📍 Sample landmarks:', validLandmarks.slice(0, 3).map(l => ({
      name: l.name,
      coordinates: l.coordinates
    })));
  }
};
