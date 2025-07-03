
import { ProximitySettings } from '@/types/proximityAlerts';
import { GRACE_PERIOD_PRESETS } from '@/utils/smartGracePeriod';
import { validateGracePeriodRanges, autoCorrectGracePeriodValues } from '@/utils/gracePeriodValidation';
import { trackGracePeriodActivation } from '@/utils/gracePeriodHistory';

export interface ErrorRecoveryResult {
  success: boolean;
  recoveredSettings: Partial<ProximitySettings>;
  recoveryMethod: string;
  errorDetails: string;
}

export class GracePeriodErrorRecovery {
  private static instance: GracePeriodErrorRecovery;
  private fallbackSettings: Partial<ProximitySettings>;
  private retryAttempts = new Map<string, number>();
  private maxRetries = 3;

  private constructor() {
    // Initialize with balanced preset as fallback
    this.fallbackSettings = {
      grace_period_initialization: GRACE_PERIOD_PRESETS.balanced.initialization,
      grace_period_movement: GRACE_PERIOD_PRESETS.balanced.movement,
      grace_period_app_resume: GRACE_PERIOD_PRESETS.balanced.appResume,
      significant_movement_threshold: GRACE_PERIOD_PRESETS.balanced.movementThreshold,
      grace_period_enabled: GRACE_PERIOD_PRESETS.balanced.enabled,
    };
    
    console.log('🛡️ [Error Recovery] Initialized with fallback settings:', this.fallbackSettings);
  }

  static getInstance(): GracePeriodErrorRecovery {
    if (!GracePeriodErrorRecovery.instance) {
      GracePeriodErrorRecovery.instance = new GracePeriodErrorRecovery();
    }
    return GracePeriodErrorRecovery.instance;
  }

  async recoverFromValidationError(
    invalidSettings: Partial<ProximitySettings>,
    errorContext: string
  ): Promise<ErrorRecoveryResult> {
    console.log('🔧 [Error Recovery] Attempting recovery from validation error:', { invalidSettings, errorContext });
    
    try {
      // Step 1: Try auto-correction
      const autoCorrected = autoCorrectGracePeriodValues(invalidSettings);
      const validation = validateGracePeriodRanges(autoCorrected);
      
      if (validation.isValid) {
        console.log('✅ [Error Recovery] Auto-correction successful');
        
        trackGracePeriodActivation('initialization', 'system', {
          preset: 'auto-corrected',
        });
        
        return {
          success: true,
          recoveredSettings: autoCorrected,
          recoveryMethod: 'auto-correction',
          errorDetails: '',
        };
      }
      
      // Step 2: Try fallback to known-good settings
      console.warn('⚠️ [Error Recovery] Auto-correction failed, using fallback settings');
      
      trackGracePeriodActivation('initialization', 'system', {
        preset: 'fallback-recovery',
      });
      
      return {
        success: true,
        recoveredSettings: { ...this.fallbackSettings },
        recoveryMethod: 'fallback',
        errorDetails: 'Auto-correction failed, used balanced preset',
      };
      
    } catch (error) {
      console.error('❌ [Error Recovery] All recovery methods failed:', error);
      
      return {
        success: false,
        recoveredSettings: { ...this.fallbackSettings },
        recoveryMethod: 'emergency-fallback',
        errorDetails: `Recovery failed: ${error}`,
      };
    }
  }

  async retryDatabaseOperation<T>(
    operation: () => Promise<T>,
    operationId: string,
    maxRetries: number = this.maxRetries
  ): Promise<T> {
    const currentAttempts = this.retryAttempts.get(operationId) || 0;
    
    try {
      console.log(`🔄 [Retry] Attempting database operation: ${operationId} (attempt ${currentAttempts + 1}/${maxRetries})`);
      
      const result = await operation();
      
      // Success - reset retry counter
      this.retryAttempts.delete(operationId);
      console.log(`✅ [Retry] Database operation successful: ${operationId}`);
      
      return result;
      
    } catch (error) {
      const nextAttempts = currentAttempts + 1;
      this.retryAttempts.set(operationId, nextAttempts);
      
      if (nextAttempts >= maxRetries) {
        console.error(`❌ [Retry] Database operation failed after ${maxRetries} attempts: ${operationId}`, error);
        this.retryAttempts.delete(operationId);
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.pow(2, nextAttempts) * 1000;
      console.warn(`⏳ [Retry] Database operation failed, retrying in ${delay}ms: ${operationId}`, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryDatabaseOperation(operation, operationId, maxRetries);
    }
  }

  getHealthStatus(): {
    isHealthy: boolean;
    activeRetries: number;
    fallbackSettings: Partial<ProximitySettings>;
  } {
    return {
      isHealthy: this.retryAttempts.size === 0,
      activeRetries: this.retryAttempts.size,
      fallbackSettings: { ...this.fallbackSettings },
    };
  }

  clearRetryHistory(): void {
    console.log('🧹 [Error Recovery] Clearing retry history');
    this.retryAttempts.clear();
  }
}

export const gracePeriodErrorRecovery = GracePeriodErrorRecovery.getInstance();
