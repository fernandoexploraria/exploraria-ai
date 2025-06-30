
import { generateTourLandmarkId, generateTourPopupId } from '@/utils/markerIdUtils';

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
  console.log('📍 Map markers reference set for tour landmarks management');
};

// Enhanced array-driven individual marker cleanup function with fallback
export const clearTourMarkers = () => {
  console.log('🧹 Starting array-driven individual marker cleanup...');
  console.log('📊 Landmarks to process:', TOUR_LANDMARKS.length);
  console.log('📊 Current markers in mapMarkersRef:', mapMarkersRef?.current ? Object.keys(mapMarkersRef.current).length : 'NO_REF');
  console.log('📊 Current popups in photoPopupsRef:', photoPopupsRef?.current ? Object.keys(photoPopupsRef.current).length : 'NO_REF');
  
  let markersRemoved = 0;
  let popupsRemoved = 0;
  let markersNotFound = 0;
  let popupsNotFound = 0;
  
  // STEP 1: Remove each marker individually by exact ID BEFORE clearing the array
  TOUR_LANDMARKS.forEach((landmark, index) => {
    const markerId = generateTourLandmarkId(landmark, index);
    const popupId = generateTourPopupId(landmark, index);
    
    console.log(`🎯 Processing landmark ${index}: "${landmark.name}" with ID: ${markerId}`);
    
    // Remove specific marker by exact ID
    if (mapMarkersRef?.current?.[markerId]) {
      try {
        console.log(`🗑️ Removing marker: ${markerId}`);
        mapMarkersRef.current[markerId].remove();
        delete mapMarkersRef.current[markerId];
        markersRemoved++;
        console.log(`✅ Successfully removed marker: ${markerId}`);
      } catch (error) {
        console.warn(`⚠️ Error removing marker ${markerId}:`, error);
      }
    } else {
      console.log(`❌ Marker not found in map: ${markerId}`);
      markersNotFound++;
    }
    
    // Remove specific popup by exact ID
    if (photoPopupsRef?.current?.[popupId]) {
      try {
        console.log(`🗑️ Removing popup: ${popupId}`);
        photoPopupsRef.current[popupId].remove();
        delete photoPopupsRef.current[popupId];
        popupsRemoved++;
        console.log(`✅ Successfully removed popup: ${popupId}`);
      } catch (error) {
        console.warn(`⚠️ Error removing popup ${popupId}:`, error);
      }
    } else {
      console.log(`❌ Popup not found in map: ${popupId}`);
      popupsNotFound++;
    }
  });
  
  // STEP 2: Fallback cleanup - check for any remaining tour markers using pattern matching
  if (mapMarkersRef?.current) {
    console.log('🔍 Running fallback cleanup for any remaining tour markers...');
    const remainingMarkerKeys = Object.keys(mapMarkersRef.current);
    const tourMarkerKeys = remainingMarkerKeys.filter(key => key.startsWith('tour-landmark-'));
    
    console.log(`🔍 Found ${tourMarkerKeys.length} remaining tour markers in fallback`);
    
    tourMarkerKeys.forEach(markerId => {
      try {
        console.log(`🧹 Fallback removing marker: ${markerId}`);
        mapMarkersRef.current![markerId].remove();
        delete mapMarkersRef.current![markerId];
        markersRemoved++;
        console.log(`✅ Fallback removed marker: ${markerId}`);
      } catch (error) {
        console.warn(`⚠️ Error in fallback marker removal ${markerId}:`, error);
      }
    });
  }
  
  // STEP 3: Fallback cleanup for popups
  if (photoPopupsRef?.current) {
    console.log('🔍 Running fallback cleanup for any remaining tour popups...');
    const remainingPopupKeys = Object.keys(photoPopupsRef.current);
    const tourPopupKeys = remainingPopupKeys.filter(key => key.startsWith('tour-landmark-'));
    
    console.log(`🔍 Found ${tourPopupKeys.length} remaining tour popups in fallback`);
    
    tourPopupKeys.forEach(popupId => {
      try {
        console.log(`🧹 Fallback removing popup: ${popupId}`);
        photoPopupsRef.current![popupId].remove();
        delete photoPopupsRef.current![popupId];
        popupsRemoved++;
        console.log(`✅ Fallback removed popup: ${popupId}`);
      } catch (error) {
        console.warn(`⚠️ Error in fallback popup removal ${popupId}:`, error);
      }
    });
  }
  
  // STEP 4: Clear the landmarks array AFTER all markers are processed
  const landmarksCleared = TOUR_LANDMARKS.length;
  TOUR_LANDMARKS.length = 0;
  
  // STEP 5: Verification and detailed logging
  console.log(`🧹 Array-driven cleanup completed!`);
  console.log(`📊 Cleanup Summary:`);
  console.log(`   - Landmarks processed: ${landmarksCleared}`);
  console.log(`   - Markers removed: ${markersRemoved}`);
  console.log(`   - Markers not found: ${markersNotFound}`);
  console.log(`   - Popups removed: ${popupsRemoved}`);
  console.log(`   - Popups not found: ${popupsNotFound}`);
  
  // Final verification
  if (mapMarkersRef?.current) {
    const remainingTourMarkers = Object.keys(mapMarkersRef.current).filter(key => key.startsWith('tour-landmark-'));
    if (remainingTourMarkers.length > 0) {
      console.warn(`⚠️ ${remainingTourMarkers.length} tour markers still remain:`, remainingTourMarkers);
    } else {
      console.log(`✅ All tour markers successfully removed from map`);
    }
  }
  
  // Verify complete cleanup
  if (TOUR_LANDMARKS.length === 0) {
    console.log(`✅ TOUR_LANDMARKS array successfully cleared`);
  } else {
    console.warn(`⚠️ TOUR_LANDMARKS array not properly cleared, forcing clear`);
    TOUR_LANDMARKS.length = 0;
  }
};

// Enhanced function to clear and set new tour landmarks with consistent ID generation
export const setTourLandmarks = (landmarks: TourLandmark[]) => {
  console.log('📍 setTourLandmarks called with:', landmarks.length, 'landmarks');
  
  // STEP 1: Clear existing landmarks and markers first using array-driven approach
  clearTourMarkers();
  
  // STEP 2: Verify cleanup completed
  if (TOUR_LANDMARKS.length > 0) {
    console.warn('⚠️ TOUR_LANDMARKS array not properly cleared after clearTourMarkers, forcing clear');
    TOUR_LANDMARKS.length = 0;
  }
  
  // STEP 3: Validate and add new landmarks
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
  
  // STEP 4: Add landmarks to array (markers will be created by Map component)
  TOUR_LANDMARKS.push(...validLandmarks);
  console.log('📍 Tour landmarks set:', validLandmarks.length, 'valid landmarks added');
  
  // STEP 5: Log landmark IDs that will be created
  if (validLandmarks.length > 0) {
    console.log('📍 Landmark IDs that will be created:');
    validLandmarks.forEach((landmark, index) => {
      const markerId = generateTourLandmarkId(landmark, index);
      console.log(`   ${index}: ${markerId} (${landmark.name})`);
    });
  }
};
