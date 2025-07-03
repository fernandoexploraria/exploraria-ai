
import { gracePeriodHistory } from '@/utils/gracePeriodHistory';
import { gracePeriodErrorRecovery } from '@/utils/gracePeriodErrorRecovery';
import { validateGracePeriodRanges, getGracePeriodValidationRules } from '@/utils/gracePeriodValidation';
import { ProximitySettings } from '@/types/proximityAlerts';

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
  }
}

export const gracePeriodDebugMetrics = GracePeriodDebugMetrics.getInstance();
