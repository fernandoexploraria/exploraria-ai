
export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterRatio: number;
  retryableErrors: string[];
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
}

export class ExponentialBackoffCalculator {
  static calculateDelay(
    attempt: number, 
    baseDelayMs: number, 
    maxDelayMs: number, 
    backoffMultiplier: number, 
    jitterRatio: number
  ): number {
    const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
    
    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * jitterRatio * (Math.random() - 0.5);
    return Math.max(0, cappedDelay + jitter);
  }
}

export class RetryManager {
  private static readonly DEFAULT_POLICIES: Record<string, RetryPolicy> = {
    places: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 8000,
      backoffMultiplier: 2,
      jitterRatio: 0.1,
      retryableErrors: ['OVER_QUERY_LIMIT', 'UNKNOWN_ERROR', 'NETWORK_ERROR', 'TIMEOUT']
    },
    geocoding: {
      maxAttempts: 2,
      baseDelayMs: 500,
      maxDelayMs: 4000,
      backoffMultiplier: 2,
      jitterRatio: 0.1,
      retryableErrors: ['OVER_QUERY_LIMIT', 'UNKNOWN_ERROR', 'NETWORK_ERROR', 'TIMEOUT']
    },
    gemini: {
      maxAttempts: 2,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      jitterRatio: 0.15,
      retryableErrors: ['RATE_LIMIT_EXCEEDED', 'INTERNAL_ERROR', 'SERVICE_UNAVAILABLE', 'TIMEOUT']
    }
  };

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    serviceType: string,
    logger?: any,
    customPolicy?: Partial<RetryPolicy>
  ): Promise<RetryResult<T>> {
    const policy = { ...this.DEFAULT_POLICIES[serviceType], ...customPolicy };
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          const delay = ExponentialBackoffCalculator.calculateDelay(
            attempt,
            policy.baseDelayMs,
            policy.maxDelayMs,
            policy.backoffMultiplier,
            policy.jitterRatio
          );
          
          logger?.log(`🔄 Retry attempt ${attempt}/${policy.maxAttempts} for ${serviceType} after ${delay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const result = await operation();
        const totalTime = Date.now() - startTime;
        
        if (attempt > 1) {
          logger?.log(`✅ ${serviceType} operation succeeded on attempt ${attempt}/${policy.maxAttempts} (${totalTime}ms total)`);
        }

        return {
          success: true,
          data: result,
          attempts: attempt,
          totalTimeMs: totalTime
        };

      } catch (error) {
        lastError = error as Error;
        const isRetryable = this.isErrorRetryable(error as Error, policy.retryableErrors);
        
        logger?.log(`❌ ${serviceType} attempt ${attempt}/${policy.maxAttempts} failed: ${lastError.message} (retryable: ${isRetryable})`);
        
        if (!isRetryable || attempt === policy.maxAttempts) {
          break;
        }
      }
    }

    return {
      success: false,
      error: lastError || new Error('Unknown error'),
      attempts: policy.maxAttempts,
      totalTimeMs: Date.now() - startTime
    };
  }

  private static isErrorRetryable(error: Error, retryableErrors: string[]): boolean {
    const errorMessage = error.message.toUpperCase();
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toUpperCase())
    );
  }
}
