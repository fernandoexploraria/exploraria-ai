export interface GeolocateEventUpdate {
  eventType: 'geolocate' | 'trackuserlocationstart' | 'trackuserlocationend' | 'error';
  enabled: boolean;
  timestamp: number;
  source: string;
  controlState?: string;
}

export interface GeolocateEventEntry {
  update: GeolocateEventUpdate;
  action: 'queued' | 'executed' | 'skipped' | 'filtered';
  reason?: string;
}

export class GeolocateControlDebouncer {
  private static instance: GeolocateControlDebouncer;
  private eventDebouncers = new Map<string, NodeJS.Timeout>();
  private cooldownPeriods = new Map<string, number>();
  private eventHistory = new Map<string, GeolocateEventEntry[]>();
  private activeFlags = new Set<string>();
  
  // Event-specific debounce delays
  private readonly EVENT_DEBOUNCE_DELAYS = {
    geolocate: 1000,           // Location found events can be rapid
    trackuserlocationstart: 500, // Should be responsive
    trackuserlocationend: 500,   // Should be responsive
    error: 2000                 // Errors should have longer cooling off
  };
  
  // Enhanced cooldown periods (3-5 seconds)
  private readonly EVENT_COOLDOWN_PERIODS = {
    geolocate: 3000,
    trackuserlocationstart: 4000,
    trackuserlocationend: 4000,
    error: 5000
  };
  
  private readonly HISTORY_BUFFER_SIZE = 5;
  
  private constructor() {
    console.log('🗺️ [GeolocateDebouncer] GeolocateControl event debouncer initialized');
  }
  
  static getInstance(): GeolocateControlDebouncer {
    if (!GeolocateControlDebouncer.instance) {
      GeolocateControlDebouncer.instance = new GeolocateControlDebouncer();
    }
    return GeolocateControlDebouncer.instance;
  }
  
  // Multi-source update prevention flags
  setUpdateFlag(flagName: string, timeout: number = 2000): void {
    this.activeFlags.add(flagName);
    console.log(`🚩 [GeolocateDebouncer] Set flag: ${flagName}`);
    
    setTimeout(() => {
      this.activeFlags.delete(flagName);
      console.log(`🚩 [GeolocateDebouncer] Cleared flag: ${flagName}`);
    }, timeout);
  }
  
  hasActiveFlag(flagName: string): boolean {
    return this.activeFlags.has(flagName);
  }
  
  hasAnyActiveFlag(): boolean {
    return this.activeFlags.size > 0;
  }
  
  getActiveFlags(): string[] {
    return Array.from(this.activeFlags);
  }
  
  // Smart event filtering
  private shouldFilterEvent(eventType: string, enabled: boolean, controlState?: string): boolean {
    // Skip trackuserlocationstart if already in ACTIVE state
    if (eventType === 'trackuserlocationstart' && controlState === 'ACTIVE_LOCK') {
      return true;
    }
    
    // Skip geolocate events during active tracking
    if (eventType === 'geolocate' && this.hasActiveFlag('geolocateEventInProgress')) {
      return true;
    }
    
    // Filter out error events during normal state transitions
    if (eventType === 'error' && (this.hasActiveFlag('isUpdatingFromUserAction') || this.hasActiveFlag('isUpdatingFromGeolocateControl'))) {
      return true;
    }
    
    return false;
  }
  
  // Event pattern recognition for deduplication
  private detectEventPattern(eventType: string): boolean {
    const history = this.eventHistory.get(eventType) || [];
    const now = Date.now();
    
    // Look for rapid repeated events in the last 2 seconds
    const recentEvents = history.filter(entry => 
      now - entry.update.timestamp <= 2000
    );
    
    if (recentEvents.length >= 3) {
      console.warn(`🔄 [GeolocateDebouncer] Event pattern detected for ${eventType}:`, {
        eventType,
        recentCount: recentEvents.length,
        timeWindow: '2s'
      });
      return true;
    }
    
    return false;
  }
  
  private addToHistory(eventType: string, entry: GeolocateEventEntry): void {
    const history = this.eventHistory.get(eventType) || [];
    history.push(entry);
    
    // Keep only the last HISTORY_BUFFER_SIZE entries
    if (history.length > this.HISTORY_BUFFER_SIZE) {
      history.shift();
    }
    
    this.eventHistory.set(eventType, history);
  }
  
  debounceGeolocateEvent(
    eventType: GeolocateEventUpdate['eventType'],
    enabled: boolean,
    updateFunction: (enabled: boolean) => Promise<void>,
    controlState?: string
  ): boolean {
    const now = Date.now();
    const eventKey = eventType;
    
    const update: GeolocateEventUpdate = {
      eventType,
      enabled,
      timestamp: now,
      source: 'GeolocateControl',
      controlState
    };
    
    console.log(`🗺️ [GeolocateDebouncer] ${eventType} event received:`, { 
      enabled, 
      controlState,
      activeFlags: this.getActiveFlags()
    });
    
    // Check for active update flags (priority system)
    if (this.hasActiveFlag('isUpdatingFromUserAction')) {
      const reason = 'Manual user action in progress - skipping GeolocateControl event';
      console.log(`🚫 [GeolocateDebouncer] Event blocked: ${reason}`);
      
      this.addToHistory(eventKey, { update, action: 'skipped', reason });
      return false;
    }
    
    // Smart event filtering
    if (this.shouldFilterEvent(eventType, enabled, controlState)) {
      const reason = `Event filtered based on current state (${controlState})`;
      console.log(`🚫 [GeolocateDebouncer] Event filtered: ${reason}`);
      
      this.addToHistory(eventKey, { update, action: 'filtered', reason });
      return false;
    }
    
    // Event pattern detection
    if (this.detectEventPattern(eventType)) {
      const reason = 'Rapid event pattern detected - applying cooldown';
      console.log(`🚫 [GeolocateDebouncer] Event blocked: ${reason}`);
      
      this.addToHistory(eventKey, { update, action: 'skipped', reason });
      return false;
    }
    
    // Check cooldown period
    const lastCooldown = this.cooldownPeriods.get(eventKey);
    const cooldownPeriod = this.EVENT_COOLDOWN_PERIODS[eventType];
    
    if (lastCooldown && now - lastCooldown < cooldownPeriod) {
      const remainingCooldown = Math.round((cooldownPeriod - (now - lastCooldown)) / 1000);
      const reason = `Cooldown active (${remainingCooldown}s remaining)`;
      
      console.log(`⏳ [GeolocateDebouncer] Event in cooldown: ${reason}`);
      this.addToHistory(eventKey, { update, action: 'skipped', reason });
      
      return false;
    }
    
    // Clear existing timeout for this event type
    const existingTimeout = this.eventDebouncers.get(eventKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      console.log(`🔄 [GeolocateDebouncer] Cleared existing timeout for ${eventType}`);
    }
    
    // Set update flag to prevent conflicts
    this.setUpdateFlag('isUpdatingFromGeolocateControl', 3000);
    
    if (eventType === 'geolocate') {
      this.setUpdateFlag('geolocateEventInProgress', 2000);
    }
    
    // Set new debounced timeout
    const debounceDelay = this.EVENT_DEBOUNCE_DELAYS[eventType];
    const timeout = setTimeout(async () => {
      console.log(`⚡ [GeolocateDebouncer] Executing ${eventType} update:`, { enabled });
      
      try {
        await updateFunction(enabled);
        
        // Set cooldown period
        this.cooldownPeriods.set(eventKey, Date.now());
        
        // Update history
        this.addToHistory(eventKey, { 
          update, 
          action: 'executed',
          reason: `Debounced execution after ${debounceDelay}ms`
        });
        
        console.log(`✅ [GeolocateDebouncer] Successfully executed ${eventType} update`);
        
      } catch (error) {
        console.error(`❌ [GeolocateDebouncer] Failed to execute ${eventType} update:`, error);
        
        // Retry with exponential backoff
        setTimeout(() => {
          this.debounceGeolocateEvent(eventType, enabled, updateFunction, controlState);
        }, debounceDelay * 2);
      }
      
      // Clean up
      this.eventDebouncers.delete(eventKey);
    }, debounceDelay);
    
    this.eventDebouncers.set(eventKey, timeout);
    
    console.log(`⏱️ [GeolocateDebouncer] ${eventType} event queued (${debounceDelay}ms delay)`);
    this.addToHistory(eventKey, { 
      update, 
      action: 'queued',
      reason: `Debounced for ${debounceDelay}ms`
    });
    
    return true;
  }
  
  // Emergency cleanup
  clearAllTimeouts(): void {
    console.log('🧹 [GeolocateDebouncer] Clearing all timeouts');
    
    for (const timeout of this.eventDebouncers.values()) {
      clearTimeout(timeout);
    }
    
    this.eventDebouncers.clear();
    this.activeFlags.clear();
  }
  
  // Debug utilities
  getEventHistory(eventType?: string): Map<string, GeolocateEventEntry[]> | GeolocateEventEntry[] {
    if (eventType) {
      return this.eventHistory.get(eventType) || [];
    }
    return this.eventHistory;
  }
  
  dumpDebugInfo(): void {
    console.group('🗺️ [GeolocateDebouncer] Debug Information');
    console.log('Active Flags:', this.getActiveFlags());
    console.log('Active Timeouts:', Array.from(this.eventDebouncers.keys()));
    console.log('Cooldown States:', Array.from(this.cooldownPeriods.entries()).map(([key, time]) => ({
      eventType: key,
      cooldownUntil: new Date(time + this.EVENT_COOLDOWN_PERIODS[key as keyof typeof this.EVENT_COOLDOWN_PERIODS]).toISOString(),
      remainingMs: Math.max(0, (time + this.EVENT_COOLDOWN_PERIODS[key as keyof typeof this.EVENT_COOLDOWN_PERIODS]) - Date.now())
    })));
    console.log('Event History:', Object.fromEntries(this.eventHistory));
    console.groupEnd();
  }
}

export const geolocateControlDebouncer = GeolocateControlDebouncer.getInstance();
