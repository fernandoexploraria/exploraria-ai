
/**
 * Utilities for location tracking optimization
 */

export interface MovementState {
  isMoving: boolean;
  lastMovementTime: number;
  stationaryDuration: number;
  averageSpeed: number; // m/s over last few readings
}

export interface LocationHistory {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}

const MOVEMENT_THRESHOLD = 15; // meters
const STATIONARY_THRESHOLD = 300000; // 5 minutes
const SPEED_CALCULATION_WINDOW = 3; // number of readings to calculate speed

/**
 * Calculate distance between two coordinates
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Detect movement based on location history
 */
export const detectMovement = (
  locationHistory: LocationHistory[],
  currentLocation: LocationHistory
): MovementState => {
  if (locationHistory.length === 0) {
    return {
      isMoving: false,
      lastMovementTime: currentLocation.timestamp,
      stationaryDuration: 0,
      averageSpeed: 0
    };
  }

  const lastLocation = locationHistory[locationHistory.length - 1];
  const distance = calculateDistance(
    lastLocation.latitude,
    lastLocation.longitude,
    currentLocation.latitude,
    currentLocation.longitude
  );

  const timeDiff = (currentLocation.timestamp - lastLocation.timestamp) / 1000; // seconds
  const speed = timeDiff > 0 ? distance / timeDiff : 0;

  // Calculate average speed over recent readings
  const recentReadings = locationHistory.slice(-SPEED_CALCULATION_WINDOW);
  let totalSpeed = 0;
  let speedCalculations = 0;

  for (let i = 1; i < recentReadings.length; i++) {
    const prev = recentReadings[i - 1];
    const curr = recentReadings[i];
    const dist = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    const time = (curr.timestamp - prev.timestamp) / 1000;
    if (time > 0) {
      totalSpeed += dist / time;
      speedCalculations++;
    }
  }

  const averageSpeed = speedCalculations > 0 ? totalSpeed / speedCalculations : speed;
  const isMoving = distance > MOVEMENT_THRESHOLD || averageSpeed > 0.5; // 0.5 m/s = 1.8 km/h

  const lastMovementTime = isMoving ? currentLocation.timestamp : 
    (locationHistory.length > 0 ? locationHistory[locationHistory.length - 1].timestamp : currentLocation.timestamp);

  const stationaryDuration = isMoving ? 0 : currentLocation.timestamp - lastMovementTime;

  return {
    isMoving,
    lastMovementTime,
    stationaryDuration,
    averageSpeed
  };
};

/**
 * Calculate adaptive polling interval based on movement and proximity
 */
export const calculateAdaptiveInterval = (
  movementState: MovementState,
  nearbyLandmarksCount: number,
  baseInterval: number = 15000
): number => {
  let interval = baseInterval;

  // Reduce interval when moving
  if (movementState.isMoving) {
    interval = Math.max(interval * 0.5, 10000); // Min 10s when moving
  }

  // Increase interval when stationary
  if (movementState.stationaryDuration > STATIONARY_THRESHOLD) {
    interval = Math.min(interval * 2, 60000); // Max 60s when stationary for long
  }

  // Reduce interval when near landmarks
  if (nearbyLandmarksCount > 0) {
    interval = Math.max(interval * 0.7, 8000); // Min 8s when near landmarks
  }

  return Math.round(interval);
};

/**
 * Calculate adaptive timeout based on conditions
 */
export const calculateAdaptiveTimeout = (
  movementState: MovementState,
  consecutiveFailures: number,
  baseTimeout: number = 10000
): number => {
  let timeout = baseTimeout;

  // Increase timeout for stationary users
  if (!movementState.isMoving) {
    timeout = Math.min(timeout * 1.5, 15000);
  }

  // Increase timeout with consecutive failures (exponential backoff)
  if (consecutiveFailures > 0) {
    timeout = Math.min(timeout * Math.pow(1.5, consecutiveFailures), 20000);
  }

  return Math.round(timeout);
};

/**
 * Get optimal geolocation options based on context
 */
export const getOptimalLocationOptions = (
  movementState: MovementState,
  nearbyLandmarksCount: number,
  consecutiveFailures: number
): PositionOptions => {
  const isNearLandmarks = nearbyLandmarksCount > 0;
  const needsHighAccuracy = movementState.isMoving || isNearLandmarks;
  
  return {
    enableHighAccuracy: needsHighAccuracy,
    timeout: calculateAdaptiveTimeout(movementState, consecutiveFailures),
    maximumAge: needsHighAccuracy ? 30000 : 60000 // Allow older readings when not critical
  };
};

/**
 * Check if location change is significant enough to warrant an update
 */
export const isSignificantLocationChange = (
  oldLocation: LocationHistory,
  newLocation: LocationHistory,
  threshold: number = 20 // meters
): boolean => {
  const distance = calculateDistance(
    oldLocation.latitude,
    oldLocation.longitude,
    newLocation.latitude,
    newLocation.longitude
  );

  return distance >= threshold;
};
