
import { ProximitySettings } from '@/types/proximityAlerts';

export interface EnabledStateUpdate {
  enabled: boolean;
  timestamp: number;
  userId: string;
}

export interface EnabledDebounceMetrics {
  totalUpdates: number;
  debouncedUpdates: number;
  duplicatesSkipped: number;
  averageDebounceDelay: number;
  cooldownBlocks: number;
}

export class ProximityEnabledDebouncer {
  private static instance: ProximityEnabledDebouncer;
  private pendingUpdates = new Map<string, EnabledStateUpdate>();
  private updateTimeouts = new Map<string, NodeJS.Timeout>();
  private lastUpdates = new Map<string, { enabled: boolean; timestamp: number }>();
  private cooldownPeriods = new Map<string, number>();
  private metrics: EnabledDebounceMetrics = {
    totalUpdates: 0,
    debouncedUpdates: 0,
    duplicatesSkipped: 0,
    averageDebounceDelay: 0,
    cooldownBlocks: 0,
  };

  private readonly DEBOUNCE_DELAY = 500; // 500ms for responsiveness
  private readonly COOLDOWN_PERIOD = 2000; // 2 seconds between toggles
  private readonly DUPLICATE_THRESHOLD = 1000; // 1 second for duplicate detection

  private constructor() {
    console.log('⚡ [EnabledDebouncer] Proximity enabled debouncer initialized');
  }

  static getInstance(): ProximityEnabledDebouncer {
    if (!ProximityEnabledDebouncer.instance) {
      ProximityEnabledDebouncer.instance = new ProximityEnabledDebouncer();
    }
    return ProximityEnabledDebouncer.instance;
  }

  debounceEnabledUpdate(
    userId: string,
    enabled: boolean,
    updateFunction: (enabled: boolean) => Promise<void>
  ): boolean {
    const now = Date.now();
    
    console.log('⚡ [EnabledDebouncer] Debouncing enabled update:', { userId, enabled });

    // Check if we're in cooldown period
    const lastCooldown = this.cooldownPeriods.get(userId);
    if (lastCooldown && now - lastCooldown < this.COOLDOWN_PERIOD) {
      console.log('⚡ [EnabledDebouncer] Update blocked by cooldown period');
      this.metrics.cooldownBlocks++;
      return false;
    }

    // Check for duplicate calls
    const lastUpdate = this.lastUpdates.get(userId);
    if (lastUpdate && 
        lastUpdate.enabled === enabled && 
        now - lastUpdate.timestamp < this.DUPLICATE_THRESHOLD) {
      console.log('⚡ [EnabledDebouncer] Duplicate update skipped:', { enabled, timeSinceLastUpdate: now - lastUpdate.timestamp });
      this.metrics.duplicatesSkipped++;
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
    this.pendingUpdates.set(userId, {
      enabled,
      timestamp: now,
      userId,
    });

    // Set new timeout
    const timeout = setTimeout(async () => {
      await this.executeUpdate(userId, updateFunction);
    }, this.DEBOUNCE_DELAY);

    this.updateTimeouts.set(userId, timeout);
    
    console.log('⚡ [EnabledDebouncer] Scheduled enabled update in', this.DEBOUNCE_DELAY, 'ms for user:', userId);
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
}

export const proximityEnabledDebouncer = ProximityEnabledDebouncer.getInstance();
