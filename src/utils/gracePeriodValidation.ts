
import { ProximitySettings, GracePeriodValidationResult, GracePeriodValidationError, GracePeriodValidationRules } from '@/types/proximityAlerts';
import { GRACE_PERIOD_PRESETS } from '@/utils/smartGracePeriod';

// Validation rules for grace period settings
export const GRACE_PERIOD_VALIDATION_RULES: GracePeriodValidationRules = {
  initialization: { min: 5000, max: 60000 }, // 5-60 seconds
  movement: { min: 3000, max: 30000 }, // 3-30 seconds
  appResume: { min: 1000, max: 15000 }, // 1-15 seconds
  movementThreshold: { min: 50, max: 500 }, // 50-500 meters
  locationSettling: { min: 1000, max: 15000 }, // 1-15 seconds
};

export const validateGracePeriodRanges = (settings: Partial<ProximitySettings>): GracePeriodValidationResult => {
  const errors: GracePeriodValidationError[] = [];
  const warnings: GracePeriodValidationError[] = [];

  // Validate initialization grace period
  if (settings.grace_period_initialization && (settings.grace_period_initialization < GRACE_PERIOD_VALIDATION_RULES.initialization.min || 
      settings.grace_period_initialization > GRACE_PERIOD_VALIDATION_RULES.initialization.max)) {
    errors.push({
      field: 'grace_period_initialization',
      message: `Initialization grace period must be between ${GRACE_PERIOD_VALIDATION_RULES.initialization.min/1000}-${GRACE_PERIOD_VALIDATION_RULES.initialization.max/1000} seconds`,
      currentValue: settings.grace_period_initialization,
      recommendedValue: GRACE_PERIOD_PRESETS.balanced.initialization
    });
  }

  // Validate movement grace period
  if (settings.grace_period_movement && (settings.grace_period_movement < GRACE_PERIOD_VALIDATION_RULES.movement.min || 
      settings.grace_period_movement > GRACE_PERIOD_VALIDATION_RULES.movement.max)) {
    errors.push({
      field: 'grace_period_movement',
      message: `Movement grace period must be between ${GRACE_PERIOD_VALIDATION_RULES.movement.min/1000}-${GRACE_PERIOD_VALIDATION_RULES.movement.max/1000} seconds`,
      currentValue: settings.grace_period_movement,
      recommendedValue: GRACE_PERIOD_PRESETS.balanced.movement
    });
  }

  // Validate app resume grace period
  if (settings.grace_period_app_resume && (settings.grace_period_app_resume < GRACE_PERIOD_VALIDATION_RULES.appResume.min || 
      settings.grace_period_app_resume > GRACE_PERIOD_VALIDATION_RULES.appResume.max)) {
    errors.push({
      field: 'grace_period_app_resume',
      message: `App resume grace period must be between ${GRACE_PERIOD_VALIDATION_RULES.appResume.min/1000}-${GRACE_PERIOD_VALIDATION_RULES.appResume.max/1000} seconds`,
      currentValue: settings.grace_period_app_resume,
      recommendedValue: GRACE_PERIOD_PRESETS.balanced.appResume
    });
  }

  // Validate movement threshold
  if (settings.significant_movement_threshold && (settings.significant_movement_threshold < GRACE_PERIOD_VALIDATION_RULES.movementThreshold.min || 
      settings.significant_movement_threshold > GRACE_PERIOD_VALIDATION_RULES.movementThreshold.max)) {
    errors.push({
      field: 'significant_movement_threshold',
      message: `Movement threshold must be between ${GRACE_PERIOD_VALIDATION_RULES.movementThreshold.min}-${GRACE_PERIOD_VALIDATION_RULES.movementThreshold.max} meters`,
      currentValue: settings.significant_movement_threshold,
      recommendedValue: GRACE_PERIOD_PRESETS.balanced.movementThreshold
    });
  }

  // Validate location settling grace period
  if (settings.location_settling_grace_period && (settings.location_settling_grace_period < GRACE_PERIOD_VALIDATION_RULES.locationSettling.min || 
      settings.location_settling_grace_period > GRACE_PERIOD_VALIDATION_RULES.locationSettling.max)) {
    errors.push({
      field: 'location_settling_grace_period',
      message: `Location settling grace period must be between ${GRACE_PERIOD_VALIDATION_RULES.locationSettling.min/1000}-${GRACE_PERIOD_VALIDATION_RULES.locationSettling.max/1000} seconds`,
      currentValue: settings.location_settling_grace_period,
      recommendedValue: GRACE_PERIOD_PRESETS.balanced.locationSettling
    });
  }

  // Logical validation: movement should be shorter than initialization
  if (settings.grace_period_movement && settings.grace_period_initialization && 
      settings.grace_period_movement > settings.grace_period_initialization) {
    warnings.push({
      field: 'grace_period_logic',
      message: 'Movement grace period is longer than initialization grace period, which may cause unexpected behavior',
      currentValue: settings.grace_period_movement,
      recommendedValue: Math.min(settings.grace_period_movement, settings.grace_period_initialization - 1000)
    });
  }

  // Logical validation: app resume should be shorter than or equal to movement
  if (settings.grace_period_app_resume && settings.grace_period_movement && 
      settings.grace_period_app_resume > settings.grace_period_movement) {
    warnings.push({
      field: 'grace_period_logic',
      message: 'App resume grace period is longer than movement grace period, consider reducing it',
      currentValue: settings.grace_period_app_resume,
      recommendedValue: Math.min(settings.grace_period_app_resume, settings.grace_period_movement)
    });
  }

  // Logical validation: location settling should be reasonable compared to other periods
  if (settings.location_settling_grace_period && settings.grace_period_movement && 
      settings.location_settling_grace_period > settings.grace_period_movement) {
    warnings.push({
      field: 'grace_period_logic',
      message: 'Location settling period is longer than movement grace period, which may delay proximity detection',
      currentValue: settings.location_settling_grace_period,
      recommendedValue: Math.min(settings.location_settling_grace_period, settings.grace_period_movement)
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const autoCorrectGracePeriodValues = (settings: Partial<ProximitySettings>): ProximitySettings => {
  const corrected = { ...settings } as ProximitySettings;
  
  // Ensure required fields have defaults
  if (!corrected.user_id) corrected.user_id = '';
  if (corrected.is_enabled === undefined) corrected.is_enabled = true;
  if (!corrected.notification_distance) corrected.notification_distance = 100;
  if (!corrected.outer_distance) corrected.outer_distance = 250;
  if (!corrected.card_distance) corrected.card_distance = 50;
  if (!corrected.grace_period_initialization) corrected.grace_period_initialization = GRACE_PERIOD_PRESETS.balanced.initialization;
  if (!corrected.grace_period_movement) corrected.grace_period_movement = GRACE_PERIOD_PRESETS.balanced.movement;
  if (!corrected.grace_period_app_resume) corrected.grace_period_app_resume = GRACE_PERIOD_PRESETS.balanced.appResume;
  if (!corrected.significant_movement_threshold) corrected.significant_movement_threshold = GRACE_PERIOD_PRESETS.balanced.movementThreshold;
  if (corrected.grace_period_enabled === undefined) corrected.grace_period_enabled = true;
  if (!corrected.location_settling_grace_period) corrected.location_settling_grace_period = GRACE_PERIOD_PRESETS.balanced.locationSettling;
  
  // Auto-correct out-of-range values to nearest valid value
  if (corrected.grace_period_initialization < GRACE_PERIOD_VALIDATION_RULES.initialization.min) {
    corrected.grace_period_initialization = GRACE_PERIOD_VALIDATION_RULES.initialization.min;
  } else if (corrected.grace_period_initialization > GRACE_PERIOD_VALIDATION_RULES.initialization.max) {
    corrected.grace_period_initialization = GRACE_PERIOD_VALIDATION_RULES.initialization.max;
  }

  if (corrected.grace_period_movement < GRACE_PERIOD_VALIDATION_RULES.movement.min) {
    corrected.grace_period_movement = GRACE_PERIOD_VALIDATION_RULES.movement.min;
  } else if (corrected.grace_period_movement > GRACE_PERIOD_VALIDATION_RULES.movement.max) {
    corrected.grace_period_movement = GRACE_PERIOD_VALIDATION_RULES.movement.max;
  }

  if (corrected.grace_period_app_resume < GRACE_PERIOD_VALIDATION_RULES.appResume.min) {
    corrected.grace_period_app_resume = GRACE_PERIOD_VALIDATION_RULES.appResume.min;
  } else if (corrected.grace_period_app_resume > GRACE_PERIOD_VALIDATION_RULES.appResume.max) {
    corrected.grace_period_app_resume = GRACE_PERIOD_VALIDATION_RULES.appResume.max;
  }

  if (corrected.significant_movement_threshold < GRACE_PERIOD_VALIDATION_RULES.movementThreshold.min) {
    corrected.significant_movement_threshold = GRACE_PERIOD_VALIDATION_RULES.movementThreshold.min;
  } else if (corrected.significant_movement_threshold > GRACE_PERIOD_VALIDATION_RULES.movementThreshold.max) {
    corrected.significant_movement_threshold = GRACE_PERIOD_VALIDATION_RULES.movementThreshold.max;
  }

  if (corrected.location_settling_grace_period < GRACE_PERIOD_VALIDATION_RULES.locationSettling.min) {
    corrected.location_settling_grace_period = GRACE_PERIOD_VALIDATION_RULES.locationSettling.min;
  } else if (corrected.location_settling_grace_period > GRACE_PERIOD_VALIDATION_RULES.locationSettling.max) {
    corrected.location_settling_grace_period = GRACE_PERIOD_VALIDATION_RULES.locationSettling.max;
  }

  return corrected;
};

export const getRecommendedGracePeriodPreset = (settings: ProximitySettings): keyof typeof GRACE_PERIOD_PRESETS => {
  // Calculate distance from each preset
  const distances = Object.entries(GRACE_PERIOD_PRESETS).map(([name, preset]) => {
    const distance = Math.sqrt(
      Math.pow(settings.grace_period_initialization - preset.initialization, 2) +
      Math.pow(settings.grace_period_movement - preset.movement, 2) +
      Math.pow(settings.grace_period_app_resume - preset.appResume, 2) +
      Math.pow(settings.significant_movement_threshold - preset.movementThreshold, 2) +
      Math.pow(settings.location_settling_grace_period - preset.locationSettling, 2)
    );
    return { name: name as keyof typeof GRACE_PERIOD_PRESETS, distance };
  });

  // Return the preset with the smallest distance
  return distances.reduce((min, current) => current.distance < min.distance ? current : min).name;
};

// Check if grace period configuration is valid
export const isGracePeriodConfigurationValid = (settings: ProximitySettings): boolean => {
  const validation = validateGracePeriodRanges(settings);
  return validation.isValid;
};
