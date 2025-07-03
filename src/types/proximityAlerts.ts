export interface ProximityAlert {
  id: string;
  user_id: string;
  landmark_id: string;
  distance: number; // in meters
  is_enabled: boolean;
  last_triggered?: string; // ISO timestamp
  created_at: string;
  updated_at: string;
}

export interface ProximitySettings {
  id?: string;
  user_id: string;
  is_enabled: boolean;
  notification_distance: number; // in meters - for toast notifications
  outer_distance: number; // in meters - for Street View prep zone
  card_distance: number; // in meters - for floating card notifications
  initialization_timestamp?: number; // timestamp when proximity was first enabled for current session
  // New grace period configuration fields
  grace_period_initialization: number; // in milliseconds, default 15000
  grace_period_movement: number; // in milliseconds, default 8000
  grace_period_app_resume: number; // in milliseconds, default 5000
  significant_movement_threshold: number; // in meters, default 150
  grace_period_enabled: boolean; // default true
  created_at?: string;
  updated_at?: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface LocationTrackingState {
  isTracking: boolean;
  isPermissionGranted: boolean | null;
  error: string | null;
  lastUpdate: Date | null;
  movementDetected: boolean;
  pollInterval: number; // current polling interval in ms
}

export interface ProximityState {
  proximityAlerts: ProximityAlert[];
  proximitySettings: ProximitySettings | null;
  userLocation: UserLocation | null;
  locationTracking: LocationTrackingState;
  isLoading: boolean;
}

export interface LocationHistoryEntry {
  location: UserLocation;
  timestamp: number;
  accuracy?: number;
}

export interface ProximityDetectionResult {
  alert: ProximityAlert;
  distance: number;
  isWithinRange: boolean;
  hasEntered: boolean;
  hasExited: boolean;
}

// Enhanced grace period state
export interface GracePeriodState {
  initializationTimestamp: number | null;
  gracePeriodActive: boolean;
  gracePeriodReason: 'initialization' | 'movement' | 'app_resume' | null;
  lastMovementCheck: number | null;
  backgroundedAt: number | null;
  resumedAt: number | null;
}

// Movement detection for smart grace period
export interface MovementDetectionResult {
  significantMovement: boolean;
  distance: number;
  timeSinceLastCheck: number;
  shouldClearGracePeriod: boolean;
}

// Grace Period Validation Types
export interface GracePeriodValidationError {
  field: 'grace_period_initialization' | 'grace_period_movement' | 'grace_period_app_resume' | 'significant_movement_threshold' | 'grace_period_logic';
  message: string;
  currentValue?: number;
  recommendedValue?: number;
}

export interface GracePeriodValidationResult {
  isValid: boolean;
  errors: GracePeriodValidationError[];
  warnings: GracePeriodValidationError[];
}

export interface GracePeriodValidationRules {
  initialization: { min: number; max: number };
  movement: { min: number; max: number };
  appResume: { min: number; max: number };
  movementThreshold: { min: number; max: number };
}

export interface GracePeriodRecommendations {
  conservative: {
    initialization: number;
    movement: number;
    appResume: number;
    movementThreshold: number;
  };
  balanced: {
    initialization: number;
    movement: number;
    appResume: number;
    movementThreshold: number;
  };
  aggressive: {
    initialization: number;
    movement: number;
    appResume: number;
    movementThreshold: number;
  };
}
