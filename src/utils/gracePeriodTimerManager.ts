
export interface TimerInfo {
  id: string;
  type: 'grace-period' | 'background-validation' | 'debounce' | 'retry' | 'health-check';
  startTime: number;
  duration: number;
  description: string;
  cleanup?: () => void;
}

export interface TimerMetrics {
  activeTimers: number;
  totalTimersCreated: number;
  totalTimersCleared: number;
  timersByType: Record<string, number>;
  averageTimerLifetime: number;
  memoryLeakWarnings: number;
}

export class GracePeriodTimerManager {
  private static instance: GracePeriodTimerManager;
  private timers = new Map<string, { timer: NodeJS.Timeout; info: TimerInfo }>();
  private completedTimers: TimerInfo[] = [];
  private metrics: TimerMetrics = {
    activeTimers: 0,
    totalTimersCreated: 0,
    totalTimersCleared: 0,
    timersByType: {},
    averageTimerLifetime: 0,
    memoryLeakWarnings: 0,
  };

  private readonly MAX_COMPLETED_HISTORY = 100;
  private readonly MEMORY_LEAK_THRESHOLD = 50; // Alert if more than 50 active timers
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    console.log('⏰ [Timer Manager] Grace period timer manager initialized');
    this.startHealthCheck();
  }

  static getInstance(): GracePeriodTimerManager {
    if (!GracePeriodTimerManager.instance) {
      GracePeriodTimerManager.instance = new GracePeriodTimerManager();
    }
    return GracePeriodTimerManager.instance;
  }

  createTimer(
    type: TimerInfo['type'],
    duration: number,
    callback: () => void,
    description: string,
    cleanup?: () => void
  ): string {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('⏰ [Timer Manager] Creating timer:', { id, type, duration, description });

    const timer = setTimeout(() => {
      try {
        callback();
      } catch (error) {
        console.error('❌ [Timer Manager] Timer callback error:', error);
      } finally {
        this.clearTimer(id);
      }
    }, duration);

    const timerInfo: TimerInfo = {
      id,
      type,
      startTime: Date.now(),
      duration,
      description,
      cleanup,
    };

    this.timers.set(id, { timer, info: timerInfo });

    // Update metrics
    this.metrics.activeTimers++;
    this.metrics.totalTimersCreated++;
    this.metrics.timersByType[type] = (this.metrics.timersByType[type] || 0) + 1;

    // Check for potential memory leaks
    if (this.metrics.activeTimers > this.MEMORY_LEAK_THRESHOLD) {
      this.metrics.memoryLeakWarnings++;
      console.warn('⚠️ [Timer Manager] High timer count detected:', this.metrics.activeTimers, 'active timers');
    }

    return id;
  }

  clearTimer(id: string): boolean {
    const timerData = this.timers.get(id);
    if (!timerData) {
      return false;
    }

    console.log('⏰ [Timer Manager] Clearing timer:', id);

    const { timer, info } = timerData;
    
    // Clear the actual timer
    clearTimeout(timer);
    
    // Run cleanup if provided
    if (info.cleanup) {
      try {
        info.cleanup();
      } catch (error) {
        console.error('❌ [Timer Manager] Timer cleanup error:', error);
      }
    }

    // Remove from active timers
    this.timers.delete(id);

    // Add to completed history
    const completedInfo = {
      ...info,
      duration: Date.now() - info.startTime, // Actual duration
    };
    
    this.completedTimers.push(completedInfo);
    
    // Maintain history size
    if (this.completedTimers.length > this.MAX_COMPLETED_HISTORY) {
      this.completedTimers.shift();
    }

    // Update metrics
    this.metrics.activeTimers--;
    this.metrics.totalTimersCleared++;
    
    // Update average lifetime
    if (this.completedTimers.length > 0) {
      const totalLifetime = this.completedTimers.reduce((sum, timer) => sum + timer.duration, 0);
      this.metrics.averageTimerLifetime = totalLifetime / this.completedTimers.length;
    }

    return true;
  }

  clearTimersByType(type: TimerInfo['type']): number {
    console.log('⏰ [Timer Manager] Clearing all timers of type:', type);
    
    const timersToCleared = Array.from(this.timers.entries())
      .filter(([_, { info }]) => info.type === type)
      .map(([id]) => id);

    let clearedCount = 0;
    for (const id of timersToCleared) {
      if (this.clearTimer(id)) {
        clearedCount++;
      }
    }

    console.log('⏰ [Timer Manager] Cleared', clearedCount, 'timers of type:', type);
    return clearedCount;
  }

  clearAllTimers(): number {
    console.log('⏰ [Timer Manager] Clearing all active timers');
    
    const timerIds = Array.from(this.timers.keys());
    let clearedCount = 0;
    
    for (const id of timerIds) {
      if (this.clearTimer(id)) {
        clearedCount++;
      }
    }

    console.log('⏰ [Timer Manager] Cleared', clearedCount, 'timers');
    return clearedCount;
  }

  getActiveTimers(): TimerInfo[] {
    return Array.from(this.timers.values()).map(({ info }) => ({ ...info }));
  }

  getTimersByType(type: TimerInfo['type']): TimerInfo[] {
    return this.getActiveTimers().filter(timer => timer.type === type);
  }

  getMetrics(): TimerMetrics {
    return { ...this.metrics };
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Every minute
  }

  private performHealthCheck(): void {
    const now = Date.now();
    const staleTimers: string[] = [];
    
    // Check for stale timers (running longer than expected)
    for (const [id, { info }] of this.timers) {
      const runtime = now - info.startTime;
      const expectedEnd = info.startTime + info.duration;
      
      // Timer is stale if it's been running 50% longer than expected
      if (now > expectedEnd * 1.5) {
        staleTimers.push(id);
        console.warn('⚠️ [Timer Manager] Stale timer detected:', {
          id,
          type: info.type,
          expectedDuration: info.duration,
          actualRuntime: runtime,
          description: info.description,
        });
      }
    }

    // Clear stale timers
    for (const id of staleTimers) {
      this.clearTimer(id);
    }

    // Log health status
    if (this.metrics.activeTimers > 0) {
      console.log('⏰ [Timer Manager] Health check:', {
        activeTimers: this.metrics.activeTimers,
        staleTimersCleared: staleTimers.length,
        timersByType: this.metrics.timersByType,
      });
    }
  }

  destroy(): void {
    console.log('🧹 [Timer Manager] Destroying timer manager');
    
    // Clear health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Clear all active timers
    this.clearAllTimers();
    
    // Clear history
    this.completedTimers.length = 0;
  }
}

export const gracePeriodTimerManager = GracePeriodTimerManager.getInstance();
