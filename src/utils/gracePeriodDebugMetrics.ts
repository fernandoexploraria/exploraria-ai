import { gracePeriodHistory } from '@/utils/gracePeriodHistory';
import { gracePeriodErrorRecovery } from '@/utils/gracePeriodErrorRecovery';
import { validateGracePeriodRanges, getGracePeriodValidationRules } from '@/utils/gracePeriodValidation';
import { ProximitySettings } from '@/types/proximityAlerts';
import { gracePeriodLazyLoader } from '@/utils/gracePeriodLazyLoader';
import { gracePeriodStorage } from '@/utils/gracePeriodStorage';
import { gracePeriodDebouncer } from '@/utils/gracePeriodDebouncer';
import { gracePeriodTimerManager } from '@/utils/gracePeriodTimerManager';

export interface ValidationMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  autoCorrections: number;
  averageValidationTime: number;
  lastValidationTime: number;
  validationSuccessRate: number;
}

export interface ErrorRecoveryMetrics {
  totalRecoveryAttempts: number;
  successfulRecoveries: number;
  fallbackUsages: number;
  activeRetries: number;
  recoverySuccessRate: number;
}

export interface PerformanceMetrics {
  lazyLoader: {
    isLoaded: boolean;
    loadTime: number | null;
    cacheHits: number;
    cacheMisses: number;
  };
  storage: {
    totalOperations: number;
    batchOperations: number;
    cacheHitRate: number;
    errorRate: number;
  };
  debouncer: {
    totalUpdates: number;
    batchedUpdates: number;
    databaseCallsSaved: number;
    pendingOperations: number;
  };
  timers: {
    activeTimers: number;
    totalTimersCreated: number;
    memoryLeakWarnings: number;
    averageTimerLifetime: number;
  };
}

export interface DebugTestScenarios {
  name: string;
  description: string;
  testFunction: () => Promise<any>;
}

class GracePeriodDebugMetrics {
  private static instance: GracePeriodDebugMetrics;
  
  private validationMetrics: ValidationMetrics = {
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    autoCorrections: 0,
    averageValidationTime: 0,
    lastValidationTime: 0,
    validationSuccessRate: 0,
  };
  
  private errorRecoveryMetrics: ErrorRecoveryMetrics = {
    totalRecoveryAttempts: 0,
    successfulRecoveries: 0,
    fallbackUsages: 0,
    activeRetries: 0,
    recoverySuccessRate: 0,
  };

  private constructor() {
    console.log('📊 [Debug Metrics] Initializing grace period debug metrics system');
  }

  static getInstance(): GracePeriodDebugMetrics {
    if (!GracePeriodDebugMetrics.instance) {
      GracePeriodDebugMetrics.instance = new GracePeriodDebugMetrics();
    }
    return GracePeriodDebugMetrics.instance;
  }

  recordValidation(isSuccessful: boolean, validationTime: number, autoCorrected: boolean = false): void {
    this.validationMetrics.totalValidations++;
    this.validationMetrics.lastValidationTime = validationTime;
    
    if (isSuccessful) {
      this.validationMetrics.successfulValidations++;
    } else {
      this.validationMetrics.failedValidations++;
    }
    
    if (autoCorrected) {
      this.validationMetrics.autoCorrections++;
    }
    
    // Update average validation time
    this.validationMetrics.averageValidationTime = 
      (this.validationMetrics.averageValidationTime * (this.validationMetrics.totalValidations - 1) + validationTime) / 
      this.validationMetrics.totalValidations;
    
    // Update success rate
    this.validationMetrics.validationSuccessRate = 
      (this.validationMetrics.successfulValidations / this.validationMetrics.totalValidations) * 100;
    
    console.log('📊 [Debug Metrics] Validation recorded:', {
      isSuccessful,
      validationTime,
      autoCorrected,
      totalValidations: this.validationMetrics.totalValidations,
      successRate: this.validationMetrics.validationSuccessRate.toFixed(1) + '%'
    });
  }

  recordErrorRecovery(wasSuccessful: boolean, usedFallback: boolean = false): void {
    this.errorRecoveryMetrics.totalRecoveryAttempts++;
    
    if (wasSuccessful) {
      this.errorRecoveryMetrics.successfulRecoveries++;
    }
    
    if (usedFallback) {
      this.errorRecoveryMetrics.fallbackUsages++;
    }
    
    this.errorRecoveryMetrics.recoverySuccessRate = 
      (this.errorRecoveryMetrics.successfulRecoveries / this.errorRecoveryMetrics.totalRecoveryAttempts) * 100;
    
    console.log('📊 [Debug Metrics] Error recovery recorded:', {
      wasSuccessful,
      usedFallback,
      totalAttempts: this.errorRecoveryMetrics.totalRecoveryAttempts,
      successRate: this.errorRecoveryMetrics.recoverySuccessRate.toFixed(1) + '%'
    });
  }

  getValidationMetrics(): ValidationMetrics {
    return { ...this.validationMetrics };
  }

  getErrorRecoveryMetrics(): ErrorRecoveryMetrics {
    const recoveryHealth = gracePeriodErrorRecovery.getHealthStatus();
    return {
      ...this.errorRecoveryMetrics,
      activeRetries: recoveryHealth.activeRetries,
    };
  }

  getPerformanceMetrics(): PerformanceMetrics {
    const lazyLoaderState = gracePeriodLazyLoader.getLoadState();
    const storageMetrics = gracePeriodStorage.getMetrics();
    const debouncerMetrics = gracePeriodDebouncer.getMetrics();
    const timerMetrics = gracePeriodTimerManager.getMetrics();

    return {
      lazyLoader: {
        isLoaded: lazyLoaderState.isLoaded,
        loadTime: lazyLoaderState.lastLoadTime,
        cacheHits: 0, // Will be implemented in lazy loader
        cacheMisses: 0, // Will be implemented in lazy loader
      },
      storage: {
        totalOperations: storageMetrics.totalOperations,
        batchOperations: storageMetrics.batchOperations,
        cacheHitRate: storageMetrics.cacheHitRate,
        errorRate: storageMetrics.errorRate,
      },
      debouncer: {
        totalUpdates: debouncerMetrics.totalUpdates,
        batchedUpdates: debouncerMetrics.batchedUpdates,
        databaseCallsSaved: debouncerMetrics.databaseCallsSaved,
        pendingOperations: gracePeriodDebouncer.getPendingOperationsCount(),
      },
      timers: {
        activeTimers: timerMetrics.activeTimers,
        totalTimersCreated: timerMetrics.totalTimersCreated,
        memoryLeakWarnings: timerMetrics.memoryLeakWarnings,
        averageTimerLifetime: timerMetrics.averageTimerLifetime,
      },
    };
  }

  getTestScenarios(): DebugTestScenarios[] {
    return [
      {
        name: 'Test Invalid Grace Periods',
        description: 'Test validation with invalid grace period values',
        testFunction: async () => {
          const invalidSettings: Partial<ProximitySettings> = {
            grace_period_initialization: 100000, // Too high
            grace_period_movement: 50000, // Too high
            grace_period_app_resume: 100, // Too low
            significant_movement_threshold: 10, // Too low
          };
          
          const startTime = performance.now();
          const validation = validateGracePeriodRanges(invalidSettings);
          const endTime = performance.now();
          
          this.recordValidation(validation.isValid, endTime - startTime);
          
          return {
            validation,
            testDuration: endTime - startTime,
            errors: validation.errors.length,
            warnings: validation.warnings.length,
          };
        },
      },
      {
        name: 'Test Error Recovery',
        description: 'Test error recovery mechanisms',
        testFunction: async () => {
          const invalidSettings: Partial<ProximitySettings> = {
            grace_period_initialization: -1000,
            grace_period_movement: -500,
          };
          
          const recoveryResult = await gracePeriodErrorRecovery.recoverFromValidationError(
            invalidSettings,
            'debug-test'
          );
          
          this.recordErrorRecovery(recoveryResult.success, recoveryResult.recoveryMethod === 'fallback');
          
          return recoveryResult;
        },
      },
      {
        name: 'Test Validation Performance',
        description: 'Measure validation performance with various settings',
        testFunction: async () => {
          const testCases = [
            { name: 'valid-balanced', settings: { grace_period_initialization: 15000, grace_period_movement: 8000 } },
            { name: 'valid-conservative', settings: { grace_period_initialization: 20000, grace_period_movement: 12000 } },
            { name: 'invalid-extreme', settings: { grace_period_initialization: 999999, grace_period_movement: -1000 } },
          ];
          
          const results = [];
          
          for (const testCase of testCases) {
            const startTime = performance.now();
            const validation = validateGracePeriodRanges(testCase.settings);
            const endTime = performance.now();
            
            const duration = endTime - startTime;
            this.recordValidation(validation.isValid, duration);
            
            results.push({
              ...testCase,
              duration,
              isValid: validation.isValid,
              errorCount: validation.errors.length,
            });
          }
          
          return results;
        },
      },
      {
        name: 'Test Performance Optimization',
        description: 'Test lazy loading, storage batching, and debouncing performance',
        testFunction: async () => {
          console.log('🧪 [Performance Test] Starting performance optimization test');
          
          const startTime = performance.now();
          
          // Test lazy loading
          const lazyLoadStart = performance.now();
          const settings = gracePeriodLazyLoader.getCachedSettings();
          const lazyLoadTime = performance.now() - lazyLoadStart;
          
          // Test storage batching
          const storageStart = performance.now();
          await gracePeriodStorage.setItem('test-key', { test: 'value' });
          const storageTime = performance.now() - storageStart;
          
          // Test debouncing (simulate multiple rapid updates)
          const debounceStart = performance.now();
          const mockUpdate = async (updates: any) => {
            console.log('Mock update:', updates);
          };
          
          gracePeriodDebouncer.debounceUpdate('test-user', 'grace_period_initialization', 15000, mockUpdate);
          gracePeriodDebouncer.debounceUpdate('test-user', 'grace_period_movement', 8000, mockUpdate);
          
          // Wait for debounce to complete
          await new Promise(resolve => setTimeout(resolve, 1200));
          const debounceTime = performance.now() - debounceStart;
          
          const totalTime = performance.now() - startTime;
          
          return {
            totalTime,
            lazyLoadTime,
            storageTime,
            debounceTime,
            performanceMetrics: this.getPerformanceMetrics(),
            settings: settings ? 'loaded' : 'not-loaded',
          };
        },
      },
      {
        name: 'Test Memory Management',
        description: 'Test timer cleanup and memory leak prevention',
        testFunction: async () => {
          console.log('🧪 [Memory Test] Starting memory management test');
          
          const initialTimerCount = gracePeriodTimerManager.getMetrics().activeTimers;
          
          // Create several test timers
          const timerIds: string[] = [];
          for (let i = 0; i < 5; i++) {
            const id = gracePeriodTimerManager.createTimer(
              'grace-period',
              1000,
              () => console.log('Test timer callback', i),
              `Test timer ${i}`
            );
            timerIds.push(id);
          }
          
          const afterCreateCount = gracePeriodTimerManager.getMetrics().activeTimers;
          
          // Clear all test timers
          let clearedCount = 0;
          for (const id of timerIds) {
            if (gracePeriodTimerManager.clearTimer(id)) {
              clearedCount++;
            }
          }
          
          const finalTimerCount = gracePeriodTimerManager.getMetrics().activeTimers;
          
          return {
            initialTimerCount,
            afterCreateCount,
            finalTimerCount,
            clearedCount,
            timerMetrics: gracePeriodTimerManager.getMetrics(),
            memoryCleanupSuccessful: finalTimerCount === initialTimerCount,
          };
        },
      },
      {
        name: 'System Health Check',
        description: 'Comprehensive system health and performance check',
        testFunction: async () => {
          const validationRules = getGracePeriodValidationRules();
          const gracePeriodMetrics = gracePeriodHistory.getMetrics();
          const recoveryHealth = gracePeriodErrorRecovery.getHealthStatus();
          
          return {
            validationRules,
            gracePeriodMetrics,
            recoveryHealth,
            debugMetrics: {
              validation: this.getValidationMetrics(),
              errorRecovery: this.getErrorRecoveryMetrics(),
            },
            timestamp: Date.now(),
          };
        },
      },
    ];
  }

  runAllTests(): Promise<Record<string, any>> {
    console.log('🧪 [Debug Metrics] Running all validation tests');
    
    const scenarios = this.getTestScenarios();
    const testPromises = scenarios.map(async scenario => {
      try {
        const result = await scenario.testFunction();
        return { [scenario.name]: { success: true, result } };
      } catch (error) {
        return { [scenario.name]: { success: false, error: error.message } };
      }
    });
    
    return Promise.all(testPromises).then(results => 
      results.reduce((acc, result) => ({ ...acc, ...result }), {})
    );
  }

  resetMetrics(): void {
    console.log('🔄 [Debug Metrics] Resetting all metrics');
    
    this.validationMetrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      autoCorrections: 0,
      averageValidationTime: 0,
      lastValidationTime: 0,
      validationSuccessRate: 0,
    };
    
    this.errorRecoveryMetrics = {
      totalRecoveryAttempts: 0,
      successfulRecoveries: 0,
      fallbackUsages: 0,
      activeRetries: 0,
      recoverySuccessRate: 0,
    };
    
    gracePeriodErrorRecovery.clearRetryHistory();
    
    // Reset performance-related components
    gracePeriodStorage.clearCache();
    gracePeriodDebouncer.clearPendingOperations();
    gracePeriodLazyLoader.clearCache();
    
    // Note: We don't reset timer manager as it may have active timers for the system
  }

  getComprehensiveHealthReport(): any {
    return {
      timestamp: Date.now(),
      validation: this.getValidationMetrics(),
      errorRecovery: this.getErrorRecoveryMetrics(),
      performance: this.getPerformanceMetrics(),
      gracePeriodHistory: gracePeriodHistory.getMetrics(),
      systemHealth: {
        isHealthy: this.isSystemHealthy(),
        issues: this.getHealthIssues(),
      },
    };
  }

  private isSystemHealthy(): boolean {
    const performance = this.getPerformanceMetrics();
    const validation = this.getValidationMetrics();
    
    // Check for concerning metrics
    const healthChecks = [
      performance.storage.errorRate < 0.1, // Less than 10% error rate
      performance.timers.memoryLeakWarnings < 5, // Less than 5 memory leak warnings
      validation.validationSuccessRate > 80, // At least 80% validation success rate
      performance.timers.activeTimers < 50, // Less than 50 active timers
    ];
    
    return healthChecks.every(check => check);
  }

  private getHealthIssues(): string[] {
    const issues: string[] = [];
    const performance = this.getPerformanceMetrics();
    const validation = this.getValidationMetrics();
    
    if (performance.storage.errorRate >= 0.1) {
      issues.push(`High storage error rate: ${(performance.storage.errorRate * 100).toFixed(1)}%`);
    }
    
    if (performance.timers.memoryLeakWarnings >= 5) {
      issues.push(`Memory leak warnings: ${performance.timers.memoryLeakWarnings}`);
    }
    
    if (validation.validationSuccessRate <= 80) {
      issues.push(`Low validation success rate: ${validation.validationSuccessRate.toFixed(1)}%`);
    }
    
    if (performance.timers.activeTimers >= 50) {
      issues.push(`High active timer count: ${performance.timers.activeTimers}`);
    }
    
    if (performance.debouncer.pendingOperations >= 20) {
      issues.push(`High pending operations: ${performance.debouncer.pendingOperations}`);
    }
    
    return issues;
  }
}

export const gracePeriodDebugMetrics = GracePeriodDebugMetrics.getInstance();
