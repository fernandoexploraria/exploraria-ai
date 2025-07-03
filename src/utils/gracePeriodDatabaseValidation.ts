
import { supabase } from '@/integrations/supabase/client';
import { ProximitySettings } from '@/types/proximityAlerts';
import { gracePeriodDebugMetrics } from '@/utils/gracePeriodDebugMetrics';

export class GracePeriodDatabaseValidation {
  static async validateBeforeSave(settings: Partial<ProximitySettings>): Promise<boolean> {
    console.log('🔍 [DB Validation] Pre-save validation check:', settings);
    
    const startTime = performance.now();
    
    try {
      // Check for basic constraints
      if (settings.grace_period_initialization !== undefined && 
          (settings.grace_period_initialization < 5000 || settings.grace_period_initialization > 60000)) {
        throw new Error('Grace period initialization must be between 5-60 seconds');
      }
      
      if (settings.grace_period_movement !== undefined && 
          (settings.grace_period_movement < 3000 || settings.grace_period_movement > 30000)) {
        throw new Error('Grace period movement must be between 3-30 seconds');
      }
      
      if (settings.grace_period_app_resume !== undefined && 
          (settings.grace_period_app_resume < 2000 || settings.grace_period_app_resume > 15000)) {
        throw new Error('Grace period app resume must be between 2-15 seconds');
      }
      
      if (settings.significant_movement_threshold !== undefined && 
          (settings.significant_movement_threshold < 50 || settings.significant_movement_threshold > 500)) {
        throw new Error('Movement threshold must be between 50-500 meters');
      }
      
      // Logical relationship checks
      if (settings.grace_period_movement !== undefined && 
          settings.grace_period_initialization !== undefined &&
          settings.grace_period_movement > settings.grace_period_initialization) {
        throw new Error('Movement grace period cannot exceed initialization grace period');
      }
      
      const endTime = performance.now();
      gracePeriodDebugMetrics.recordValidation(true, endTime - startTime);
      
      console.log('✅ [DB Validation] Pre-save validation passed');
      return true;
      
    } catch (error) {
      const endTime = performance.now();
      gracePeriodDebugMetrics.recordValidation(false, endTime - startTime);
      
      console.error('❌ [DB Validation] Pre-save validation failed:', error);
      throw error;
    }
  }

  static async handleConstraintViolation(error: any, settings: Partial<ProximitySettings>): Promise<Partial<ProximitySettings>> {
    console.warn('⚠️ [DB Validation] Handling constraint violation:', error.message);
    
    // Attempt to identify which constraint was violated and provide corrected values
    let correctedSettings = { ...settings };
    
    if (error.message.includes('grace_period_initialization')) {
      correctedSettings.grace_period_initialization = Math.max(5000, Math.min(60000, settings.grace_period_initialization || 15000));
    }
    
    if (error.message.includes('grace_period_movement')) {
      correctedSettings.grace_period_movement = Math.max(3000, Math.min(30000, settings.grace_period_movement || 8000));
    }
    
    if (error.message.includes('grace_period_app_resume')) {
      correctedSettings.grace_period_app_resume = Math.max(2000, Math.min(15000, settings.grace_period_app_resume || 5000));
    }
    
    if (error.message.includes('significant_movement_threshold')) {
      correctedSettings.significant_movement_threshold = Math.max(50, Math.min(500, settings.significant_movement_threshold || 150));
    }
    
    console.log('🔧 [DB Validation] Applied constraint-based corrections:', correctedSettings);
    return correctedSettings;
  }

  static async testDatabaseConstraints(): Promise<any> {
    console.log('🧪 [DB Validation] Testing database constraints');
    
    const testCases = [
      {
        name: 'invalid-initialization-too-low',
        settings: { grace_period_initialization: 1000 }, // Too low
      },
      {
        name: 'invalid-initialization-too-high',
        settings: { grace_period_initialization: 100000 }, // Too high
      },
      {
        name: 'invalid-movement-threshold',
        settings: { significant_movement_threshold: 10 }, // Too low
      },
      {
        name: 'invalid-logical-relationship',
        settings: { 
          grace_period_initialization: 10000,
          grace_period_movement: 15000, // Higher than initialization
        },
      },
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      try {
        await this.validateBeforeSave(testCase.settings);
        results.push({ ...testCase, result: 'PASSED', error: null });
      } catch (error) {
        results.push({ ...testCase, result: 'FAILED', error: error.message });
      }
    }
    
    return results;
  }
}
