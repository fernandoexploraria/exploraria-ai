import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Experience } from '@/hooks/useExperiences';

interface StripePaymentFormProps {
  experience: Experience;
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}

declare global {
  interface Window {
    Stripe: any;
  }
}

export const StripePaymentForm: React.FC<StripePaymentFormProps> = ({
  experience,
  clientSecret,
  onSuccess,
  onCancel
}) => {
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const paymentElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initializeStripe = async () => {
      try {
        console.log('[StripePaymentForm] Initializing Stripe with clientSecret:', clientSecret);
        
        // Use the Stripe public key directly (it's safe to be public)
        const publishableKey = 'pk_test_51QJlDe05kYnItJGT1DcuLQhfSdMJjIXxUKKL2hFHa4XRQH5Kj2JKyRHC7uJJ6p8x1s9QyIw8x7rWdYLTwJrO6xo00BYBz6K6v';
        console.log('[StripePaymentForm] Using publishable key:', publishableKey.substring(0, 20) + '...');

        // Check if Stripe.js is already loaded
        if (!window.Stripe) {
          console.log('[StripePaymentForm] Loading Stripe.js script...');
          const script = document.createElement('script');
          script.src = 'https://js.stripe.com/v3/';
          script.async = true;
          document.head.appendChild(script);
          
          await new Promise((resolve, reject) => {
            script.onload = () => {
              console.log('[StripePaymentForm] Stripe.js loaded successfully');
              resolve(true);
            };
            script.onerror = () => {
              console.error('[StripePaymentForm] Failed to load Stripe.js');
              reject(new Error('Failed to load Stripe.js'));
            };
          });
        } else {
          console.log('[StripePaymentForm] Stripe.js already loaded');
        }

        // Initialize Stripe with publishable key
        console.log('[StripePaymentForm] Initializing Stripe instance...');
        const stripeInstance = window.Stripe(publishableKey);
        setStripe(stripeInstance);
        console.log('[StripePaymentForm] Stripe instance created');

        // Initialize Elements with client secret
        console.log('[StripePaymentForm] Creating Elements instance...');
        const elementsInstance = stripeInstance.elements({ clientSecret });
        setElements(elementsInstance);
        console.log('[StripePaymentForm] Elements instance created');

        // Create and mount Payment Element
        console.log('[StripePaymentForm] Creating payment element...');
        const paymentElement = elementsInstance.create('payment');
        console.log('[StripePaymentForm] Payment element created, mounting...');
        paymentElement.mount(paymentElementRef.current);
        console.log('[StripePaymentForm] Payment element mounted successfully');

        setIsLoading(false);
        setErrorMessage('');
      } catch (error) {
        console.error('[StripePaymentForm] Error initializing Stripe:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load payment form. Please try again.');
        setIsLoading(false);
      }
    };

    if (clientSecret) {
      console.log('[StripePaymentForm] clientSecret available, checking DOM element...');
      // Wait a bit for the DOM element to be ready
      const checkElement = () => {
        if (paymentElementRef.current) {
          console.log('[StripePaymentForm] DOM element found, starting initialization');
          initializeStripe();
        } else {
          console.log('[StripePaymentForm] DOM element not ready, retrying in 100ms...');
          setTimeout(checkElement, 100);
        }
      };
      checkElement();
    } else {
      console.log('[StripePaymentForm] Waiting for clientSecret...');
    }
  }, [clientSecret]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      setErrorMessage('Payment form not ready. Please try again.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success?experience_id=${experience.id}`,
        },
        redirect: 'if_required'
      });

      if (error) {
        setErrorMessage(error.message || 'Payment failed. Please try again.');
        setIsProcessing(false);
      } else {
        // Payment succeeded without redirect
        onSuccess();
      }
    } catch (error) {
      console.error('Payment error:', error);
      setErrorMessage('Payment failed. Please try again.');
      setIsProcessing(false);
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="min-h-[200px] flex items-center justify-center relative">
            <div ref={paymentElementRef} className="w-full" />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading payment form...</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                'Pay $9.99'
              )}
            </Button>
          </div>
        </form>

        <div className="text-xs text-muted-foreground text-center">
          Your payment is secured by Stripe. After successful payment, your tour will be generated automatically.
        </div>
      </CardContent>
    </Card>
  );
};