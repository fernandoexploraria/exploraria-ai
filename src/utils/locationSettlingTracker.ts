
import { UserLocation } from '@/types/proximityAlerts';
import { getGracePeriodConstants } from '@/utils/smartGracePeriod';

export interface LocationSettlingState {
  isSettling: boolean;
  settlingStartTime: number | null;
  settlingLocation: UserLocation | null;
  lastStableLocation: UserLocation | null;
  settlingCallbacks: Set<(location: UserLocation) => void>;
}

class LocationSettlingTracker {
  private static instance: LocationSettlingTracker;
  private state: LocationSettlingState = {
    isSettling: false,
    settlingStartTime: null,
    settlingLocation: null,
    lastStableLocation: null,
    settlingCallbacks: new Set(),
  };
  
  private settlingTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    console.log('📍 [Location Settling] Tracker initialized');
  }

  static getInstance(): LocationSettlingTracker {
    if (!LocationSettlingTracker.instance) {
      LocationSettlingTracker.instance = new LocationSettlingTracker();
    }
    return LocationSettlingTracker.instance;
  }

  /**
   * Process a new location and apply settling logic
   */
  processLocation(
    location: UserLocation, 
    settings: any = null,
    onSettledCallback?: (location: UserLocation) => void
  ): void {
    const now = Date.now();
    const constants = getGracePeriodConstants(settings);
    const settlingPeriod = constants.LOCATION_SETTLING;

    console.log('📍 [Location Settling] Processing location:', {
      location: location,
      isSettling: this.state.isSettling,
      settlingPeriod: settlingPeriod
    });

    // If we're not currently settling, start settling for this location
    if (!this.state.isSettling) {
      this.startSettling(location, settlingPeriod, onSettledCallback);
    } else {
      // Check if this is a significant change from the settling location
      const distance = this.calculateDistance(
        this.state.settlingLocation!.latitude,
        this.state.settlingLocation!.longitude,
        location.latitude,
        location.longitude
      );

      // If location changed significantly during settling, restart settling
      if (distance > 10) { // 10 meter threshold for settling interruption
        console.log('📍 [Location Settling] Location changed during settling, restarting');
        this.cancelSettling();
        this.startSettling(location, settlingPeriod, onSettledCallback);
      } else {
        // Update the settling location with the latest reading
        this.state.settlingLocation = location;
      }
    }
  }

  private startSettling(
    location: UserLocation, 
    settlingPeriod: number,
    onSettledCallback?: (location: UserLocation) => void
  ): void {
    console.log('📍 [Location Settling] Starting settling period:', {
      location: location,
      period: settlingPeriod
    });

    this.state.isSettling = true;
    this.state.settlingStartTime = Date.now();
    this.state.settlingLocation = location;

    if (onSettledCallback) {
      this.state.settlingCallbacks.add(onSettledCallback);
    }

    // Set timeout for settling completion
    this.settlingTimeout = setTimeout(() => {
      this.completeSettling();
    }, settlingPeriod);
  }

  private completeSettling(): void {
    if (!this.state.isSettling || !this.state.settlingLocation) {
      return;
    }

    const settlingDuration = Date.now() - (this.state.settlingStartTime || 0);
    
    console.log('📍 [Location Settling] Settling completed:', {
      location: this.state.settlingLocation,
      duration: settlingDuration
    });

    // Mark location as stable
    this.state.lastStableLocation = this.state.settlingLocation;
    
    // Notify all callbacks
    this.state.settlingCallbacks.forEach(callback => {
      try {
        callback(this.state.lastStableLocation!);
      } catch (error) {
        console.error('📍 [Location Settling] Error in callback:', error);
      }
    });

    // Reset settling state
    this.resetSettlingState();
  }

  private cancelSettling(): void {
    console.log('📍 [Location Settling] Cancelling settling');
    
    if (this.settlingTimeout) {
      clearTimeout(this.settlingTimeout);
      this.settlingTimeout = null;
    }
    
    this.resetSettlingState();
  }

  private resetSettlingState(): void {
    this.state.isSettling = false;
    this.state.settlingStartTime = null;
    this.state.settlingLocation = null;
    this.state.settlingCallbacks.clear();
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Get the current settling state
   */
  getState(): LocationSettlingState {
    return { ...this.state };
  }

  /**
   * Get the last stable location
   */
  getLastStableLocation(): UserLocation | null {
    return this.state.lastStableLocation;
  }

  /**
   * Check if location is currently settling
   */
  isCurrentlySettling(): boolean {
    return this.state.isSettling;
  }

  /**
   * Get remaining settling time in milliseconds
   */
  getRemainingSettlingTime(settings: any = null): number {
    if (!this.state.isSettling || !this.state.settlingStartTime) {
      return 0;
    }

    const constants = getGracePeriodConstants(settings);
    const settlingPeriod = constants.LOCATION_SETTLING;
    const elapsed = Date.now() - this.state.settlingStartTime;
    
    return Math.max(0, settlingPeriod - elapsed);
  }
}

export const locationSettlingTracker = LocationSettlingTracker.getInstance();
