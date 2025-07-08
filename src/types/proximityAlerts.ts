
export interface ProximityAlert {
  id: string;
  user_id: string;
  landmark_id: string;
  distance: number; // in meters
  last_triggered?: string; // ISO timestamp
  created_at: string;
  updated_at: string;
}

export interface ProximitySettings {
  id?: string;
  user_id: string;
  notification_distance: number; // in meters - for toast notifications
  outer_distance: number; // in meters - for Street View prep zone
  card_distance: number; // in meters - for floating card notifications
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
