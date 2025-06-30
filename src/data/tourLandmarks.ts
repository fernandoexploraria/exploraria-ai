
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

// Flag to prevent race conditions during cleanup
let isCleanupInProgress = false;

// Function to set the markers reference from Map component
export const setMapMarkersRef = (markersRef: { current: { [key: string]: any } }, popupsRef: { current: { [key: string]: any } }) => {
  mapMarkersRef = markersRef;
  photoPopupsRef = popupsRef;
};

// Enhanced function to clear tour markers from map and array - FIXED ORDER
export const clearTourMarkers = async () => {
  if (isCleanupInProgress) {
    console.log('🔄 Cleanup already in progress, skipping duplicate call');
    return;
  }

  isCleanupInProgress = true;
  console.log('🧹 FIXED: Starting enhanced clearing - markers FIRST, then array...');
  
  let markersRemoved = 0;
  let popupsRemoved = 0;
  const landmarksBeforeCleanup = TOUR_LANDMARKS.length;

  // STEP 1: Remove markers from map FIRST (before clearing array)
  if (mapMarkersRef?.current) {
    console.log('🗑️ STEP 1: Removing markers from map...');
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
  
  // STEP 2: Close popups
  if (photoPopupsRef?.current) {
    console.log('🗑️ STEP 2: Removing popups...');
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
  
  // STEP 3: Small delay to ensure map cleanup completes before array clear
  console.log('⏱️ STEP 3: Waiting for map cleanup to complete...');
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // STEP 4: Clear the landmarks array LAST
  console.log('🗑️ STEP 4: Clearing landmarks array...');
  TOUR_LANDMARKS.length = 0;
  
  // Verify cleanup completed
  const remainingMarkers = mapMarkersRef?.current ? 
    Object.keys(mapMarkersRef.current).filter(id => id.startsWith('tour-landmark-')).length : 0;
  
  console.log(`🧹 FIXED cleanup completed: ${markersRemoved} markers, ${popupsRemoved} popups, ${landmarksBeforeCleanup} landmarks cleared, ${remainingMarkers} markers remaining`);
  
  if (remainingMarkers > 0) {
    console.warn('⚠️ Some tour markers may still exist on map:', remainingMarkers);
  }
  
  isCleanupInProgress = false;
};

// Enhanced function to clear and set new tour landmarks
export const setTourLandmarks = async (landmarks: TourLandmark[]) => {
  console.log('📍 Enhanced setTourLandmarks called with:', landmarks.length, 'landmarks');
  
  // Clear existing landmarks and markers first with verification
  await clearTourMarkers();
  
  // Double-check cleanup completed
  if (TOUR_LANDMARKS.length > 0) {
    console.warn('⚠️ TOUR_LANDMARKS array not properly cleared after cleanup, forcing clear');
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
