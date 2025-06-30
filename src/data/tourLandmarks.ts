
import { generateTourLandmarkId } from '@/utils/markerIdUtils';

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

// FIXED: Array-driven cleanup - removes markers by exact IDs from the current array
export const clearTourMarkers = async () => {
  if (isCleanupInProgress) {
    console.log('🔄 Cleanup already in progress, skipping duplicate call');
    return;
  }

  isCleanupInProgress = true;
  console.log('🧹 ARRAY-DRIVEN: Starting enhanced clearing - using exact IDs from array...');
  
  let markersRemoved = 0;
  let popupsRemoved = 0;
  const landmarksBeforeCleanup = TOUR_LANDMARKS.length;

  // STEP 1: Remove markers from map using exact IDs from current array
  if (mapMarkersRef?.current && TOUR_LANDMARKS.length > 0) {
    console.log('🗑️ STEP 1: Removing markers by exact IDs from array...');
    
    TOUR_LANDMARKS.forEach((landmark, index) => {
      const markerId = generateTourLandmarkId(index);
      console.log('🗑️ Attempting to remove marker with ID:', markerId);
      
      if (mapMarkersRef.current[markerId]) {
        try {
          console.log('✅ Found and removing marker:', markerId);
          mapMarkersRef.current[markerId].remove();
          delete mapMarkersRef.current[markerId];
          markersRemoved++;
        } catch (error) {
          console.warn('⚠️ Error removing marker:', markerId, error);
        }
      } else {
        console.warn('⚠️ Marker not found in map:', markerId);
      }
    });
  }
  
  // STEP 2: Close popups using exact IDs from current array
  if (photoPopupsRef?.current && TOUR_LANDMARKS.length > 0) {
    console.log('🗑️ STEP 2: Removing popups by exact IDs from array...');
    
    TOUR_LANDMARKS.forEach((landmark, index) => {
      const popupId = generateTourLandmarkId(index);
      console.log('🗑️ Attempting to remove popup with ID:', popupId);
      
      if (photoPopupsRef.current[popupId]) {
        try {
          console.log('✅ Found and removing popup:', popupId);
          photoPopupsRef.current[popupId].remove();
          delete photoPopupsRef.current[popupId];
          popupsRemoved++;
        } catch (error) {
          console.warn('⚠️ Error removing popup:', popupId, error);
        }
      } else {
        console.warn('⚠️ Popup not found:', popupId);
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
  const remainingTourMarkers = mapMarkersRef?.current ? 
    Object.keys(mapMarkersRef.current).filter(id => id.startsWith('tour-landmark-')).length : 0;
  
  console.log(`🧹 ARRAY-DRIVEN cleanup completed: ${markersRemoved} markers, ${popupsRemoved} popups, ${landmarksBeforeCleanup} landmarks cleared, ${remainingTourMarkers} tour markers remaining`);
  
  if (remainingTourMarkers > 0) {
    console.warn('⚠️ Some tour markers may still exist on map:', remainingTourMarkers);
    // Log remaining marker IDs for debugging
    const remainingIds = Object.keys(mapMarkersRef.current).filter(id => id.startsWith('tour-landmark-'));
    console.warn('⚠️ Remaining tour marker IDs:', remainingIds);
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
