
import { useState, useCallback } from 'react';
import { validateGracePeriodRanges, autoCorrectGracePeriodValues, isGracePeriodConfigurationValid } from '@/utils/gracePeriodValidation';
import { ProximitySettings, GracePeriodValidationResult } from '@/types/proximityAlerts';
import { trackGracePeriodActivation } from '@/utils/gracePeriodHistory';
import { useToast } from '@/hooks/use-toast';

export interface ValidationState {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  autoCorrections: Record<string, number>;
  lastValidation: number;
}

export const useProximityAlertsValidation = () => {
  const [validationState, setValidationState] = useState<ValidationState>({
    isValid: true,
    errors: [],
    warnings: [],
    autoCorrections: {},
    lastValidation: Date.now(),
  });
  
  const { toast } = useToast();

  const validateAndCorrectSettings = useCallback(async (
    settings: Partial<ProximitySettings>
  ): Promise<{ correctedSettings: ProximitySettings; validationResult: GracePeriodValidationResult }> => {
    console.log('🔍 [Validation] Starting grace period validation:', settings);
    
    const validationResult = validateGracePeriodRanges(settings);
    const autoCorrections: Record<string, number> = {};
    
    let correctedSettings: ProximitySettings;
    
    // Auto-correct invalid values if validation fails
    if (!validationResult.isValid) {
      console.warn('⚠️ [Validation] Grace period validation failed, applying auto-corrections:', validationResult.errors);
      
      const originalSettings = { ...settings };
      correctedSettings = autoCorrectGracePeriodValues(settings);
      
      // Track what was auto-corrected
      Object.keys(correctedSettings).forEach(key => {
        const originalValue = originalSettings[key as keyof typeof originalSettings];
        const correctedValue = correctedSettings[key as keyof typeof correctedSettings];
        if (originalValue !== correctedValue && typeof originalValue === 'number' && typeof correctedValue === 'number') {
          autoCorrections[key] = correctedValue;
        }
      });
      
      console.log('🔧 [Validation] Auto-corrections applied:', autoCorrections);
      
      // Track auto-correction event
      trackGracePeriodActivation('initialization', 'system', {
        preset: 'auto-corrected',
        userLocation: undefined
      });
    } else {
      correctedSettings = autoCorrectGracePeriodValues(settings);
    }
    
    // Update validation state
    setValidationState({
      isValid: validationResult.isValid,
      errors: validationResult.errors.map(e => e.message),
      warnings: validationResult.warnings.map(w => w.message),
      autoCorrections,
      lastValidation: Date.now(),
    });
    
    // Show validation errors as toasts (infrastructure notification)
    if (validationResult.errors.length > 0) {
      toast({
        title: "Grace Period Configuration Issues",
        description: `${validationResult.errors.length} validation errors auto-corrected`,
        variant: "default",
      });
    }
    
    console.log('✅ [Validation] Grace period validation complete:', {
      isValid: validationResult.isValid,
      errorCount: validationResult.errors.length,
      warningCount: validationResult.warnings.length,
      autoCorrectionCount: Object.keys(autoCorrections).length
    });
    
    return { correctedSettings, validationResult };
  }, [toast]);

  const performBackgroundValidation = useCallback(async (settings: ProximitySettings | null) => {
    if (!settings) return;
    
    console.log('🔄 [Background Validation] Performing health check on grace period settings');
    
    try {
      const isConfigValid = isGracePeriodConfigurationValid(settings);
      
      if (!isConfigValid) {
        console.warn('⚠️ [Background Validation] Configuration health check failed, attempting auto-correction');
        
        const { correctedSettings } = await validateAndCorrectSettings(settings);
        
        // Return corrected settings for potential update
        return correctedSettings;
      }
      
      console.log('✅ [Background Validation] Configuration health check passed');
      return null;
    } catch (error) {
      console.error('❌ [Background Validation] Health check failed:', error);
      setValidationState(prev => ({
        ...prev,
        errors: [...prev.errors, `Background validation failed: ${error}`],
        lastValidation: Date.now(),
      }));
      return null;
    }
  }, [validateAndCorrectSettings]);

  const handleDatabaseError = useCallback((error: any, operation: string, settings?: Partial<ProximitySettings>) => {
    console.error(`❌ [Database Error] Grace period ${operation} failed:`, error);
    
    const errorMessage = error?.message || 'Unknown database error';
    const isValidationError = errorMessage.includes('constraint') || errorMessage.includes('validation');
    
    if (isValidationError && settings) {
      console.log('🔧 [Database Error] Attempting recovery with auto-correction');
      
      // Attempt recovery with auto-correction
      return validateAndCorrectSettings(settings).then(({ correctedSettings }) => {
        toast({
          title: "Database Error Recovered",
          description: "Invalid grace period values were auto-corrected and saved successfully",
          variant: "default",
        });
        return correctedSettings;
      }).catch(recoveryError => {
        console.error('❌ [Database Error] Recovery failed:', recoveryError);
        toast({
          title: "Grace Period Save Failed",
          description: "Unable to save grace period settings. Using default values.",
          variant: "destructive",
        });
        throw recoveryError;
      });
    }
    
    // Non-validation database errors
    toast({
      title: "Database Error",
      description: `Failed to ${operation} grace period settings. Please try again.`,
      variant: "destructive",
    });
    
    throw error;
  }, [validateAndCorrectSettings, toast]);

  return {
    validationState,
    validateAndCorrectSettings,
    performBackgroundValidation,
    handleDatabaseError,
  };
};
