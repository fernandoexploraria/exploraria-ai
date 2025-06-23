
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
  default_distance: 50, // Updated to 50 meters
  notification_enabled: false, // Updated to false
  sound_enabled: false, // Updated to false
});

/**
 * Request geolocation permission from the user
 * @returns Promise<boolean> - true if permission granted, false otherwise
 */
export const requestGeolocationPermission = async (): Promise<boolean> => {
  if (!navigator.geolocation) {
    console.warn('Geolocation is not supported by this browser');
    return false;
  }

  try {
    // Check current permission status
    if ('permissions' in navigator) {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (permission.state === 'granted') {
        return true;
      } else if (permission.state === 'denied') {
        return false;
      }
    }

    // Request permission by attempting to get current position
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { timeout: 5000 }
      );
    });
  } catch (error) {
    console.error('Error requesting geolocation permission:', error);
    return false;
  }
};
