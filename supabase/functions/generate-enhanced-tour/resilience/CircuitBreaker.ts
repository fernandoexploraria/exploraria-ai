
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitoringPeriodMs: number;
  halfOpenMaxCalls: number;
}

export interface CircuitBreakerMetrics {
  totalCalls: number;
  failedCalls: number;
  successCalls: number;
  failureRate: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  state: CircuitBreakerState;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private halfOpenCalls: number = 0;

  constructor(
    private serviceName: string,
    private config: CircuitBreakerConfig,
    private logger?: any
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.halfOpenCalls = 0;
        this.logger?.log(`🔄 Circuit breaker for ${this.serviceName} transitioning to HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker for ${this.serviceName} is OPEN - fast failing`);
      }
    }

    if (this.state === CircuitBreakerState.HALF_OPEN && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new Error(`Circuit breaker for ${this.serviceName} is HALF_OPEN but max calls exceeded`);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.successCount++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenCalls++;
      
      // If we've had enough successful calls in half-open, close the circuit
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.state = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.logger?.log(`✅ Circuit breaker for ${this.serviceName} transitioning to CLOSED - service recovered`);
      }
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Any failure in half-open state should open the circuit
      this.state = CircuitBreakerState.OPEN;
      this.logger?.log(`🚨 Circuit breaker for ${this.serviceName} transitioning to OPEN - failure in half-open state`);
    } else if (this.state === CircuitBreakerState.CLOSED && this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      this.logger?.log(`🚨 Circuit breaker for ${this.serviceName} transitioning to OPEN - failure threshold reached (${this.failureCount}/${this.config.failureThreshold})`);
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs;
  }

  getMetrics(): CircuitBreakerMetrics {
    const totalCalls = this.successCount + this.failureCount;
    return {
      totalCalls,
      failedCalls: this.failureCount,
      successCalls: this.successCount,
      failureRate: totalCalls > 0 ? this.failureCount / totalCalls : 0,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      state: this.state
    };
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCalls = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.logger?.log(`🔄 Circuit breaker for ${this.serviceName} manually reset`);
  }
}

export class CircuitBreakerRegistry {
  private static breakers: Map<string, CircuitBreaker> = new Map();
  
  private static readonly DEFAULT_CONFIGS: Record<string, CircuitBreakerConfig> = {
    places: {
      failureThreshold: 5,
      resetTimeoutMs: 60000, // 1 minute
      monitoringPeriodMs: 30000, // 30 seconds
      halfOpenMaxCalls: 3
    },
    geocoding: {
      failureThreshold: 3,
      resetTimeoutMs: 30000, // 30 seconds
      monitoringPeriodMs: 20000, // 20 seconds
      halfOpenMaxCalls: 2
    },
    gemini: {
      failureThreshold: 3,
      resetTimeoutMs: 120000, // 2 minutes
      monitoringPeriodMs: 60000, // 1 minute
      halfOpenMaxCalls: 2
    }
  };

  static getBreaker(serviceName: string, logger?: any): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      const config = this.DEFAULT_CONFIGS[serviceName] || this.DEFAULT_CONFIGS.places;
      this.breakers.set(serviceName, new CircuitBreaker(serviceName, config, logger));
    }
    return this.breakers.get(serviceName)!;
  }

  static getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    for (const [serviceName, breaker] of this.breakers.entries()) {
      metrics[serviceName] = breaker.getMetrics();
    }
    return metrics;
  }

  static resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}
