import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CreditCard, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Load Stripe with the publishable key from environment
const stripePromise = loadStripe(process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_your_publishable_key_here');

interface CheckoutPageProps {}

const CheckoutPage: React.FC<CheckoutPageProps> = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentElement, setPaymentElement] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [message, setMessage] = useState<string>('');
  const [experienceId, setExperienceId] = useState<string | null>(null);
  const [experienceTitle, setExperienceTitle] = useState<string>('');

  useEffect(() => {
    const expId = searchParams.get('experience');
    const title = searchParams.get('title') || 'Premium Experience';
    setExperienceId(expId);
    setExperienceTitle(title);

    if (expId) {
      initializePayment(expId);
    } else {
      setMessage('Invalid experience ID. Please try again.');
    }
  }, [searchParams]);

  const initializePayment = async (experienceId: string) => {
    setIsLoading(true);
    setMessage('Initializing payment...');

    try {
      const { data, error } = await supabase.functions.invoke('create-experience-payment', {
        body: { 
          experienceId,
          price: 999 // $9.99 in cents
        }
      });

      if (error) throw error;

      if (data?.client_secret) {
        setClientSecret(data.client_secret);
        await setupStripeElements(data.client_secret);
        setMessage('');
      } else {
        throw new Error('Failed to get payment details');
      }
    } catch (error) {
      console.error('Payment initialization error:', error);
      setMessage('Failed to initialize payment. Please try again.');
      toast.error('Failed to initialize payment');
    } finally {
      setIsLoading(false);
    }
  };

  const setupStripeElements = async (clientSecret: string) => {
    const stripe = await stripePromise;
    if (!stripe) {
      throw new Error('Stripe failed to load');
    }

    // Wait for the DOM element to exist
    const checkElement = () => {
      return new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const element = document.getElementById('payment-element');
          if (element) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    };

    await checkElement();

    const elements = stripe.elements({ 
      clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#0070f3',
          colorBackground: '#ffffff',
          colorText: '#30313d',
          colorDanger: '#df1b41',
          fontFamily: 'system-ui, sans-serif',
          spacingUnit: '4px',
          borderRadius: '8px',
        },
      },
    });
    setElements(elements);

    const paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');
    setPaymentElement(paymentElement);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!elements || !clientSecret || !paymentElement) {
      setMessage('Payment system not ready. Please try again.');
      return;
    }

    setIsProcessing(true);
    setMessage('Processing payment...');

    const stripe = await stripePromise;
    if (!stripe) {
      setMessage('Payment system unavailable. Please try again.');
      setIsProcessing(false);
      return;
    }

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success?experience=${experienceId}`,
        },
      });

      if (error) {
        setMessage(error.message || 'Payment failed. Please try again.');
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('Payment confirmation error:', err);
      setMessage('Payment failed. Please try again.');
      setIsProcessing(false);
    }
    // If no error, the user will be redirected to the return_url
  };

  const handleGoBack = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={handleGoBack}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Experiences
          </Button>
        </div>

        <Card className="shadow-xl border-0 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              <CreditCard className="h-6 w-6 text-primary" />
              Secure Checkout
            </CardTitle>
            <p className="text-muted-foreground">
              Complete your purchase for: <strong>{experienceTitle}</strong>
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-2">
              <Lock className="h-4 w-4" />
              <span>Secured by Stripe</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Experience Purchase</span>
                <span className="text-2xl font-bold text-primary">$9.99</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                One-time payment for premium experience
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <label htmlFor="payment-element" className="block text-sm font-medium">
                  Payment Details
                </label>
                
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-2">Loading payment form...</span>
                  </div>
                ) : (
                  <div 
                    id="payment-element" 
                    className="border rounded-lg p-4 bg-background"
                  />
                )}
              </div>

              {message && (
                <div className={`p-3 rounded-lg text-sm ${
                  message.includes('Failed') || message.includes('error') || message.includes('declined')
                    ? 'bg-destructive/10 text-destructive border border-destructive/20'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {message}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || isProcessing || !clientSecret}
                className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Pay $9.99
                  </>
                )}
              </Button>
            </form>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                By completing this purchase, you agree to our terms of service.
                <br />
                Your payment is securely processed by Stripe.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CheckoutPage;