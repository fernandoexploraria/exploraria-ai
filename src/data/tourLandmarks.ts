
export interface TourLandmark {
  // Core identification (using placeId as the unique key)
  placeId: string;                    // Required - primary unique identifier
  id?: string;                        // Optional - for compatibility with Landmark interface
  name: string;
  coordinates: [number, number];
  description: string;
  
  // Google Places data (from tour generation)
  rating?: number;                    // Star rating (1-5)
  photos?: string[];                  // Array of photo URLs
  types?: string[];                   // Place types ['restaurant', 'tourist_attraction']
  formattedAddress?: string;          // Full formatted address
  
  // Tour metadata
  tourId?: string;                    // Reference to generating tour
  
  // Generation quality metrics
  coordinateSource?: string;          // 'google_places' | 'geocoding' | 'fallback'
  confidence?: 'high' | 'medium' | 'low'; // Data quality indicator
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
  
  // Add new landmarks with validation and ensure they have id for compatibility
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
  }).map(landmark => ({
    ...landmark,
    id: landmark.id || landmark.placeId // Use placeId as fallback for id
  }));
  
  TOUR_LANDMARKS.push(...validLandmarks);
  console.log('📍 Enhanced tour landmarks set:', validLandmarks.length, 'valid landmarks added');
  
  // Log first few landmarks for verification
  if (validLandmarks.length > 0) {
    console.log('📍 Sample landmarks:', validLandmarks.slice(0, 3).map(l => ({
      name: l.name,
      coordinates: l.coordinates,
      id: l.id,
      placeId: l.placeId
    })));
  }
};
