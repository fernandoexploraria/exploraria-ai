
import { ProximitySettings, GracePeriodState, MovementDetectionResult } from '@/types/proximityAlerts';

// Smart Grace Period Constants with user preference integration
export const getGracePeriodConstants = (settings: ProximitySettings | null = null) => {
  return {
    INITIALIZATION: settings?.grace_period_initialization ?? 15000, // 15 seconds default
    MOVEMENT: settings?.grace_period_movement ?? 8000, // 8 seconds default
    APP_RESUME: settings?.grace_period_app_resume ?? 5000, // 5 seconds default
    LOCATION_SETTLING: settings?.location_settling_grace_period ?? 5000, // 5 seconds default
  };
};

export const getMovementConstants = (settings: ProximitySettings | null = null) => {
  return {
    SIGNIFICANT_THRESHOLD: settings?.significant_movement_threshold ?? 150, // 150 meters default
    BACKGROUND_DETECTION: 10000, // 10 seconds to determine backgrounding
  };
};

// Grace period preset configurations
export const GRACE_PERIOD_PRESETS = {
  conservative: {
    initialization: 20000, // 20s
    movement: 12000, // 12s
    appResume: 8000, // 8s
    movementThreshold: 200, // 200m
    locationSettling: 8000, // 8s
  },
  balanced: {
    initialization: 15000, // 15s
    movement: 8000, // 8s
    appResume: 5000, // 5s
    movementThreshold: 150, // 150m
    locationSettling: 5000, // 5s
  },
  aggressive: {
    initialization: 10000, // 10s
    movement: 5000, // 5s
    appResume: 3000, // 3s
    movementThreshold: 100, // 100m
    locationSettling: 3000, // 3s
  }
};

export const getGracePeriodPresetName = (settings: ProximitySettings | null): string => {
  if (!settings) return 'balanced';
  
  const presets = Object.entries(GRACE_PERIOD_PRESETS);
  
  for (const [name, preset] of presets) {
    if (
      settings.grace_period_initialization === preset.initialization &&
      settings.grace_period_movement === preset.movement &&
      settings.grace_period_app_resume === preset.appResume &&
      settings.significant_movement_threshold === preset.movementThreshold &&
      settings.location_settling_grace_period === preset.locationSettling
    ) {
      return name;
    }
  }
  
  return 'custom';
};

// Smart grace period activation logic
export const shouldActivateGracePeriod = (
  reason: 'initialization' | 'movement' | 'app_resume',
  context: {
    currentlyInGracePeriod?: boolean;
    backgroundDuration?: number;
    movementDistance?: number;
  },
  settings: ProximitySettings | null = null
): boolean => {
  // If grace period is globally disabled, don't activate
  if (settings && !settings.grace_period_enabled) {
    return false;
  }
  
  // Don't activate if already in grace period (prevent overlapping)
  if (context.currentlyInGracePeriod) {
    return false;
  }
  
  switch (reason) {
    case 'initialization':
      // Always activate on initialization (first time enabling proximity)
      return true;
      
    case 'movement':
      // Activate if movement is significant enough
      const movementThreshold = getMovementConstants(settings).SIGNIFICANT_THRESHOLD;
      return context.movementDistance ? context.movementDistance >= movementThreshold : false;
      
    case 'app_resume':
      // Activate if app was backgrounded for more than background detection threshold
      const backgroundThreshold = getMovementConstants(settings).BACKGROUND_DETECTION;
      return context.backgroundDuration ? context.backgroundDuration >= backgroundThreshold : false;
      
    default:
      return false;
  }
};

// Distance calculation utility
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Enhanced logging with user preference context
export const logGracePeriodEvent = (
  message: string, 
  data: any = {}, 
  level: 'info' | 'warn' | 'error' = 'info',
  settings: ProximitySettings | null = null
) => {
  const enhancedData = {
    ...data,
    preset: getGracePeriodPresetName(settings),
    gracePeriodEnabled: settings?.grace_period_enabled ?? true,
    timestamp: new Date().toISOString()
  };
  
  const logMessage = `🔔 [Grace Period] ${message}`;
  
  switch (level) {
    case 'error':
      console.error(logMessage, enhancedData);
      break;
    case 'warn':
      console.warn(logMessage, enhancedData);
      break;
    default:
      console.log(logMessage, enhancedData);
  }
};

// Debug information formatter
export const formatGracePeriodDebugInfo = (
  gracePeriodState: GracePeriodState,
  settings: ProximitySettings | null = null
) => {
  const constants = getGracePeriodConstants(settings);
  const movementConstants = getMovementConstants(settings);
  
  return {
    state: gracePeriodState,
    constants: {
      ...constants,
      movementThreshold: movementConstants.SIGNIFICANT_THRESHOLD,
    },
    preset: getGracePeriodPresetName(settings),
    isEnabled: settings?.grace_period_enabled ?? true,
    activeReason: gracePeriodState.gracePeriodReason,
    timeRemaining: gracePeriodState.initializationTimestamp ? 
      Math.max(0, (gracePeriodState.initializationTimestamp + constants.INITIALIZATION) - Date.now()) : 0
  };
};
