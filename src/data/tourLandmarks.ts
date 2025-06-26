
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

// Function to clear tour markers from map and array
export const clearTourMarkers = () => {
  console.log('Clearing tour markers from map...');
  
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
  TOUR_LANDMARKS.length = 0;
  console.log('Tour landmarks array cleared');
};

// Function to clear and set new tour landmarks with coordinate validation
export const setTourLandmarks = (landmarks: TourLandmark[]) => {
  // Clear existing landmarks and markers first
  clearTourMarkers();
  
  // Validate and filter landmarks with proper coordinates
  const validLandmarks = landmarks.filter(landmark => {
    const [lng, lat] = landmark.coordinates;
    const isValid = typeof lng === 'number' && typeof lat === 'number' && 
                   lng !== 0 && lat !== 0 && 
                   lng >= -180 && lng <= 180 && 
                   lat >= -90 && lat <= 90;
    
    if (!isValid) {
      console.warn('🚫 Filtering out landmark with invalid coordinates:', {
        name: landmark.name,
        coordinates: landmark.coordinates,
        types: [typeof lng, typeof lat]
      });
    } else {
      console.log('✅ Valid landmark coordinates:', landmark.name, landmark.coordinates);
    }
    
    return isValid;
  });
  
  // Add valid landmarks
  TOUR_LANDMARKS.push(...validLandmarks);
  console.log('New tour landmarks set:', {
    total: landmarks.length,
    valid: validLandmarks.length,
    filtered: landmarks.length - validLandmarks.length
  });
  
  // Trigger a map update if we have valid landmarks
  if (validLandmarks.length > 0) {
    console.log('🗺️ Triggering map update for valid tour landmarks');
  }
};
