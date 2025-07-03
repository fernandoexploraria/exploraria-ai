
import { useCallback } from 'react';
import { useProximityAlerts } from '@/hooks/useProximityAlerts';
import { useProximityAlertsValidation } from '@/hooks/useProximityAlertsValidation';
import { gracePeriodErrorRecovery } from '@/utils/gracePeriodErrorRecovery';
import { ProximitySettings } from '@/types/proximityAlerts';
import { supabase } from '@/integrations/supabase/client';

export const useProximityAlertsEnhanced = () => {
  const proximityAlertsHook = useProximityAlerts();
  const { validateAndCorrectSettings, performBackgroundValidation, handleDatabaseError, validationState } = useProximityAlertsValidation();

  // Enhanced settings update with validation and error recovery
  const updateProximitySettingsWithValidation = useCallback(async (
    settings: Partial<ProximitySettings>
  ): Promise<void> => {
    console.log('🔧 [Enhanced Update] Starting validated proximity settings update:', settings);
    
    try {
      // Step 1: Validate and auto-correct settings
      const { correctedSettings } = await validateAndCorrectSettings(settings);
      
      // Step 2: Perform database update with retry logic
      await gracePeriodErrorRecovery.retryDatabaseOperation(
        async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not authenticated');

          const { error } = await supabase
            .from('proximity_settings')
            .upsert({
              user_id: user.id,
              ...correctedSettings,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

          if (error) throw error;
          
          console.log('✅ [Enhanced Update] Database update successful');
        },
        `update-proximity-settings-${Date.now()}`
      );
      
      // Step 3: Trigger background validation to ensure consistency
      setTimeout(() => {
        performBackgroundValidation(correctedSettings as ProximitySettings);
      }, 1000);
      
    } catch (error) {
      console.error('❌ [Enhanced Update] Update failed, attempting error recovery:', error);
      
      // Attempt error recovery
      const recoveryResult = await gracePeriodErrorRecovery.recoverFromValidationError(settings, 'database-update');
      
      if (recoveryResult.success) {
        console.log('🛡️ [Enhanced Update] Error recovery successful:', recoveryResult);
        
        // Retry with recovered settings
        await gracePeriodErrorRecovery.retryDatabaseOperation(
          async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            const { error } = await supabase
              .from('proximity_settings')
              .upsert({
                user_id: user.id,
                ...recoveryResult.recoveredSettings,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id' });

            if (error) throw error;
          },
          `recovery-update-${Date.now()}`
        );
      } else {
        handleDatabaseError(error, 'update', settings);
      }
    }
  }, [validateAndCorrectSettings, performBackgroundValidation, handleDatabaseError]);

  // Background health monitoring
  const performHealthCheck = useCallback(async () => {
    console.log('🏥 [Health Check] Performing proximity settings health check');
    
    if (proximityAlertsHook.proximitySettings) {
      const correctedSettings = await performBackgroundValidation(proximityAlertsHook.proximitySettings);
      
      if (correctedSettings) {
        console.log('🔧 [Health Check] Auto-corrections needed, applying updates');
        await updateProximitySettingsWithValidation(correctedSettings);
      }
    }
    
    const recoveryHealth = gracePeriodErrorRecovery.getHealthStatus();
    console.log('📊 [Health Check] System health status:', {
      validation: validationState,
      recovery: recoveryHealth,
    });
  }, [proximityAlertsHook.proximitySettings, performBackgroundValidation, updateProximitySettingsWithValidation, validationState]);

  return {
    ...proximityAlertsHook,
    updateProximitySettingsWithValidation,
    validationState,
    performHealthCheck,
    recoveryHealth: gracePeriodErrorRecovery.getHealthStatus(),
  };
};
