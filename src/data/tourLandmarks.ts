
export interface TourLandmark {
  name: string;
  coordinates: [number, number];
  description: string;
}

// Mutable array that gets cleared and repopulated for each new tour
export const TOUR_LANDMARKS: TourLandmark[] = [];

// Reference to the map markers - will be set by Map component
let mapMarkersRef: { current: { [key: string]: any } } | null = null;
let photoPopupsRef: { current: { [key: string]: any } } | null = null;

// Function to set the markers reference from Map component
export const setMapMarkersRef = (markersRef: { current: { [key: string]: any } }, popupsRef: { current: { [key: string]: any } }) => {
  mapMarkersRef = markersRef;
  photoPopupsRef = popupsRef;
};

// Enhanced function to clear tour markers from map and array
export const clearTourMarkers = () => {
  console.log('🧹 Enhanced clearing of tour markers from map...');
  
  let markersRemoved = 0;
  let popupsRemoved = 0;
  
  if (mapMarkersRef?.current) {
    // Find and remove all tour landmarks from the map
    Object.keys(mapMarkersRef.current).forEach(markerId => {
      if (markerId.startsWith('tour-landmark-')) {
        console.log('🗑️ Removing map marker:', markerId);
        try {
          // Remove marker from map
          mapMarkersRef.current[markerId].remove();
          // Delete from markers ref
          delete mapMarkersRef.current[markerId];
          markersRemoved++;
        } catch (error) {
          console.warn('⚠️ Error removing marker:', markerId, error);
        }
      }
    });
  }
  
  if (photoPopupsRef?.current) {
    // Close any open popups for tour landmarks
    Object.keys(photoPopupsRef.current).forEach(popupId => {
      if (popupId.startsWith('tour-landmark-')) {
        console.log('🗑️ Removing popup:', popupId);
        try {
          photoPopupsRef.current[popupId].remove();
          delete photoPopupsRef.current[popupId];
          popupsRemoved++;
        } catch (error) {
          console.warn('⚠️ Error removing popup:', popupId, error);
        }
      }
    });
  }
  
  // Clear the landmarks array
  const landmarksCleared = TOUR_LANDMARKS.length;
  TOUR_LANDMARKS.length = 0;
  
  console.log(`🧹 Enhanced cleanup completed: ${markersRemoved} markers, ${popupsRemoved} popups, ${landmarksCleared} landmarks cleared`);
};

// Enhanced function to clear and set new tour landmarks
export const setTourLandmarks = (landmarks: TourLandmark[]) => {
  console.log('📍 Enhanced setTourLandmarks called with:', landmarks.length, 'landmarks');
  
  // Clear existing landmarks and markers first with verification
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
