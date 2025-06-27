
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  RATE_LIMIT = 'RATE_LIMIT',
  AUTHENTICATION = 'AUTHENTICATION',
  DATA_QUALITY = 'DATA_QUALITY',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  UNKNOWN = 'UNKNOWN'
}

export interface CategorizedError {
  category: ErrorCategory;
  originalError: Error;
  isRetryable: boolean;
  suggestedAction: string;
  correlationId: string;
}

export interface ErrorHandlingStrategy {
  shouldRetry: boolean;
  maxRetries: number;
  fallbackAction?: string;
  userMessage: string;
}

export class ErrorClassifier {
  private static readonly ERROR_PATTERNS: Record<ErrorCategory, string[]> = {
    [ErrorCategory.NETWORK]: ['NETWORK_ERROR', 'CONNECTION_FAILED', 'TIMEOUT', 'ECONNRESET', 'ECONNREFUSED'],
    [ErrorCategory.RATE_LIMIT]: ['OVER_QUERY_LIMIT', 'RATE_LIMIT_EXCEEDED', 'TOO_MANY_REQUESTS', 'QUOTA_EXCEEDED'],
    [ErrorCategory.AUTHENTICATION]: ['INVALID_REQUEST', 'REQUEST_DENIED', 'UNAUTHORIZED', 'FORBIDDEN'],
    [ErrorCategory.DATA_QUALITY]: ['ZERO_RESULTS', 'INVALID_REQUEST', 'NOT_FOUND', 'INVALID_COORDINATES'],
    [ErrorCategory.SERVICE_UNAVAILABLE]: ['SERVICE_UNAVAILABLE', 'INTERNAL_ERROR', 'BACKEND_ERROR'],
    [ErrorCategory.TIMEOUT]: ['TIMEOUT', 'DEADLINE_EXCEEDED', 'REQUEST_TIMEOUT'],
    [ErrorCategory.QUOTA_EXCEEDED]: ['QUOTA_EXCEEDED', 'BILLING_NOT_ENABLED', 'DAILY_LIMIT_EXCEEDED'],
    [ErrorCategory.UNKNOWN]: []
  };

  static categorize(error: Error): CategorizedError {
    const errorMessage = error.message.toUpperCase();
    const correlationId = this.generateCorrelationId();

    for (const [category, patterns] of Object.entries(this.ERROR_PATTERNS)) {
      if (patterns.some(pattern => errorMessage.includes(pattern))) {
        return {
          category: category as ErrorCategory,
          originalError: error,
          isRetryable: this.isRetryable(category as ErrorCategory),
          suggestedAction: this.getSuggestedAction(category as ErrorCategory),
          correlationId
        };
      }
    }

    return {
      category: ErrorCategory.UNKNOWN,
      originalError: error,
      isRetryable: true,
      suggestedAction: 'Log error and retry with exponential backoff',
      correlationId
    };
  }

  private static isRetryable(category: ErrorCategory): boolean {
    const nonRetryableCategories = [
      ErrorCategory.AUTHENTICATION,
      ErrorCategory.QUOTA_EXCEEDED
    ];
    return !nonRetryableCategories.includes(category);
  }

  private static getSuggestedAction(category: ErrorCategory): string {
    const actions: Record<ErrorCategory, string> = {
      [ErrorCategory.NETWORK]: 'Retry with exponential backoff',
      [ErrorCategory.RATE_LIMIT]: 'Implement rate limiting and retry after delay',
      [ErrorCategory.AUTHENTICATION]: 'Check API keys and permissions',
      [ErrorCategory.DATA_QUALITY]: 'Use fallback coordinates or skip landmark',
      [ErrorCategory.SERVICE_UNAVAILABLE]: 'Switch to backup service or degrade gracefully',
      [ErrorCategory.TIMEOUT]: 'Increase timeout or retry with shorter timeout',
      [ErrorCategory.QUOTA_EXCEEDED]: 'Switch to backup API or notify administrators',
      [ErrorCategory.UNKNOWN]: 'Log for investigation and retry'
    };
    return actions[category];
  }

  private static generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class ErrorHandler {
  private static readonly STRATEGIES: Record<ErrorCategory, ErrorHandlingStrategy> = {
    [ErrorCategory.NETWORK]: {
      shouldRetry: true,
      maxRetries: 3,
      fallbackAction: 'use_cached_coordinates',
      userMessage: 'Network connectivity issues detected, using cached data where available'
    },
    [ErrorCategory.RATE_LIMIT]: {
      shouldRetry: true,
      maxRetries: 2,
      fallbackAction: 'slow_down_requests',
      userMessage: 'API rate limits reached, processing at reduced speed'
    },
    [ErrorCategory.AUTHENTICATION]: {
      shouldRetry: false,
      maxRetries: 0,
      fallbackAction: 'use_fallback_service',
      userMessage: 'API authentication issue, switching to backup services'
    },
    [ErrorCategory.DATA_QUALITY]: {
      shouldRetry: false,
      maxRetries: 0,
      fallbackAction: 'skip_landmark',
      userMessage: 'Some landmarks could not be located precisely'
    },
    [ErrorCategory.SERVICE_UNAVAILABLE]: {
      shouldRetry: true,
      maxRetries: 2,
      fallbackAction: 'use_backup_service',
      userMessage: 'Primary service unavailable, using backup systems'
    },
    [ErrorCategory.TIMEOUT]: {
      shouldRetry: true,
      maxRetries: 2,
      fallbackAction: 'reduce_timeout',
      userMessage: 'Request timeouts detected, optimizing performance'
    },
    [ErrorCategory.QUOTA_EXCEEDED]: {
      shouldRetry: false,
      maxRetries: 0,
      fallbackAction: 'use_free_service',
      userMessage: 'API quota exceeded, switching to alternative services'
    },
    [ErrorCategory.UNKNOWN]: {
      shouldRetry: true,
      maxRetries: 1,
      fallbackAction: 'log_and_continue',
      userMessage: 'Unexpected error encountered, continuing with available data'
    }
  };

  static getStrategy(categorizedError: CategorizedError): ErrorHandlingStrategy {
    return this.STRATEGIES[categorizedError.category];
  }

  static shouldRetry(categorizedError: CategorizedError): boolean {
    return this.STRATEGIES[categorizedError.category].shouldRetry && categorizedError.isRetryable;
  }
}
