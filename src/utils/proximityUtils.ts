/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Format distance for display in metric units
 * @param distance Distance in meters
 * @returns Formatted distance string
 */
export const formatDistance = (distance: number): string => {
  return distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
};

/**
 * Get default proximity settings for a user
 * @param userId User ID
 * @returns Default proximity settings
 */
export const getDefaultProximitySettings = (userId: string) => ({
  user_id: userId,
  is_enabled: false,
  default_distance: 1000, // Updated to 1000 meters for expanded testing
});

/**
 * Request geolocation permission from the user with retry mechanism
 * @param retryAttempts Number of retry attempts (default: 1)
 * @returns Promise<boolean> - true if permission granted, false otherwise
 */
export const requestGeolocationPermission = async (retryAttempts: number = 1): Promise<boolean> => {
  if (!navigator.geolocation) {
    console.warn('Geolocation is not supported by this browser');
    return false;
  }

  const attemptPermissionRequest = async (attempt: number): Promise<boolean> => {
    try {
      console.log(`Attempting geolocation permission request (attempt ${attempt})`);
      
      // Check current permission status first
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        console.log('Current permission state:', permission.state);
        
        if (permission.state === 'granted') {
          console.log('Permission already granted');
          return true;
        } else if (permission.state === 'denied') {
          console.log('Permission previously denied');
          return false;
        }
      }

      // Request permission by attempting to get current position
      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          console.log('Permission request timed out');
          resolve(false);
        }, 15000); // Increased timeout to 15 seconds

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            console.log('Permission granted successfully, got position:', {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
            resolve(true);
          },
          (error) => {
            clearTimeout(timeoutId);
            console.log('Permission request failed:', error.message, 'Code:', error.code);
            
            // Only resolve false for permission denied, other errors might be temporary
            if (error.code === error.PERMISSION_DENIED) {
              resolve(false);
            } else {
              // For other errors, we might want to retry
              resolve(attempt < retryAttempts ? null : false);
            }
          },
          { 
            timeout: 12000, // Increased timeout
            enableHighAccuracy: false, // Less demanding for permission request
            maximumAge: 300000 // 5 minutes
          }
        );
      });
    } catch (error) {
      console.error('Error requesting geolocation permission:', error);
      return false;
    }
  };

  // Try multiple attempts if specified
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    const result = await attemptPermissionRequest(attempt);
    
    if (result === true) {
      return true;
    } else if (result === false) {
      return false;
    }
    // If result is null, try again
    
    if (attempt < retryAttempts) {
      console.log(`Retrying permission request in 2 seconds... (${attempt}/${retryAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Increased retry delay
    }
  }

  return false;
};

/**
 * Filter landmarks within a certain radius of a location
 * @param userLocation User's current location
 * @param landmarks Array of landmarks with coordinates
 * @param radiusMeters Search radius in meters
 * @returns Filtered landmarks within radius
 */
export const filterLandmarksWithinRadius = <T extends { coordinates: [number, number] }>(
  userLocation: { latitude: number; longitude: number },
  landmarks: T[],
  radiusMeters: number
): T[] => {
  return landmarks.filter(landmark => {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      landmark.coordinates[1], // latitude
      landmark.coordinates[0]  // longitude
    );
    return distance <= radiusMeters;
  });
};

/**
 * Find the nearest landmark to a location
 * @param userLocation User's current location
 * @param landmarks Array of landmarks with coordinates
 * @returns Object with nearest landmark and distance, or null if no landmarks
 */
export const findNearestLandmark = <T extends { coordinates: [number, number] }>(
  userLocation: { latitude: number; longitude: number },
  landmarks: T[]
): { landmark: T; distance: number } | null => {
  if (landmarks.length === 0) return null;

  let nearestLandmark = landmarks[0];
  let shortestDistance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    landmarks[0].coordinates[1],
    landmarks[0].coordinates[0]
  );

  for (let i = 1; i < landmarks.length; i++) {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      landmarks[i].coordinates[1],
      landmarks[i].coordinates[0]
    );

    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestLandmark = landmarks[i];
    }
  }

  return {
    landmark: nearestLandmark,
    distance: shortestDistance
  };
};

/**
 * Debounce function to limit the frequency of function calls
 * @param func Function to debounce
 * @param wait Delay in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Check if a location is valid (not null/undefined and within valid ranges)
 * @param location Location object to validate
 * @returns boolean indicating if location is valid
 */
export const isValidLocation = (
  location: { latitude: number; longitude: number } | null | undefined
): location is { latitude: number; longitude: number } => {
  if (!location) return false;
  
  const { latitude, longitude } = location;
  
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !isNaN(latitude) &&
    !isNaN(longitude)
  );
};

/**
 * Calculate the centroid (geographic center) of an array of landmarks
 * @param landmarks Array of landmarks with coordinates [longitude, latitude]
 * @returns Centroid coordinates as [longitude, latitude]
 */
export const calculateCentroid = <T extends { coordinates: [number, number] }>(
  landmarks: T[]
): [number, number] => {
  if (landmarks.length === 0) {
    throw new Error('Cannot calculate centroid of empty landmarks array');
  }

  let totalLongitude = 0;
  let totalLatitude = 0;

  for (const landmark of landmarks) {
    totalLongitude += landmark.coordinates[0]; // longitude
    totalLatitude += landmark.coordinates[1];  // latitude
  }

  const centroidLongitude = totalLongitude / landmarks.length;
  const centroidLatitude = totalLatitude / landmarks.length;

  return [centroidLongitude, centroidLatitude];
};
