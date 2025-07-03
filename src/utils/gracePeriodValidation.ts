
import { 
  ProximitySettings, 
  GracePeriodValidationError, 
  GracePeriodValidationResult,
  GracePeriodValidationRules,
  GracePeriodRecommendations
} from '@/types/proximityAlerts';

// Grace Period Validation Constants
export const GRACE_PERIOD_VALIDATION_RULES: GracePeriodValidationRules = {
  initialization: { min: 5000, max: 60000 }, // 5-60 seconds
  movement: { min: 3000, max: 30000 }, // 3-30 seconds
  appResume: { min: 2000, max: 15000 }, // 2-15 seconds
  movementThreshold: { min: 50, max: 500 }, // 50-500 meters
};

// Recommended grace period configurations
export const GRACE_PERIOD_RECOMMENDATIONS: GracePeriodRecommendations = {
  conservative: {
    initialization: 20000, // 20 seconds
    movement: 12000, // 12 seconds
    appResume: 8000, // 8 seconds
    movementThreshold: 200, // 200 meters
  },
  balanced: {
    initialization: 15000, // 15 seconds
    movement: 8000, // 8 seconds
    appResume: 5000, // 5 seconds
    movementThreshold: 150, // 150 meters
  },
  aggressive: {
    initialization: 10000, // 10 seconds
    movement: 5000, // 5 seconds
    appResume: 3000, // 3 seconds
    movementThreshold: 100, // 100 meters
  },
};

/**
 * Validates if a grace period duration is within acceptable range
 */
export const isValidGracePeriodDuration = (
  value: number, 
  type: 'initialization' | 'movement' | 'appResume'
): boolean => {
  const rules = GRACE_PERIOD_VALIDATION_RULES[type];
  return value >= rules.min && value <= rules.max;
};

/**
 * Validates movement threshold value
 */
export const validateMovementThreshold = (threshold: number): GracePeriodValidationError | null => {
  const rules = GRACE_PERIOD_VALIDATION_RULES.movementThreshold;
  
  if (threshold < rules.min) {
    return {
      field: 'significant_movement_threshold',
      message: `Movement threshold too low. Minimum ${rules.min}m recommended to avoid false triggers.`,
      currentValue: threshold,
      recommendedValue: rules.min,
    };
  }
  
  if (threshold > rules.max) {
    return {
      field: 'significant_movement_threshold',
      message: `Movement threshold too high. Maximum ${rules.max}m recommended for responsive detection.`,
      currentValue: threshold,
      recommendedValue: rules.max,
    };
  }
  
  return null;
};

/**
 * Validates logical relationships between grace periods
 */
export const validateGracePeriodLogic = (settings: Partial<ProximitySettings>): GracePeriodValidationError[] => {
  const errors: GracePeriodValidationError[] = [];
  
  if (!settings.grace_period_enabled) {
    return errors; // Skip validation if grace periods are disabled
  }
  
  const init = settings.grace_period_initialization ?? 15000;
  const movement = settings.grace_period_movement ?? 8000;
  const appResume = settings.grace_period_app_resume ?? 5000;
  
  // Movement period shouldn't be longer than initialization period
  if (movement > init) {
    errors.push({
      field: 'grace_period_logic',
      message: 'Movement grace period should not exceed initialization grace period.',
      currentValue: movement,
      recommendedValue: Math.min(movement, init - 1000),
    });
  }
  
  // App resume should be shorter than both initialization and movement
  if (appResume > init * 0.8) {
    errors.push({
      field: 'grace_period_logic',
      message: 'App resume grace period should be shorter than initialization period.',
      currentValue: appResume,
      recommendedValue: Math.floor(init * 0.6),
    });
  }
  
  return errors;
};

/**
 * Comprehensive validation of all grace period settings
 */
export const validateGracePeriodRanges = (settings: Partial<ProximitySettings>): GracePeriodValidationResult => {
  const errors: GracePeriodValidationError[] = [];
  const warnings: GracePeriodValidationError[] = [];
  
  if (!settings.grace_period_enabled) {
    return { isValid: true, errors: [], warnings: [] };
  }
  
  const init = settings.grace_period_initialization ?? 15000;
  const movement = settings.grace_period_movement ?? 8000;
  const appResume = settings.grace_period_app_resume ?? 5000;
  const threshold = settings.significant_movement_threshold ?? 150;
  
  // Validate initialization period
  if (!isValidGracePeriodDuration(init, 'initialization')) {
    const rules = GRACE_PERIOD_VALIDATION_RULES.initialization;
    errors.push({
      field: 'grace_period_initialization',
      message: `Initialization grace period must be between ${rules.min/1000}-${rules.max/1000} seconds.`,
      currentValue: init,
      recommendedValue: GRACE_PERIOD_RECOMMENDATIONS.balanced.initialization,
    });
  }
  
  // Validate movement period
  if (!isValidGracePeriodDuration(movement, 'movement')) {
    const rules = GRACE_PERIOD_VALIDATION_RULES.movement;
    errors.push({
      field: 'grace_period_movement',
      message: `Movement grace period must be between ${rules.min/1000}-${rules.max/1000} seconds.`,
      currentValue: movement,
      recommendedValue: GRACE_PERIOD_RECOMMENDATIONS.balanced.movement,
    });
  }
  
  // Validate app resume period
  if (!isValidGracePeriodDuration(appResume, 'appResume')) {
    const rules = GRACE_PERIOD_VALIDATION_RULES.appResume;
    errors.push({
      field: 'grace_period_app_resume',
      message: `App resume grace period must be between ${rules.min/1000}-${rules.max/1000} seconds.`,
      currentValue: appResume,
      recommendedValue: GRACE_PERIOD_RECOMMENDATIONS.balanced.appResume,
    });
  }
  
  // Validate movement threshold
  const thresholdError = validateMovementThreshold(threshold);
  if (thresholdError) {
    errors.push(thresholdError);
  }
  
  // Validate logical relationships
  const logicErrors = validateGracePeriodLogic(settings);
  errors.push(...logicErrors);
  
  // Generate warnings for non-optimal but valid settings
  if (init > 30000) { // > 30 seconds
    warnings.push({
      field: 'grace_period_initialization',
      message: 'Long initialization period may delay proximity alerts unnecessarily.',
      currentValue: init,
      recommendedValue: GRACE_PERIOD_RECOMMENDATIONS.balanced.initialization,
    });
  }
  
  if (movement < 5000) { // < 5 seconds
    warnings.push({
      field: 'grace_period_movement',
      message: 'Very short movement grace period may cause frequent alert interruptions.',
      currentValue: movement,
      recommendedValue: GRACE_PERIOD_RECOMMENDATIONS.balanced.movement,
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Formats grace period validation errors for display
 */
export const formatGracePeriodValidationError = (error: GracePeriodValidationError): string => {
  let message = error.message;
  
  if (error.currentValue !== undefined) {
    if (error.field === 'significant_movement_threshold') {
      message += ` Current: ${error.currentValue}m`;
    } else {
      message += ` Current: ${error.currentValue/1000}s`;
    }
  }
  
  if (error.recommendedValue !== undefined) {
    if (error.field === 'significant_movement_threshold') {
      message += `, Recommended: ${error.recommendedValue}m`;
    } else {
      message += `, Recommended: ${error.recommendedValue/1000}s`;
    }
  }
  
  return message;
};

/**
 * Gets recommended grace period values based on usage pattern
 */
export const getGracePeriodRecommendations = (
  pattern: 'conservative' | 'balanced' | 'aggressive' = 'balanced'
): GracePeriodRecommendations[typeof pattern] => {
  return GRACE_PERIOD_RECOMMENDATIONS[pattern];
};

/**
 * Gets validation rules for grace periods
 */
export const getGracePeriodValidationRules = (): GracePeriodValidationRules => {
  return GRACE_PERIOD_VALIDATION_RULES;
};

/**
 * Checks if grace period settings are enabled and valid
 */
export const isGracePeriodConfigurationValid = (settings: ProximitySettings | null): boolean => {
  if (!settings || !settings.grace_period_enabled) {
    return true; // Valid when disabled
  }
  
  const validation = validateGracePeriodRanges(settings);
  return validation.isValid;
};

/**
 * Auto-corrects grace period values to be within valid ranges
 */
export const autoCorrectGracePeriodValues = (settings: Partial<ProximitySettings>): Partial<ProximitySettings> => {
  if (!settings.grace_period_enabled) {
    return settings;
  }
  
  const corrected = { ...settings };
  const rules = GRACE_PERIOD_VALIDATION_RULES;
  
  // Auto-correct initialization period
  if (corrected.grace_period_initialization !== undefined) {
    corrected.grace_period_initialization = Math.max(
      rules.initialization.min,
      Math.min(rules.initialization.max, corrected.grace_period_initialization)
    );
  }
  
  // Auto-correct movement period
  if (corrected.grace_period_movement !== undefined) {
    corrected.grace_period_movement = Math.max(
      rules.movement.min,
      Math.min(rules.movement.max, corrected.grace_period_movement)
    );
  }
  
  // Auto-correct app resume period
  if (corrected.grace_period_app_resume !== undefined) {
    corrected.grace_period_app_resume = Math.max(
      rules.appResume.min,
      Math.min(rules.appResume.max, corrected.grace_period_app_resume)
    );
  }
  
  // Auto-correct movement threshold
  if (corrected.significant_movement_threshold !== undefined) {
    corrected.significant_movement_threshold = Math.max(
      rules.movementThreshold.min,
      Math.min(rules.movementThreshold.max, corrected.significant_movement_threshold)
    );
  }
  
  return corrected;
};
