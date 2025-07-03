import { UserLocation, MovementDetectionResult, GracePeriodState, ProximitySettings } from '@/types/proximityAlerts';
import { validateGracePeriodRanges, isGracePeriodConfigurationValid } from './gracePeriodValidation';

// Default constants (fallback values if settings not available)
export const DEFAULT_GRACE_PERIOD_CONSTANTS = {
  INITIALIZATION: 15000, // 15 seconds
  MOVEMENT: 8000, // 8 seconds for movement-triggered grace
  APP_RESUME: 5000, // 5 seconds when app resumes from background
  LOCATION_SETTLING: 5000, // 5 seconds for location to stabilize
};

export const DEFAULT_MOVEMENT_CONSTANTS = {
  SIGNIFICANT_THRESHOLD: 150, // meters - clear grace period if user moves this distance
  CHECK_INTERVAL: 10000, // 10 seconds between movement checks
  BACKGROUND_DETECTION: 30000, // 30 seconds - consider app backgrounded after this
};

// Get grace period constants from settings or use defaults
export const getGracePeriodConstants = (settings: ProximitySettings | null) => {
  if (!settings || !settings.grace_period_enabled) {
    return DEFAULT_GRACE_PERIOD_CONSTANTS;
  }
  
  return {
    INITIALIZATION: settings.grace_period_initialization,
    MOVEMENT: settings.grace_period_movement,
    APP_RESUME: settings.grace_period_app_resume,
    LOCATION_SETTLING: DEFAULT_GRACE_PERIOD_CONSTANTS.LOCATION_SETTLING, // Keep default for now
  };
};

// Get movement constants from settings or use defaults
export const getMovementConstants = (settings: ProximitySettings | null) => {
  if (!settings || !settings.grace_period_enabled) {
    return DEFAULT_MOVEMENT_CONSTANTS;
  }
  
  return {
    SIGNIFICANT_THRESHOLD: settings.significant_movement_threshold,
    CHECK_INTERVAL: DEFAULT_MOVEMENT_CONSTANTS.CHECK_INTERVAL, // Keep default for now
    BACKGROUND_DETECTION: DEFAULT_MOVEMENT_CONSTANTS.BACKGROUND_DETECTION, // Keep default for now
  };
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

// Enhanced logging for grace period debugging with validation awareness
export const logGracePeriodEvent = (
  event: string, 
  details: any = {}, 
  level: 'info' | 'warn' | 'error' = 'info',
  settings?: ProximitySettings | null
) => {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '🕐';
  
  // Add validation status to debug info
  let validationInfo = '';
  if (settings) {
    const isValid = isGracePeriodConfigurationValid(settings);
    validationInfo = isValid ? '[VALID]' : '[INVALID CONFIG]';
  }
  
  console[level](`${prefix} [Grace Period] ${validationInfo} ${event}`, {
    timestamp,
    ...details
  });
};

// Smart grace period decision making with validation checks
export const shouldActivateGracePeriod = (
  reason: GracePeriodState['gracePeriodReason'],
  context: {
    currentlyInGracePeriod: boolean;
    timeSinceLastGracePeriod?: number;
    movementDistance?: number;
    backgroundDuration?: number;
  },
  settings: ProximitySettings | null = null
): boolean => {
  const { currentlyInGracePeriod, timeSinceLastGracePeriod, movementDistance, backgroundDuration } = context;

  // Check if grace period is globally disabled
  if (settings && !settings.grace_period_enabled) {
    logGracePeriodEvent(`Grace period globally disabled`, { reason, context }, 'info', settings);
    return false;
  }

  // Validate grace period configuration before proceeding
  if (settings && !isGracePeriodConfigurationValid(settings)) {
    const validation = validateGracePeriodRanges(settings);
    logGracePeriodEvent(`Grace period configuration invalid`, { 
      reason, 
      context,
      errors: validation.errors.map(e => e.message)
    }, 'warn', settings);
    // Still allow grace period with invalid config, but log warning
  }

  // Don't stack grace periods unless it's a more important reason
  if (currentlyInGracePeriod) {
    logGracePeriodEvent(`Grace period activation blocked - already active`, { reason, context }, 'warn', settings);
    return false;
  }

  // Minimum time between grace periods to prevent abuse
  const MIN_TIME_BETWEEN_GRACE_PERIODS = 30000; // 30 seconds
  if (timeSinceLastGracePeriod && timeSinceLastGracePeriod < MIN_TIME_BETWEEN_GRACE_PERIODS) {
    logGracePeriodEvent(`Grace period activation blocked - too soon`, { 
      reason, 
      timeSince: timeSinceLastGracePeriod 
    }, 'warn', settings);
    return false;
  }

  const movementConstants = getMovementConstants(settings);

  // Reason-specific logic
  switch (reason) {
    case 'initialization':
      // Always allow initialization grace period
      return true;
      
    case 'movement':
      // Only activate if movement is truly significant (using configurable threshold)
      if (movementDistance && movementDistance >= movementConstants.SIGNIFICANT_THRESHOLD) {
        logGracePeriodEvent(`Movement grace period activated`, { 
          distance: movementDistance,
          threshold: movementConstants.SIGNIFICANT_THRESHOLD
        }, 'info', settings);
        return true;
      }
      return false;
      
    case 'app_resume':
      // Only activate if app was backgrounded for a reasonable time
      if (backgroundDuration && backgroundDuration >= movementConstants.BACKGROUND_DETECTION) {
        logGracePeriodEvent(`App resume grace period activated`, { backgroundDuration }, 'info', settings);
        return true;
      }
      return false;
      
    default:
      return false;
  }
};

// Debug information formatter with validation status
export const formatGracePeriodDebugInfo = (
  gracePeriodState: GracePeriodState, 
  settings: ProximitySettings | null = null
) => {
  if (!gracePeriodState.gracePeriodActive) {
    const configStatus = settings ? (isGracePeriodConfigurationValid(settings) ? '' : ' (CONFIG INVALID)') : '';
    return `Grace period: Inactive${configStatus}`;
  }

  const now = Date.now();
  const elapsed = gracePeriodState.initializationTimestamp 
    ? now - gracePeriodState.initializationTimestamp 
    : 0;
  
  const gracePeriodConstants = getGracePeriodConstants(settings);
  let duration = gracePeriodConstants.INITIALIZATION;
  
  if (gracePeriodState.gracePeriodReason === 'movement') {
    duration = gracePeriodConstants.MOVEMENT;
  } else if (gracePeriodState.gracePeriodReason === 'app_resume') {
    duration = gracePeriodConstants.APP_RESUME;
  }

  const remaining = Math.max(0, duration - elapsed);
  const enabledStatus = settings?.grace_period_enabled !== false ? '' : ' (DISABLED)';
  const configStatus = settings ? (isGracePeriodConfigurationValid(settings) ? '' : ' (CONFIG INVALID)') : '';

  return `Grace period: ${gracePeriodState.gracePeriodReason} (${Math.round(remaining/1000)}s remaining)${enabledStatus}${configStatus}`;
};
