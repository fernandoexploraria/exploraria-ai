import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Experience } from '@/hooks/useExperiences';
import { supabase } from '@/integrations/supabase/client';

interface StripePaymentFormProps {
  experience: Experience;
  clientSecret: string; // Not used anymore, but keeping for compatibility
  onSuccess: () => void;
  onCancel: () => void;
}

export const StripePaymentForm: React.FC<StripePaymentFormProps> = ({
  experience,
  onSuccess,
  onCancel
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handlePayment = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      console.log('[StripePaymentForm] Starting checkout process for experience:', experience.id);
      
      // Call the create-experience-checkout edge function
      const { data, error } = await supabase.functions.invoke('create-experience-checkout', {
        body: { 
          experienceId: experience.id,
          price: 999 // $9.99 in cents
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to create checkout session');
      }

      if (!data?.url) {
        throw new Error('No checkout URL received');
      }

      console.log('[StripePaymentForm] Checkout session created, redirecting to:', data.url);
      
      // Open Stripe checkout in a new tab
      window.open(data.url, '_blank');
      
      // Call onSuccess to close the modal
      onSuccess();
      
    } catch (error) {
      console.error('[StripePaymentForm] Checkout error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start checkout process');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Complete Payment</CardTitle>
        <div className="text-center text-sm text-muted-foreground">
          {experience.destination} - $9.99
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="text-center text-sm text-muted-foreground">
          You will be redirected to Stripe's secure checkout to complete your payment.
        </div>

        <div className="flex space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePayment}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Starting Checkout...
              </>
            ) : (
              'Pay $9.99'
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          Your payment is secured by Stripe. After successful payment, your tour will be generated automatically.
        </div>
      </CardContent>
    </Card>
  );
};