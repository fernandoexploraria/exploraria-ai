import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PaymentProcessor = 'stripe' | 'apple';

interface PaymentProcessorConfig {
  processor: PaymentProcessor;
  isLoading: boolean;
  error?: string;
}

export const usePaymentProcessor = (): PaymentProcessorConfig => {
  const [config, setConfig] = useState<PaymentProcessorConfig>({
    processor: 'stripe', // Default fallback
    isLoading: true,
  });

  useEffect(() => {
    const fetchPaymentProcessor = async () => {
      try {
        console.log('🔧 Fetching payment processor configuration...');
        
        const { data, error } = await supabase.functions.invoke('get-payment-processor-config');
        
        if (error) {
          console.error('❌ Error fetching payment processor:', error);
          setConfig({
            processor: 'stripe',
            isLoading: false,
            error: error.message,
          });
          return;
        }

        const processor = data?.processor || 'stripe';
        console.log('✅ Payment processor configured:', processor);
        
        setConfig({
          processor: processor as PaymentProcessor,
          isLoading: false,
          error: data?.error,
        });
      } catch (error) {
        console.error('❌ Failed to fetch payment processor config:', error);
        setConfig({
          processor: 'stripe',
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    fetchPaymentProcessor();
  }, []);

  return config;
};