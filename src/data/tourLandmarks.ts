
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

// Callback to notify when landmarks change
let landmarksChangeCallback: (() => void) | null = null;

// Function to set the markers reference from Map component
export const setMapMarkersRef = (markersRef: { current: { [key: string]: any } }, popupsRef: { current: { [key: string]: any } }) => {
  mapMarkersRef = markersRef;
  photoPopupsRef = popupsRef;
};

// Function to set change callback
export const setLandmarksChangeCallback = (callback: () => void) => {
  landmarksChangeCallback = callback;
};

// Function to notify about changes
const notifyLandmarksChange = () => {
  if (landmarksChangeCallback) {
    landmarksChangeCallback();
  }
};

// Function to clear tour markers from map and array
export const clearTourMarkers = () => {
  console.log('🧹 Clearing tour markers from map and state...');
  
  if (mapMarkersRef?.current) {
    // Find and remove all tour landmarks from the map
    Object.keys(mapMarkersRef.current).forEach(markerId => {
      if (markerId.startsWith('tour-landmark-')) {
        console.log('Removing map marker:', markerId);
        // Remove marker from map
        mapMarkersRef.current[markerId].remove();
        // Delete from markers ref
        delete mapMarkersRef.current[markerId];
      }
    });
  }
  
  if (photoPopupsRef?.current) {
    // Close any open popups for tour landmarks
    Object.keys(photoPopupsRef.current).forEach(popupId => {
      if (popupId.startsWith('tour-landmark-')) {
        console.log('Removing popup:', popupId);
        photoPopupsRef.current[popupId].remove();
        delete photoPopupsRef.current[popupId];
      }
    });
  }
  
  // Clear the landmarks array
  const previousLength = TOUR_LANDMARKS.length;
  TOUR_LANDMARKS.length = 0;
  
  console.log(`🧹 Tour landmarks cleared: ${previousLength} → ${TOUR_LANDMARKS.length}`);
  
  // Notify about the change
  notifyLandmarksChange();
};

// Function to clear and set new tour landmarks
export const setTourLandmarks = (landmarks: TourLandmark[]) => {
  console.log('🎯 Setting new tour landmarks:', landmarks.length);
  
  // Clear existing landmarks and markers first
  clearTourMarkers();
  
  // Add new landmarks
  TOUR_LANDMARKS.push(...landmarks);
  
  console.log(`🎯 Tour landmarks updated: 0 → ${TOUR_LANDMARKS.length}`);
  console.log('🎯 New landmarks:', TOUR_LANDMARKS.map(l => l.name));
  
  // Notify about the change
  notifyLandmarksChange();
};
