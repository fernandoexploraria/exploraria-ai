
import { UserLocation, MovementDetectionResult, GracePeriodState } from '@/types/proximityAlerts';

// Smart grace period constants
export const GRACE_PERIOD_CONSTANTS = {
  INITIALIZATION: 15000, // 15 seconds
  MOVEMENT: 8000, // 8 seconds for movement-triggered grace
  APP_RESUME: 5000, // 5 seconds when app resumes from background
  LOCATION_SETTLING: 5000, // 5 seconds for location to stabilize
};

export const MOVEMENT_CONSTANTS = {
  SIGNIFICANT_THRESHOLD: 150, // meters - clear grace period if user moves this distance
  CHECK_INTERVAL: 10000, // 10 seconds between movement checks
  BACKGROUND_DETECTION: 30000, // 30 seconds - consider app backgrounded after this
};

// Calculate distance between two coordinates using Haversine formula
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Enhanced logging for grace period debugging
export const logGracePeriodEvent = (
  event: string, 
  details: any = {}, 
  level: 'info' | 'warn' | 'error' = 'info'
) => {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '🕐';
  
  console[level](`${prefix} [Grace Period] ${event}`, {
    timestamp,
    ...details
  });
};

// Smart grace period decision making
export const shouldActivateGracePeriod = (
  reason: GracePeriodState['gracePeriodReason'],
  context: {
    currentlyInGracePeriod: boolean;
    timeSinceLastGracePeriod?: number;
    movementDistance?: number;
    backgroundDuration?: number;
  }
): boolean => {
  const { currentlyInGracePeriod, timeSinceLastGracePeriod, movementDistance, backgroundDuration } = context;

  // Don't stack grace periods unless it's a more important reason
  if (currentlyInGracePeriod) {
    logGracePeriodEvent(`Grace period activation blocked - already active`, { reason, context }, 'warn');
    return false;
  }

  // Minimum time between grace periods to prevent abuse
  const MIN_TIME_BETWEEN_GRACE_PERIODS = 30000; // 30 seconds
  if (timeSinceLastGracePeriod && timeSinceLastGracePeriod < MIN_TIME_BETWEEN_GRACE_PERIODS) {
    logGracePeriodEvent(`Grace period activation blocked - too soon`, { 
      reason, 
      timeSince: timeSinceLastGracePeriod 
    }, 'warn');
    return false;
  }

  // Reason-specific logic
  switch (reason) {
    case 'initialization':
      // Always allow initialization grace period
      return true;
      
    case 'movement':
      // Only activate if movement is truly significant
      if (movementDistance && movementDistance >= MOVEMENT_CONSTANTS.SIGNIFICANT_THRESHOLD) {
        logGracePeriodEvent(`Movement grace period activated`, { distance: movementDistance });
        return true;
      }
      return false;
      
    case 'app_resume':
      // Only activate if app was backgrounded for a reasonable time
      if (backgroundDuration && backgroundDuration >= MOVEMENT_CONSTANTS.BACKGROUND_DETECTION) {
        logGracePeriodEvent(`App resume grace period activated`, { backgroundDuration });
        return true;
      }
      return false;
      
    default:
      return false;
  }
};

// Debug information formatter
export const formatGracePeriodDebugInfo = (gracePeriodState: GracePeriodState) => {
  if (!gracePeriodState.gracePeriodActive) {
    return 'Grace period: Inactive';
  }

  const now = Date.now();
  const elapsed = gracePeriodState.initializationTimestamp 
    ? now - gracePeriodState.initializationTimestamp 
    : 0;
  
  let duration = GRACE_PERIOD_CONSTANTS.INITIALIZATION;
  if (gracePeriodState.gracePeriodReason === 'movement') {
    duration = GRACE_PERIOD_CONSTANTS.MOVEMENT;
  } else if (gracePeriodState.gracePeriodReason === 'app_resume') {
    duration = GRACE_PERIOD_CONSTANTS.APP_RESUME;
  }

  const remaining = Math.max(0, duration - elapsed);

  return `Grace period: ${gracePeriodState.gracePeriodReason} (${Math.round(remaining/1000)}s remaining)`;
};
