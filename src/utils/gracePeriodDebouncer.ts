import { ProximitySettings } from '@/types/proximityAlerts';

export interface DebounceOperation {
  settingType: keyof ProximitySettings;
  value: any;
  timestamp: number;
  userId: string;
}

export interface DebounceMetrics {
  totalUpdates: number;
  batchedUpdates: number;
  individualUpdates: number;
  averageBatchSize: number;
  averageDebounceDelay: number;
  databaseCallsSaved: number;
}

export class GracePeriodDebouncer {
  private static instance: GracePeriodDebouncer;
  private pendingOperations = new Map<string, DebounceOperation[]>();
  private debounceTimeouts = new Map<string, NodeJS.Timeout>();
  private metrics: DebounceMetrics = {
    totalUpdates: 0,
    batchedUpdates: 0,
    individualUpdates: 0,
    averageBatchSize: 0,
    averageDebounceDelay: 0,
    databaseCallsSaved: 0,
  };

  private readonly BASE_DEBOUNCE_DELAY = 1000; // 1 second base delay
  private readonly MAX_DEBOUNCE_DELAY = 5000; // 5 seconds max delay
  private readonly BATCH_SIZE_THRESHOLD = 3; // Minimum batch size for optimization

  private constructor() {
    console.log('⏱️ [Debouncer] Grace period debouncer initialized');
  }

  static getInstance(): GracePeriodDebouncer {
    if (!GracePeriodDebouncer.instance) {
      GracePeriodDebouncer.instance = new GracePeriodDebouncer();
    }
    return GracePeriodDebouncer.instance;
  }

  debounceUpdate(
    userId: string,
    settingType: keyof ProximitySettings,
    value: any,
    updateFunction: (updates: Partial<ProximitySettings>) => Promise<void>
  ): void {
    console.log('⏱️ [Debouncer] Debouncing update:', { userId, settingType, value });

    const operation: DebounceOperation = {
      settingType,
      value,
      timestamp: Date.now(),
      userId,
    };

    // Add to pending operations
    if (!this.pendingOperations.has(userId)) {
      this.pendingOperations.set(userId, []);
    }
    
    const userOperations = this.pendingOperations.get(userId)!;
    
    // Remove any existing operation for the same setting type
    const existingIndex = userOperations.findIndex(op => op.settingType === settingType);
    if (existingIndex !== -1) {
      userOperations.splice(existingIndex, 1);
    }
    
    userOperations.push(operation);

    // Clear existing timeout
    const existingTimeout = this.debounceTimeouts.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Calculate smart debounce delay based on operation frequency
    const debounceDelay = this.calculateDebounceDelay(userId);
    
    // Set new timeout
    const timeout = setTimeout(async () => {
      await this.flushOperations(userId, updateFunction);
    }, debounceDelay);

    this.debounceTimeouts.set(userId, timeout);
    
    console.log('⏱️ [Debouncer] Scheduled flush in', debounceDelay, 'ms for user:', userId);
  }

  private calculateDebounceDelay(userId: string): number {
    const operations = this.pendingOperations.get(userId) || [];
    const operationCount = operations.length;
    
    // Smart delay: more operations = longer delay (up to max)
    const dynamicDelay = Math.min(
      this.BASE_DEBOUNCE_DELAY + (operationCount * 200),
      this.MAX_DEBOUNCE_DELAY
    );
    
    return dynamicDelay;
  }

  private async flushOperations(
    userId: string,
    updateFunction: (updates: Partial<ProximitySettings>) => Promise<void>
  ): Promise<void> {
    const operations = this.pendingOperations.get(userId);
    if (!operations || operations.length === 0) {
      return;
    }

    console.log('⏱️ [Debouncer] Flushing', operations.length, 'operations for user:', userId);

    // Clear pending operations and timeout
    this.pendingOperations.delete(userId);
    this.debounceTimeouts.delete(userId);

    try {
      // Build combined update object with proper typing
      const updates: Partial<ProximitySettings> = {};
      
      operations.forEach(operation => {
        // Use type assertion to handle the dynamic property assignment
        (updates as any)[operation.settingType] = operation.value;
      });

      // Perform single database update
      await updateFunction(updates);

      // Update metrics
      this.metrics.totalUpdates += operations.length;
      if (operations.length > 1) {
        this.metrics.batchedUpdates += operations.length;
        this.metrics.databaseCallsSaved += operations.length - 1; // Saved calls
        this.metrics.averageBatchSize = (this.metrics.averageBatchSize * (this.metrics.batchedUpdates - operations.length) + operations.length) / this.metrics.batchedUpdates;
      } else {
        this.metrics.individualUpdates++;
      }

      console.log('✅ [Debouncer] Successfully flushed batch update for user:', userId);
      
    } catch (error) {
      console.error('❌ [Debouncer] Batch update failed for user:', userId, error);
      
      // Re-queue operations for retry (optional)
      this.pendingOperations.set(userId, operations);
      
      // Schedule retry with exponential backoff
      setTimeout(() => {
        this.flushOperations(userId, updateFunction);
      }, this.BASE_DEBOUNCE_DELAY * 2);
    }
  }

  async forceFlush(userId: string, updateFunction: (updates: Partial<ProximitySettings>) => Promise<void>): Promise<void> {
    const timeout = this.debounceTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.debounceTimeouts.delete(userId);
    }
    
    await this.flushOperations(userId, updateFunction);
  }

  async forceFlushAll(updateFunction: (updates: Partial<ProximitySettings>) => Promise<void>): Promise<void> {
    const userIds = Array.from(this.pendingOperations.keys());
    
    for (const userId of userIds) {
      await this.forceFlush(userId, updateFunction);
    }
  }

  getMetrics(): DebounceMetrics {
    return { ...this.metrics };
  }

  getPendingOperationsCount(): number {
    let total = 0;
    for (const operations of this.pendingOperations.values()) {
      total += operations.length;
    }
    return total;
  }

  clearPendingOperations(userId?: string): void {
    if (userId) {
      console.log('🧹 [Debouncer] Clearing pending operations for user:', userId);
      this.pendingOperations.delete(userId);
      
      const timeout = this.debounceTimeouts.get(userId);
      if (timeout) {
        clearTimeout(timeout);
        this.debounceTimeouts.delete(userId);
      }
    } else {
      console.log('🧹 [Debouncer] Clearing all pending operations');
      this.pendingOperations.clear();
      
      for (const timeout of this.debounceTimeouts.values()) {
        clearTimeout(timeout);
      }
      this.debounceTimeouts.clear();
    }
  }
}

export const gracePeriodDebouncer = GracePeriodDebouncer.getInstance();
