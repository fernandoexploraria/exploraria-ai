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
        // Get Stripe publishable key from environment
        const publishableKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY_TEST;
        if (!publishableKey) {
          throw new Error('Stripe publishable key not configured. Please add VITE_STRIPE_PUBLIC_KEY_TEST to your environment variables.');
        }

        // Check if Stripe.js is already loaded
        if (!window.Stripe) {
          // Load Stripe.js dynamically
          const script = document.createElement('script');
          script.src = 'https://js.stripe.com/v3/';
          script.async = true;
          document.head.appendChild(script);
          
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
          });
        }

        // Initialize Stripe with publishable key
        const stripeInstance = window.Stripe(publishableKey);
        setStripe(stripeInstance);

        // Initialize Elements with client secret
        const elementsInstance = stripeInstance.elements({ clientSecret });
        setElements(elementsInstance);

        // Wait for the DOM element to be ready
        if (paymentElementRef.current) {
          // Create and mount Payment Element
          const paymentElement = elementsInstance.create('payment');
          paymentElement.mount(paymentElementRef.current);

          setIsLoading(false);
          setErrorMessage('');
        } else {
          throw new Error('Payment element container not found');
        }
      } catch (error) {
        console.error('Error initializing Stripe:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load payment form. Please try again.');
        setIsLoading(false);
      }
    };

    if (clientSecret && paymentElementRef.current) {
      initializeStripe();
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
          <div className="min-h-[200px] flex items-center justify-center">
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading payment form...</span>
              </div>
            ) : (
              <div ref={paymentElementRef} className="w-full" />
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