
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
 * Convert distance between metric and imperial units
 * @param distance Distance value
 * @param fromUnit Source unit
 * @param toUnit Target unit
 * @returns Converted distance
 */
export const convertDistance = (
  distance: number,
  fromUnit: 'metric' | 'imperial',
  toUnit: 'metric' | 'imperial'
): number => {
  if (fromUnit === toUnit) return distance;
  
  if (fromUnit === 'metric' && toUnit === 'imperial') {
    return distance * 3.28084; // meters to feet
  } else {
    return distance / 3.28084; // feet to meters
  }
};

/**
 * Format distance for display with appropriate units
 * @param distance Distance in meters (for metric) or feet (for imperial)
 * @param unit Unit system to use
 * @returns Formatted distance string
 */
export const formatDistance = (distance: number, unit: 'metric' | 'imperial'): string => {
  if (unit === 'metric') {
    return distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
  } else {
    return distance >= 5280 ? `${(distance / 5280).toFixed(1)} mi` : `${Math.round(distance)} ft`;
  }
};

/**
 * Get default proximity settings for a user
 * @param userId User ID
 * @returns Default proximity settings
 */
export const getDefaultProximitySettings = (userId: string) => ({
  user_id: userId,
  is_enabled: false,
  default_distance: 100, // 100 meters
  unit: 'metric' as const,
  notification_enabled: true,
  sound_enabled: true,
});
