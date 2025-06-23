
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
  default_distance: number; // in meters
  notification_enabled: boolean;
  sound_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface ProximityState {
  proximityAlerts: ProximityAlert[];
  proximitySettings: ProximitySettings | null;
  userLocation: UserLocation | null;
  isLoading: boolean;
}
