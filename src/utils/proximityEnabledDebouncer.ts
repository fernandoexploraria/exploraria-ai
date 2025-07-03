import { ProximitySettings } from '@/types/proximityAlerts';

export interface EnabledStateUpdate {
  enabled: boolean;
  timestamp: number;
  userId: string;
  source?: string; // Track call source (e.g., 'GeolocateControl', 'UserToggle', 'SystemEvent')
  stackTrace?: string; // For debugging in development
}

export interface EnabledCallHistoryEntry {
  update: EnabledStateUpdate;
  action: 'queued' | 'executed' | 'skipped' | 'blocked';
  reason?: string;
  processingTime?: number;
}

export interface EnabledDebounceMetrics {
  totalUpdates: number;
  debouncedUpdates: number;
  duplicatesSkipped: number;
  patternDuplicatesSkipped: number;
  averageDebounceDelay: number;
  cooldownBlocks: number;
  rapidCallWarnings: number;
  callsPerSecond: number;
  burstPatterns: number;
}

export class ProximityEnabledDebouncer {
  private static instance: ProximityEnabledDebouncer;
  private pendingUpdates = new Map<string, EnabledStateUpdate>();
  private updateTimeouts = new Map<string, NodeJS.Timeout>();
  private lastUpdates = new Map<string, { enabled: boolean; timestamp: number }>();
  private cooldownPeriods = new Map<string, number>();
  private callHistory = new Map<string, EnabledCallHistoryEntry[]>(); // Rolling buffer per user
  private rapidCallDetection = new Map<string, { count: number; windowStart: number }>();
  
  private metrics: EnabledDebounceMetrics = {
    totalUpdates: 0,
    debouncedUpdates: 0,
    duplicatesSkipped: 0,
    patternDuplicatesSkipped: 0,
    averageDebounceDelay: 0,
    cooldownBlocks: 0,
    rapidCallWarnings: 0,
    callsPerSecond: 0,
    burstPatterns: 0,
  };

  private readonly DEBOUNCE_DELAY = 500; // 500ms for responsiveness
  private readonly COOLDOWN_PERIOD = 2000; // 2 seconds between toggles
  private readonly DUPLICATE_THRESHOLD = 1000; // 1 second for duplicate detection
  private readonly RAPID_CALL_THRESHOLD = 5; // Max 5 calls per second
  private readonly RAPID_CALL_WINDOW = 1000; // 1 second window
  private readonly HISTORY_BUFFER_SIZE = 10; // Keep last 10 calls per user
  private readonly PATTERN_DETECTION_WINDOW = 5000; // 5 seconds for pattern detection

  private constructor() {
    console.log('⚡ [EnabledDebouncer] Enhanced proximity enabled debouncer initialized');
  }

  static getInstance(): ProximityEnabledDebouncer {
    if (!ProximityEnabledDebouncer.instance) {
      ProximityEnabledDebouncer.instance = new ProximityEnabledDebouncer();
    }
    return ProximityEnabledDebouncer.instance;
  }

  private getCallSource(): string {
    if (typeof window === 'undefined') return 'ServerSide';
    
    // Simple stack trace analysis to identify call source
    const stack = new Error().stack;
    if (stack?.includes('GeolocateControl')) return 'GeolocateControl';
    if (stack?.includes('handleEnabledChange') || stack?.includes('Switch')) return 'UserToggle';
    if (stack?.includes('handleProximityToggle')) return 'SystemEvent';
    if (stack?.includes('useEffect')) return 'EffectTrigger';
    return 'Unknown';
  }

  private detectRapidCalls(userId: string): boolean {
    const now = Date.now();
    const detection = this.rapidCallDetection.get(userId) || { count: 0, windowStart: now };
    
    // Reset window if it's been more than RAPID_CALL_WINDOW ms
    if (now - detection.windowStart > this.RAPID_CALL_WINDOW) {
      detection.count = 1;
      detection.windowStart = now;
    } else {
      detection.count++;
    }
    
    this.rapidCallDetection.set(userId, detection);
    this.metrics.callsPerSecond = detection.count;
    
    return detection.count > this.RAPID_CALL_THRESHOLD;
  }

  private detectPattern(userId: string, enabled: boolean): boolean {
    const history = this.callHistory.get(userId) || [];
    const now = Date.now();
    
    // Look for rapid enable/disable oscillations in the last 5 seconds
    const recentCalls = history.filter(entry => 
      now - entry.update.timestamp <= this.PATTERN_DETECTION_WINDOW
    );
    
    if (recentCalls.length < 4) return false;
    
    // Check for alternating pattern (enable, disable, enable, disable...)
    let alternations = 0;
    for (let i = 1; i < recentCalls.length; i++) {
      if (recentCalls[i].update.enabled !== recentCalls[i-1].update.enabled) {
        alternations++;
      }
    }
    
    // If more than 3 alternations in recent history, it's likely a pattern
    if (alternations >= 3) {
      console.warn('🔄 [EnabledDebouncer] Oscillation pattern detected:', {
        userId,
        alternations,
        recentCallCount: recentCalls.length,
        timeWindow: this.PATTERN_DETECTION_WINDOW / 1000
      });
      this.metrics.burstPatterns++;
      return true;
    }
    
    return false;
  }

  private addToHistory(userId: string, entry: EnabledCallHistoryEntry): void {
    const history = this.callHistory.get(userId) || [];
    history.push(entry);
    
    // Keep only the last HISTORY_BUFFER_SIZE entries
    if (history.length > this.HISTORY_BUFFER_SIZE) {
      history.shift();
    }
    
    this.callHistory.set(userId, history);
  }

  private logDebugInfo(userId: string, update: EnabledStateUpdate, action: string, reason?: string): void {
    const source = update.source || 'Unknown';
    const logData = {
      userId: userId.slice(-8), // Last 8 chars for privacy
      enabled: update.enabled,
      source,
      action,
      reason,
      timestamp: new Date(update.timestamp).toISOString().slice(11, 23), // HH:mm:ss.sss
      callsPerSecond: this.metrics.callsPerSecond
    };
    
    // Use console groups for better organization
    if (action === 'queued') {
      console.groupCollapsed(`⚡ [EnabledDebouncer] ${action.toUpperCase()}: ${source} → ${update.enabled}`);
    }
    
    console.log(`⚡ [EnabledDebouncer] ${action.toUpperCase()}:`, logData);
    
    if (reason) {
      console.log(`📋 Reason: ${reason}`);
    }
    
    if (action === 'queued') {
      console.groupEnd();
    }
  }

  debounceEnabledUpdate(
    userId: string,
    enabled: boolean,
    updateFunction: (enabled: boolean) => Promise<void>,
    source?: string
  ): boolean {
    const now = Date.now();
    const callSource = source || this.getCallSource();
    
    const update: EnabledStateUpdate = {
      enabled,
      timestamp: now,
      userId,
      source: callSource,
      stackTrace: process.env.NODE_ENV === 'development' ? new Error().stack : undefined
    };

    this.logDebugInfo(userId, update, 'received');

    // Detect rapid calls
    if (this.detectRapidCalls(userId)) {
      this.metrics.rapidCallWarnings++;
      console.warn('🚨 [EnabledDebouncer] Rapid calls detected! Calls per second:', this.metrics.callsPerSecond);
      
      // Add to history but don't process
      this.addToHistory(userId, {
        update,
        action: 'blocked',
        reason: `Rapid calls detected (${this.metrics.callsPerSecond}/sec)`
      });
      
      return false;
    }

    // Check if we're in cooldown period
    const lastCooldown = this.cooldownPeriods.get(userId);
    if (lastCooldown && now - lastCooldown < this.COOLDOWN_PERIOD) {
      this.metrics.cooldownBlocks++;
      const reason = `Cooldown active (${Math.round((this.COOLDOWN_PERIOD - (now - lastCooldown)) / 1000)}s remaining)`;
      
      this.logDebugInfo(userId, update, 'blocked', reason);
      this.addToHistory(userId, { update, action: 'blocked', reason });
      
      return false;
    }

    // Check for duplicate calls
    const lastUpdate = this.lastUpdates.get(userId);
    if (lastUpdate && 
        lastUpdate.enabled === enabled && 
        now - lastUpdate.timestamp < this.DUPLICATE_THRESHOLD) {
      
      this.metrics.duplicatesSkipped++;
      const reason = `Duplicate call (same value within ${this.DUPLICATE_THRESHOLD}ms)`;
      
      this.logDebugInfo(userId, update, 'skipped', reason);
      this.addToHistory(userId, { update, action: 'skipped', reason });
      
      return false;
    }

    // Check for oscillation patterns
    if (this.detectPattern(userId, enabled)) {
      this.metrics.patternDuplicatesSkipped++;
      const reason = 'Oscillation pattern detected - blocking to prevent cascade';
      
      this.logDebugInfo(userId, update, 'blocked', reason);
      this.addToHistory(userId, { update, action: 'blocked', reason });
      
      return false;
    }

    // Update metrics
    this.metrics.totalUpdates++;

    // Clear existing timeout
    const existingTimeout = this.updateTimeouts.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.metrics.debouncedUpdates++;
    }

    // Store pending update
    this.pendingUpdates.set(userId, update);
    
    this.logDebugInfo(userId, update, 'queued', `Will execute in ${this.DEBOUNCE_DELAY}ms`);
    this.addToHistory(userId, {
      update,
      action: 'queued',
      reason: `Debounced for ${this.DEBOUNCE_DELAY}ms`
    });

    // Set new timeout
    const timeout = setTimeout(async () => {
      const startTime = Date.now();
      await this.executeUpdate(userId, updateFunction);
      const processingTime = Date.now() - startTime;
      
      // Update the history entry with processing time
      const history = this.callHistory.get(userId);
      if (history && history.length > 0) {
        const lastEntry = history[history.length - 1];
        if (lastEntry.action === 'queued') {
          lastEntry.action = 'executed';
          lastEntry.processingTime = processingTime;
        }
      }
    }, this.DEBOUNCE_DELAY);

    this.updateTimeouts.set(userId, timeout);
    return true;
  }

  private async executeUpdate(
    userId: string,
    updateFunction: (enabled: boolean) => Promise<void>
  ): Promise<void> {
    const pendingUpdate = this.pendingUpdates.get(userId);
    if (!pendingUpdate) {
      console.warn('⚡ [EnabledDebouncer] No pending update found for user:', userId);
      return;
    }

    console.log('⚡ [EnabledDebouncer] Executing enabled update:', { userId, enabled: pendingUpdate.enabled });

    // Clear pending state
    this.pendingUpdates.delete(userId);
    this.updateTimeouts.delete(userId);

    try {
      // Execute the update
      await updateFunction(pendingUpdate.enabled);

      // Record successful update
      this.lastUpdates.set(userId, {
        enabled: pendingUpdate.enabled,
        timestamp: Date.now(),
      });

      // Set cooldown period
      this.cooldownPeriods.set(userId, Date.now());

      console.log('✅ [EnabledDebouncer] Successfully executed enabled update for user:', userId);
      
    } catch (error) {
      console.error('❌ [EnabledDebouncer] Enabled update failed for user:', userId, error);
      
      // Re-queue the update for retry with exponential backoff
      setTimeout(() => {
        this.debounceEnabledUpdate(userId, pendingUpdate.enabled, updateFunction);
      }, this.DEBOUNCE_DELAY * 2);
    }
  }

  async forceFlush(userId: string, updateFunction: (enabled: boolean) => Promise<void>): Promise<void> {
    const timeout = this.updateTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.updateTimeouts.delete(userId);
    }
    
    await this.executeUpdate(userId, updateFunction);
  }

  getMetrics(): EnabledDebounceMetrics {
    return { ...this.metrics };
  }

  getPendingUpdatesCount(): number {
    return this.pendingUpdates.size;
  }

  clearPendingUpdates(userId?: string): void {
    if (userId) {
      console.log('🧹 [EnabledDebouncer] Clearing pending updates for user:', userId);
      this.pendingUpdates.delete(userId);
      this.cooldownPeriods.delete(userId);
      
      const timeout = this.updateTimeouts.get(userId);
      if (timeout) {
        clearTimeout(timeout);
        this.updateTimeouts.delete(userId);
      }
    } else {
      console.log('🧹 [EnabledDebouncer] Clearing all pending updates');
      this.pendingUpdates.clear();
      this.cooldownPeriods.clear();
      
      for (const timeout of this.updateTimeouts.values()) {
        clearTimeout(timeout);
      }
      this.updateTimeouts.clear();
    }
  }

  // Check if a user has a pending update
  hasPendingUpdate(userId: string): boolean {
    return this.pendingUpdates.has(userId);
  }

  // Get the pending enabled state for a user
  getPendingEnabledState(userId: string): boolean | null {
    const pending = this.pendingUpdates.get(userId);
    return pending ? pending.enabled : null;
  }

  // Enhanced debugging methods
  getCallHistory(userId: string): EnabledCallHistoryEntry[] {
    return [...(this.callHistory.get(userId) || [])];
  }

  dumpDebugInfo(userId?: string): void {
    console.group('🔍 [EnabledDebouncer] Debug Information');
    
    if (userId) {
      console.log('📊 User-specific data for:', userId.slice(-8));
      console.log('Call History:', this.getCallHistory(userId));
      console.log('Pending Update:', this.pendingUpdates.get(userId));
      console.log('Last Update:', this.lastUpdates.get(userId));
      console.log('Cooldown Until:', this.cooldownPeriods.get(userId));
    } else {
      console.log('📊 Global Metrics:', this.getMetrics());
      console.log('📊 Active Users:', Array.from(this.pendingUpdates.keys()).map(id => id.slice(-8)));
      console.log('📊 Call History Summary:', Array.from(this.callHistory.entries()).map(([id, history]) => ({
        userId: id.slice(-8),
        callCount: history.length,
        lastCall: history[history.length - 1]?.update.timestamp
      })));
    }
    
    console.groupEnd();
  }

  // Emergency brake for extreme scenarios
  emergencyBrake(userId: string): void {
    console.error('🚨 [EnabledDebouncer] EMERGENCY BRAKE ACTIVATED for user:', userId.slice(-8));
    
    // Clear all pending operations for this user
    this.clearPendingUpdates(userId);
    
    // Set extended cooldown
    this.cooldownPeriods.set(userId, Date.now() + 10000); // 10 second cooldown
    
    // Log the incident
    this.addToHistory(userId, {
      update: {
        enabled: false,
        timestamp: Date.now(),
        userId,
        source: 'EmergencyBrake'
      },
      action: 'blocked',
      reason: 'Emergency brake activated due to extreme call frequency'
    });
  }
}

export const proximityEnabledDebouncer = ProximityEnabledDebouncer.getInstance();
