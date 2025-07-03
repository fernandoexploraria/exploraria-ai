
import { UserLocation, MovementDetectionResult, GracePeriodState, ProximitySettings } from '@/types/proximityAlerts';
import { validateGracePeriodRanges, isGracePeriodConfigurationValid, getGracePeriodRecommendations } from './gracePeriodValidation';

// Remove hardcoded constants - now fully user-preference driven
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

// Grace period preset configurations
export const GRACE_PERIOD_PRESETS = {
  conservative: {
    name: 'Conservative',
    description: 'Longer grace periods for relaxed proximity monitoring',
    initialization: 20000, // 20 seconds
    movement: 12000, // 12 seconds
    appResume: 8000, // 8 seconds
    movementThreshold: 200, // 200 meters
    enabled: true,
  },
  balanced: {
    name: 'Balanced',
    description: 'Default balanced grace periods for most users',
    initialization: 15000, // 15 seconds
    movement: 8000, // 8 seconds
    appResume: 5000, // 5 seconds
    movementThreshold: 150, // 150 meters
    enabled: true,
  },
  aggressive: {
    name: 'Aggressive',
    description: 'Shorter grace periods for immediate proximity alerts',
    initialization: 10000, // 10 seconds
    movement: 5000, // 5 seconds
    appResume: 3000, // 3 seconds
    movementThreshold: 100, // 100 meters
    enabled: true,
  },
  disabled: {
    name: 'Disabled',
    description: 'Grace periods completely disabled',
    initialization: 0,
    movement: 0,
    appResume: 0,
    movementThreshold: 150,
    enabled: false,
  },
} as const;

export type GracePeriodPresetName = keyof typeof GRACE_PERIOD_PRESETS;

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

// Apply a grace period preset to settings
export const applyGracePeriodPreset = (
  presetName: GracePeriodPresetName,
  currentSettings: Partial<ProximitySettings> = {}
): Partial<ProximitySettings> => {
  const preset = GRACE_PERIOD_PRESETS[presetName];
  
  return {
    ...currentSettings,
    grace_period_initialization: preset.initialization,
    grace_period_movement: preset.movement,
    grace_period_app_resume: preset.appResume,
    significant_movement_threshold: preset.movementThreshold,
    grace_period_enabled: preset.enabled,
  };
};

// Get the current preset name based on settings
export const getGracePeriodPresetName = (settings: ProximitySettings | null): GracePeriodPresetName | 'custom' => {
  if (!settings) return 'balanced';
  
  for (const [presetName, preset] of Object.entries(GRACE_PERIOD_PRESETS)) {
    if (
      settings.grace_period_initialization === preset.initialization &&
      settings.grace_period_movement === preset.movement &&
      settings.grace_period_app_resume === preset.appResume &&
      settings.significant_movement_threshold === preset.movementThreshold &&
      settings.grace_period_enabled === preset.enabled
    ) {
      return presetName as GracePeriodPresetName;
    }
  }
  
  return 'custom';
};

// Get all available presets
export const getAvailablePresets = () => {
  return Object.entries(GRACE_PERIOD_PRESETS).map(([key, preset]) => ({
    key: key as GracePeriodPresetName,
    ...preset,
  }));
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

// Enhanced logging for grace period debugging with user preference context
export const logGracePeriodEvent = (
  event: string, 
  details: any = {}, 
  level: 'info' | 'warn' | 'error' = 'info',
  settings?: ProximitySettings | null
) => {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '🕐';
  
  // Enhanced context with user preferences
  let contextInfo = '';
  if (settings) {
    const isValid = isGracePeriodConfigurationValid(settings);
    const presetName = getGracePeriodPresetName(settings);
    const gracePeriodConstants = getGracePeriodConstants(settings);
    const movementConstants = getMovementConstants(settings);
    
    contextInfo = [
      `[${isValid ? 'VALID' : 'INVALID CONFIG'}]`,
      `[PRESET: ${presetName.toUpperCase()}]`,
      `[ENABLED: ${settings.grace_period_enabled}]`,
      `[INIT: ${gracePeriodConstants.INITIALIZATION}ms]`,
      `[MOVE: ${gracePeriodConstants.MOVEMENT}ms]`,
      `[RESUME: ${gracePeriodConstants.APP_RESUME}ms]`,
      `[THRESHOLD: ${movementConstants.SIGNIFICANT_THRESHOLD}m]`
    ].join(' ');
  }
  
  console[level](`${prefix} [Grace Period] ${contextInfo} ${event}`, {
    timestamp,
    userPreferences: settings ? {
      preset: getGracePeriodPresetName(settings),
      enabled: settings.grace_period_enabled,
      constants: getGracePeriodConstants(settings),
      movementConstants: getMovementConstants(settings),
      isValid: isGracePeriodConfigurationValid(settings),
    } : null,
    ...details
  });
};

// Smart grace period decision making with enhanced user preference validation
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
  const presetName = getGracePeriodPresetName(settings);

  // Check if grace period is globally disabled
  if (settings && !settings.grace_period_enabled) {
    logGracePeriodEvent(`Grace period globally disabled`, { 
      reason, 
      context, 
      preset: presetName 
    }, 'info', settings);
    return false;
  }

  // Validate grace period configuration before proceeding
  if (settings && !isGracePeriodConfigurationValid(settings)) {
    const validation = validateGracePeriodRanges(settings);
    logGracePeriodEvent(`Grace period configuration invalid`, { 
      reason, 
      context,
      preset: presetName,
      errors: validation.errors.map(e => e.message)
    }, 'warn', settings);
    // Still allow grace period with invalid config, but log warning
  }

  // Don't stack grace periods unless it's a more important reason
  if (currentlyInGracePeriod) {
    logGracePeriodEvent(`Grace period activation blocked - already active`, { 
      reason, 
      context,
      preset: presetName 
    }, 'warn', settings);
    return false;
  }

  // Minimum time between grace periods to prevent abuse (user-preference aware)
  const gracePeriodConstants = getGracePeriodConstants(settings);
  const MIN_TIME_BETWEEN_GRACE_PERIODS = Math.max(30000, gracePeriodConstants.INITIALIZATION * 2);
  
  if (timeSinceLastGracePeriod && timeSinceLastGracePeriod < MIN_TIME_BETWEEN_GRACE_PERIODS) {
    logGracePeriodEvent(`Grace period activation blocked - too soon`, { 
      reason, 
      timeSince: timeSinceLastGracePeriod,
      minTime: MIN_TIME_BETWEEN_GRACE_PERIODS,
      preset: presetName
    }, 'warn', settings);
    return false;
  }

  const movementConstants = getMovementConstants(settings);

  // Reason-specific logic with user preference context
  switch (reason) {
    case 'initialization':
      // Always allow initialization grace period if enabled
      logGracePeriodEvent(`Initialization grace period activated`, { 
        duration: gracePeriodConstants.INITIALIZATION,
        preset: presetName
      }, 'info', settings);
      return true;
      
    case 'movement':
      // Only activate if movement is truly significant (using user's configurable threshold)
      if (movementDistance && movementDistance >= movementConstants.SIGNIFICANT_THRESHOLD) {
        logGracePeriodEvent(`Movement grace period activated`, { 
          distance: movementDistance,
          threshold: movementConstants.SIGNIFICANT_THRESHOLD,
          duration: gracePeriodConstants.MOVEMENT,
          preset: presetName
        }, 'info', settings);
        return true;
      }
      logGracePeriodEvent(`Movement grace period not activated - below threshold`, { 
        distance: movementDistance,
        threshold: movementConstants.SIGNIFICANT_THRESHOLD,
        preset: presetName
      }, 'info', settings);
      return false;
      
    case 'app_resume':
      // Only activate if app was backgrounded for a reasonable time (user-preference aware)
      const backgroundThreshold = Math.max(movementConstants.BACKGROUND_DETECTION, gracePeriodConstants.APP_RESUME * 2);
      if (backgroundDuration && backgroundDuration >= backgroundThreshold) {
        logGracePeriodEvent(`App resume grace period activated`, { 
          backgroundDuration,
          threshold: backgroundThreshold,
          duration: gracePeriodConstants.APP_RESUME,
          preset: presetName
        }, 'info', settings);
        return true;
      }
      logGracePeriodEvent(`App resume grace period not activated - background duration too short`, { 
        backgroundDuration,
        threshold: backgroundThreshold,
        preset: presetName
      }, 'info', settings);
      return false;
      
    default:
      return false;
  }
};

// Debug information formatter with enhanced user preference context
export const formatGracePeriodDebugInfo = (
  gracePeriodState: GracePeriodState, 
  settings: ProximitySettings | null = null
) => {
  const presetName = getGracePeriodPresetName(settings);
  const isValid = settings ? isGracePeriodConfigurationValid(settings) : true;
  
  if (!gracePeriodState.gracePeriodActive) {
    const statusInfo = [
      `Grace period: Inactive`,
      `[${presetName.toUpperCase()}]`,
      !isValid ? '(CONFIG INVALID)' : '',
      settings?.grace_period_enabled === false ? '(DISABLED)' : ''
    ].filter(Boolean).join(' ');
    
    return statusInfo;
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
  const statusInfo = [
    `Grace period: ${gracePeriodState.gracePeriodReason}`,
    `(${Math.round(remaining/1000)}s remaining)`,
    `[${presetName.toUpperCase()}]`,
    !isValid ? '(CONFIG INVALID)' : '',
    settings?.grace_period_enabled === false ? '(DISABLED)' : ''
  ].filter(Boolean).join(' ');

  return statusInfo;
};

// Recommend grace period preset based on usage patterns
export const recommendGracePeriodPreset = (
  usagePattern: {
    averageSessionDuration?: number;
    movementFrequency?: 'low' | 'medium' | 'high';
    alertSensitivity?: 'low' | 'medium' | 'high';
    backgroundUsage?: boolean;
  }
): GracePeriodPresetName => {
  const { movementFrequency = 'medium', alertSensitivity = 'medium', backgroundUsage = false } = usagePattern;
  
  // High movement frequency or low alert sensitivity suggests conservative
  if (movementFrequency === 'high' || alertSensitivity === 'low') {
    return 'conservative';
  }
  
  // Low movement frequency and high alert sensitivity suggests aggressive
  if (movementFrequency === 'low' && alertSensitivity === 'high' && !backgroundUsage) {
    return 'aggressive';
  }
  
  // Default to balanced for most users
  return 'balanced';
};

// Compare current settings with preset
export const compareSettingsWithPreset = (
  settings: ProximitySettings | null,
  presetName: GracePeriodPresetName
): {
  matches: boolean;
  differences: string[];
} => {
  if (!settings) {
    return { matches: false, differences: ['No settings available'] };
  }
  
  const preset = GRACE_PERIOD_PRESETS[presetName];
  const differences: string[] = [];
  
  if (settings.grace_period_initialization !== preset.initialization) {
    differences.push(`Initialization: ${settings.grace_period_initialization}ms vs ${preset.initialization}ms`);
  }
  
  if (settings.grace_period_movement !== preset.movement) {
    differences.push(`Movement: ${settings.grace_period_movement}ms vs ${preset.movement}ms`);
  }
  
  if (settings.grace_period_app_resume !== preset.appResume) {
    differences.push(`App Resume: ${settings.grace_period_app_resume}ms vs ${preset.appResume}ms`);
  }
  
  if (settings.significant_movement_threshold !== preset.movementThreshold) {
    differences.push(`Movement Threshold: ${settings.significant_movement_threshold}m vs ${preset.movementThreshold}m`);
  }
  
  if (settings.grace_period_enabled !== preset.enabled) {
    differences.push(`Enabled: ${settings.grace_period_enabled} vs ${preset.enabled}`);
  }
  
  return {
    matches: differences.length === 0,
    differences
  };
};
