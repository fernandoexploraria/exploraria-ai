import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Stripe: any;
  }
}

export const CheckoutPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [experienceData, setExperienceData] = useState<any>(null);

  const clientSecret = searchParams.get("client_secret");
  const experienceId = searchParams.get("experience");

  useEffect(() => {
    console.log('🏪 CheckoutPage: Starting initialization with params:', {
      clientSecret: !!clientSecret,
      experienceId,
      user: !!user
    });
    
    // Check if user is authenticated
    if (!user) {
      console.log('🏪 CheckoutPage: User not authenticated, redirecting to home');
      navigate("/");
      return;
    }

    // Validate required parameters
    if (!clientSecret || !experienceId) {
      console.log('🏪 CheckoutPage: Missing required parameters', { clientSecret: !!clientSecret, experienceId });
      setError("Missing payment information. Please start the purchase process again.");
      setIsLoading(false);
      return;
    }

    console.log('🏪 CheckoutPage: Parameters valid, fetching experience data');
    // Fetch experience data
    fetchExperienceData();
  }, [user, clientSecret, experienceId]);

  const fetchExperienceData = async () => {
    try {
      console.log('🏪 CheckoutPage: Fetching experience data for ID:', experienceId);
      const { data, error } = await supabase
        .from('generated_tours')
        .select('*')
        .eq('id', experienceId)
        .single();

      if (error) throw error;
      console.log('🏪 CheckoutPage: Experience data fetched successfully:', data.destination);
      setExperienceData(data);
    } catch (error) {
      console.error('🏪 CheckoutPage: Error fetching experience data:', error);
      setError('Failed to load experience details');
    }
  };

  useEffect(() => {
    if (!clientSecret || !experienceData) return;

    const loadStripe = async () => {
      try {
        // Load Stripe.js if not already loaded
        if (!window.Stripe) {
          const script = document.createElement('script');
          script.src = 'https://js.stripe.com/v3/';
          script.onload = initializeStripe;
          script.onerror = () => setError('Failed to load Stripe. Please refresh and try again.');
          document.head.appendChild(script);
        } else {
          initializeStripe();
        }
      } catch (error) {
        console.error('Error loading Stripe:', error);
        setError('Failed to initialize payment system');
        setIsLoading(false);
      }
    };

    const initializeStripe = async () => {
      try {
        console.log('🏪 CheckoutPage: Initializing Stripe...');
        // Fetch the public key from the edge function
        const { data: keyData, error: keyError } = await supabase.functions.invoke('get-stripe-public-key');
        
        if (keyError || !keyData?.publicKey) {
          console.error('🏪 CheckoutPage: Failed to get Stripe public key:', keyError);
          throw new Error('Failed to get Stripe public key');
        }
        
        console.log('🏪 CheckoutPage: Got Stripe public key successfully');
        const STRIPE_PUBLIC_KEY = keyData.publicKey;

        const stripeInstance = window.Stripe(STRIPE_PUBLIC_KEY);
        if (!stripeInstance) {
          throw new Error('Failed to initialize Stripe');
        }

        console.log('🏪 CheckoutPage: Stripe instance created successfully');
        setStripe(stripeInstance);

        const elementsInstance = stripeInstance.elements({ clientSecret });
        setElements(elementsInstance);
        console.log('🏪 CheckoutPage: Stripe Elements created with client secret');

        // Wait for DOM to be ready and mount payment element
        const mountPaymentElement = () => {
          const elementContainer = document.getElementById('payment-element');
          
          if (!elementContainer) {
            console.error('🏪 CheckoutPage: Payment element container not found, retrying...');
            setTimeout(mountPaymentElement, 100);
            return;
          }

          try {
            console.log('🏪 CheckoutPage: Mounting payment element...');
            const paymentElement = elementsInstance.create('payment');
            paymentElement.mount('#payment-element');
            console.log('🏪 CheckoutPage: Payment element mounted successfully!');
            setIsLoading(false);
          } catch (mountError) {
            console.error('🏪 CheckoutPage: Error mounting payment element:', mountError);
            setError('Failed to load payment form. Please refresh and try again.');
            setIsLoading(false);
          }
        };

        // Start trying to mount after a small delay
        setTimeout(mountPaymentElement, 200);
        
      } catch (error) {
        console.error('Error initializing Stripe:', error);
        setError('Failed to initialize payment system');
        setIsLoading(false);
      }
    };

    loadStripe();
  }, [clientSecret, experienceData]);

  const handlePayment = async () => {
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setError(null);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success?experience=${experienceId}`,
        },
      });

      if (error) {
        setError(error.message);
        setIsProcessing(false);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsProcessing(false);
    }
  };

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-destructive">Payment Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Experiences
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Complete Your Purchase
          </CardTitle>
          {experienceData && (
            <CardDescription>
              Experience: {experienceData.destination}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading payment form...</span>
            </div>
          ) : (
            <>
              <div id="payment-element" className="min-h-[200px]"></div>
              
              <div className="space-y-4">
                <Button
                  onClick={handlePayment}
                  disabled={isProcessing || isLoading}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Complete Payment'
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="w-full"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Experiences
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};