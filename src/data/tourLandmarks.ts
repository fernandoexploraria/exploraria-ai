
export interface TourLandmark {
  name: string;
  coordinates: [number, number];
  description: string;
}

// Mutable array that gets cleared and repopulated for each new tour
export const TOUR_LANDMARKS: TourLandmark[] = [];

// Reference to the map instance and layer clearing function - will be set by Map component
let mapRef: { current: mapboxgl.Map | null } | null = null;
let clearTourLayerFunction: (() => void) | null = null;

// Function to set the map reference and clear function from Map component
export const setMapMarkersRef = (
  markersRef: any, // Legacy parameter, kept for compatibility
  popupsRef: any,  // Legacy parameter, kept for compatibility
  mapInstance?: { current: mapboxgl.Map | null },
  clearLayerFn?: () => void
) => {
  mapRef = mapInstance || null;
  clearTourLayerFunction = clearLayerFn || null;
  console.log('🗺️ Map references updated for layer-based system');
};

// Enhanced function to clear tour landmarks using layer system
export const clearTourMarkers = () => {
  console.log('🧹 Enhanced clearing of tour landmarks using layer system...');
  
  // Clear the landmarks array
  const landmarksCleared = TOUR_LANDMARKS.length;
  TOUR_LANDMARKS.length = 0;
  
  // Use the layer clearing function if available
  if (clearTourLayerFunction) {
    clearTourLayerFunction();
    console.log('🧹 Layer-based cleanup completed successfully');
  } else {
    console.log('⚠️ Layer clearing function not available, using array-only cleanup');
  }
  
  console.log(`🧹 Enhanced cleanup completed: ${landmarksCleared} landmarks cleared`);
};

// Enhanced function to clear and set new tour landmarks
export const setTourLandmarks = (landmarks: TourLandmark[]) => {
  console.log('📍 Enhanced setTourLandmarks called with:', landmarks.length, 'landmarks');
  
  // Clear existing landmarks first with verification
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
  
  // Trigger layer update - this will happen automatically via the Map component's useEffect
  console.log('📍 Layer system will auto-update via Map component state changes');
};
