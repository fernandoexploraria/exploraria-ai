
import { ProximitySettings } from '@/types/proximityAlerts';

export interface StorageOperation {
  key: string;
  value: any;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
}

export interface StorageMetrics {
  totalOperations: number;
  batchOperations: number;
  individualOperations: number;
  averageBatchSize: number;
  cacheHitRate: number;
  errorRate: number;
}

export class GracePeriodStorage {
  private static instance: GracePeriodStorage;
  private writeQueue: StorageOperation[] = [];
  private flushTimeout: NodeJS.Timeout | null = null;
  private cache = new Map<string, { value: any; timestamp: number }>();
  private metrics: StorageMetrics = {
    totalOperations: 0,
    batchOperations: 0,
    individualOperations: 0,
    averageBatchSize: 0,
    cacheHitRate: 0,
    errorRate: 0,
  };

  private readonly BATCH_DELAY = 500; // 500ms delay for batching
  private readonly CACHE_TTL = 30000; // 30 seconds cache TTL
  private readonly MAX_BATCH_SIZE = 10;

  private constructor() {
    console.log('💾 [Storage] Grace period storage manager initialized');
  }

  static getInstance(): GracePeriodStorage {
    if (!GracePeriodStorage.instance) {
      GracePeriodStorage.instance = new GracePeriodStorage();
    }
    return GracePeriodStorage.instance;
  }

  async setItem(key: string, value: any, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<void> {
    console.log('💾 [Storage] Queuing write operation:', { key, priority });
    
    const operation: StorageOperation = {
      key,
      value,
      timestamp: Date.now(),
      priority,
    };

    // Update cache immediately
    this.cache.set(key, { value, timestamp: Date.now() });

    // Add to write queue
    this.writeQueue.push(operation);

    // Handle high priority items immediately
    if (priority === 'high') {
      await this.flushQueue();
      return;
    }

    // Schedule batch flush
    this.scheduleBatchFlush();
  }

  async getItem<T>(key: string): Promise<T | null> {
    console.log('💾 [Storage] Reading item:', key);
    
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      console.log('💾 [Storage] Cache hit for:', key);
      this.metrics.totalOperations++;
      // Update cache hit rate
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * (this.metrics.totalOperations - 1) + 1) / this.metrics.totalOperations;
      return cached.value;
    }

    // Read from localStorage
    try {
      const item = localStorage.getItem(key);
      const value = item ? JSON.parse(item) : null;
      
      // Update cache
      this.cache.set(key, { value, timestamp: Date.now() });
      
      this.metrics.totalOperations++;
      console.log('💾 [Storage] Read from localStorage:', key);
      return value;
    } catch (error) {
      console.error('❌ [Storage] Error reading from localStorage:', error);
      this.metrics.errorRate = (this.metrics.errorRate * this.metrics.totalOperations + 1) / (this.metrics.totalOperations + 1);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    console.log('💾 [Storage] Removing item:', key);
    
    // Remove from cache
    this.cache.delete(key);
    
    // Remove from localStorage
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('❌ [Storage] Error removing from localStorage:', error);
    }
  }

  private scheduleBatchFlush(): void {
    if (this.flushTimeout) {
      return; // Already scheduled
    }

    this.flushTimeout = setTimeout(async () => {
      await this.flushQueue();
    }, this.BATCH_DELAY);
  }

  private async flushQueue(): Promise<void> {
    if (this.writeQueue.length === 0) {
      return;
    }

    console.log('💾 [Storage] Flushing write queue:', this.writeQueue.length, 'operations');
    
    const operations = this.writeQueue.splice(0, this.MAX_BATCH_SIZE);
    this.flushTimeout = null;

    try {
      // Group operations by key to avoid duplicate writes
      const uniqueOperations = new Map<string, StorageOperation>();
      
      operations.forEach(op => {
        const existing = uniqueOperations.get(op.key);
        if (!existing || op.timestamp > existing.timestamp) {
          uniqueOperations.set(op.key, op);
        }
      });

      // Perform batched writes
      for (const operation of uniqueOperations.values()) {
        try {
          localStorage.setItem(operation.key, JSON.stringify(operation.value));
        } catch (error) {
          console.error('❌ [Storage] Error writing to localStorage:', error);
          this.metrics.errorRate = (this.metrics.errorRate * this.metrics.totalOperations + 1) / (this.metrics.totalOperations + 1);
        }
      }

      // Update metrics
      this.metrics.batchOperations++;
      this.metrics.totalOperations += uniqueOperations.size;
      this.metrics.averageBatchSize = (this.metrics.averageBatchSize * (this.metrics.batchOperations - 1) + uniqueOperations.size) / this.metrics.batchOperations;

      console.log('✅ [Storage] Batch flush completed:', uniqueOperations.size, 'unique operations');
      
      // Schedule next flush if queue still has items
      if (this.writeQueue.length > 0) {
        this.scheduleBatchFlush();
      }
    } catch (error) {
      console.error('❌ [Storage] Batch flush failed:', error);
    }
  }

  async forceFlush(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    await this.flushQueue();
  }

  getMetrics(): StorageMetrics {
    return { ...this.metrics };
  }

  clearCache(): void {
    console.log('🧹 [Storage] Clearing cache');
    this.cache.clear();
  }

  // Grace period specific methods
  async setGracePeriodState(state: any): Promise<void> {
    await this.setItem('proximity_grace_period_state', state, 'high');
  }

  async getGracePeriodState(): Promise<any> {
    return await this.getItem('proximity_grace_period_state');
  }

  async removeGracePeriodState(): Promise<void> {
    await this.removeItem('proximity_grace_period_state');
  }
}

export const gracePeriodStorage = GracePeriodStorage.getInstance();
