
import { proximityEnabledDebouncer } from './proximityEnabledDebouncer';

// GeolocateControl event types with specific debounce timings
type GeolocateEventType = 'geolocate' | 'trackuserlocationstart' | 'trackuserlocationend' | 'error';

// Event-specific debounce delays (in milliseconds)
const EVENT_DEBOUNCE_DELAYS: Record<GeolocateEventType, number> = {
  geolocate: 1000,              // Location updates can be rapid during movement
  trackuserlocationstart: 500,   // Should be responsive to user actions
  trackuserlocationend: 500,     // Should be responsive to user actions
  error: 2000                   // Errors need longer cooling period to avoid spam
};

// Event coalescing window (group events within this timeframe)
const EVENT_COALESCING_WINDOW = 200; // ms

// Event priority for filtering (higher number = higher priority)
const EVENT_PRIORITY: Record<GeolocateEventType, number> = {
  trackuserlocationstart: 4,     // Manual user actions have highest priority
  trackuserlocationend: 4,       // Manual user actions have highest priority
  geolocate: 2,                 // Location updates are medium priority
  error: 1                      // Errors are lowest priority (often cascading)
};

interface GeolocateEvent {
  type: GeolocateEventType;
  timestamp: number;
  enabled: boolean;
  source: string;
  watchState?: string;
}

interface GeolocateDebounceState {
  lastEventTimestamp: number;
  lastEventType: GeolocateEventType | null;
  eventQueue: GeolocateEvent[];
  activeTimeouts: Map<GeolocateEventType, NodeJS.Timeout>;
  isProcessing: boolean;
  lastProcessedState: boolean | null;
  consecutiveEventsCount: number;
  lastWatchState: string | null;
}

class GeolocateControlDebouncer {
  private state: GeolocateDebounceState = {
    lastEventTimestamp: 0,
    lastEventType: null,
    eventQueue: [],
    activeTimeouts: new Map(),
    isProcessing: false,
    lastProcessedState: null,
    consecutiveEventsCount: 0,
    lastWatchState: null
  };

  private debugEnabled = process.env.NODE_ENV === 'development';

  private log(message: string, data?: any) {
    if (this.debugEnabled) {
      console.log(`🗺️ [GeolocateDebouncer] ${message}`, data || '');
    }
  }

  private shouldSkipEvent(event: GeolocateEvent): boolean {
    const now = Date.now();
    
    // Skip if same event type with same state within coalescing window
    if (this.state.lastEventType === event.type && 
        this.state.lastProcessedState === event.enabled &&
        now - this.state.lastEventTimestamp < EVENT_COALESCING_WINDOW) {
      this.log(`Skipping duplicate ${event.type} event within coalescing window`);
      return true;
    }

    // Smart state-aware filtering
    switch (event.type) {
      case 'trackuserlocationstart':
        // Skip if already in ACTIVE state
        if (event.watchState === 'ACTIVE_LOCK' && this.state.lastWatchState === 'ACTIVE_LOCK') {
          this.log('Skipping trackuserlocationstart - already in ACTIVE state');
          return true;
        }
        break;
        
      case 'geolocate':
        // Skip geolocate events during stable tracking periods (reduce noise)
        if (this.state.lastEventType === 'geolocate' && 
            now - this.state.lastEventTimestamp < 2000 &&
            this.state.consecutiveEventsCount > 3) {
          this.log('Skipping geolocate event - too frequent during stable tracking');
          return true;
        }
        break;
        
      case 'error':
        // Skip error events during normal state transitions
        if (this.state.lastEventType === 'trackuserlocationstart' || 
            this.state.lastEventType === 'trackuserlocationend') {
          if (now - this.state.lastEventTimestamp < 1000) {
            this.log('Skipping error event - likely part of normal state transition');
            return true;
          }
        }
        break;
    }

    return false;
  }

  private getHighestPriorityEvent(events: GeolocateEvent[]): GeolocateEvent {
    return events.reduce((highest, current) => 
      EVENT_PRIORITY[current.type] > EVENT_PRIORITY[highest.type] ? current : highest
    );
  }

  private async processEvent(event: GeolocateEvent, userId: string) {
    this.state.isProcessing = true;
    
    try {
      this.log(`Processing ${event.type} event`, {
        enabled: event.enabled,
        source: event.source,
        watchState: event.watchState,
        priority: EVENT_PRIORITY[event.type]
      });

      // Use the existing proximity debouncer for final database update
      // but with GeolocateControl-specific source tracking
      const success = proximityEnabledDebouncer.debounceEnabledUpdate(
        userId,
        event.enabled,
        async (debouncedEnabled: boolean) => {
          this.log(`Executing final proximity update from ${event.type}`, { 
            enabled: debouncedEnabled,
            originalEvent: event.type
          });
        },
        `GeolocateControl-${event.type}`
      );

      if (success) {
        this.state.lastProcessedState = event.enabled;
        this.state.lastWatchState = event.watchState || null;
        
        // Reset consecutive count if different event type
        if (this.state.lastEventType !== event.type) {
          this.state.consecutiveEventsCount = 1;
        } else {
          this.state.consecutiveEventsCount++;
        }
        
        this.state.lastEventType = event.type;
        this.state.lastEventTimestamp = Date.now();
      }

    } catch (error) {
      console.error('🗺️ [GeolocateDebouncer] Error processing event:', error);
    } finally {
      this.state.isProcessing = false;
    }
  }

  public debounceGeolocateEvent(
    userId: string,
    eventType: GeolocateEventType,
    enabled: boolean,
    updateCallback: (enabled: boolean) => Promise<void>,
    watchState?: string
  ): boolean {
    const now = Date.now();
    const event: GeolocateEvent = {
      type: eventType,
      timestamp: now,
      enabled,
      source: `GeolocateControl-${eventType}`,
      watchState
    };

    // Check if we should skip this event entirely
    if (this.shouldSkipEvent(event)) {
      return false; // Event was filtered out
    }

    // Clear existing timeout for this event type if it exists
    const existingTimeout = this.state.activeTimeouts.get(eventType);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.state.activeTimeouts.delete(eventType);
    }

    // Add event to queue for coalescing
    this.state.eventQueue.push(event);

    // Set up debounced execution
    const debounceDelay = EVENT_DEBOUNCE_DELAYS[eventType];
    const timeout = setTimeout(async () => {
      // Remove from active timeouts
      this.state.activeTimeouts.delete(eventType);
      
      // Get all events of this type from queue within coalescing window
      const relevantEvents = this.state.eventQueue.filter(e => 
        e.type === eventType && 
        now - e.timestamp <= debounceDelay + EVENT_COALESCING_WINDOW
      );
      
      if (relevantEvents.length === 0) return;
      
      // Process the highest priority event (latest one for same type)
      const eventToProcess = relevantEvents[relevantEvents.length - 1];
      
      // Remove processed events from queue
      this.state.eventQueue = this.state.eventQueue.filter(e => 
        !relevantEvents.includes(e)
      );
      
      // Execute the actual update callback
      await updateCallback(eventToProcess.enabled);
      
      // Update our internal tracking
      await this.processEvent(eventToProcess, userId);
      
    }, debounceDelay);

    this.state.activeTimeouts.set(eventType, timeout);
    
    this.log(`Queued ${eventType} event with ${debounceDelay}ms debounce`, {
      enabled,
      watchState,
      queueSize: this.state.eventQueue.length,
      activeTimeouts: this.state.activeTimeouts.size
    });

    return true; // Event was queued successfully
  }

  // Emergency cleanup function
  public emergencyBrake(userId: string) {
    this.log('🚨 Emergency brake activated - clearing all GeolocateControl timeouts');
    
    // Clear all active timeouts
    this.state.activeTimeouts.forEach(timeout => clearTimeout(timeout));
    this.state.activeTimeouts.clear();
    
    // Clear event queue
    this.state.eventQueue = [];
    
    // Reset processing state
    this.state.isProcessing = false;
    
    // Also trigger emergency brake on the underlying debouncer
    proximityEnabledDebouncer.emergencyBrake(userId);
  }

  // Debug information getter
  public getDebugInfo() {
    if (!this.debugEnabled) return null;
    
    return {
      state: { ...this.state },
      eventDelays: EVENT_DEBOUNCE_DELAYS,
      eventPriorities: EVENT_PRIORITY,
      activeTimeoutCount: this.state.activeTimeouts.size,
      queuedEventCount: this.state.eventQueue.length
    };
  }

  // Get metrics for monitoring
  public getMetrics() {
    return {
      queuedEvents: this.state.eventQueue.length,
      activeTimeouts: this.state.activeTimeouts.size,
      isProcessing: this.state.isProcessing,
      consecutiveEvents: this.state.consecutiveEventsCount,
      lastEventType: this.state.lastEventType,
      lastProcessedState: this.state.lastProcessedState
    };
  }
}

// Export singleton instance
export const geolocateControlDebouncer = new GeolocateControlDebouncer();

// Expose debug functions to window in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).geolocateDebugger = {
    getDebugInfo: () => geolocateControlDebouncer.getDebugInfo(),
    getMetrics: () => geolocateControlDebouncer.getMetrics(),
    emergencyBrake: (userId: string) => geolocateControlDebouncer.emergencyBrake(userId)
  };
}
