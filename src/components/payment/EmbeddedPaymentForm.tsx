import React, { useState } from "react";
import {
  useStripe,
  useElements,
  PaymentElement,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface EmbeddedPaymentFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
  amount: number;
  experienceTitle: string;
  isMobile?: boolean;
  isKeyboardVisible?: boolean;
}

export const EmbeddedPaymentForm: React.FC<EmbeddedPaymentFormProps> = ({
  onSuccess,
  onError,
  amount,
  experienceTitle,
  isMobile = false,
  isKeyboardVisible = false,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message || "An unexpected error occurred.");
      setIsLoading(false);
      onError(error.message || "Payment failed");
    } else if (paymentIntent) {
      // Check the payment intent status
      if (paymentIntent.status === 'succeeded') {
        setIsLoading(false);
        onSuccess();
      } else if (paymentIntent.status === 'processing') {
        // Payment is still processing, wait a bit and check again
        setTimeout(async () => {
          try {
            const { paymentIntent: updatedPI } = await stripe.retrievePaymentIntent(paymentIntent.client_secret);
            if (updatedPI && updatedPI.status === 'succeeded') {
              setIsLoading(false);
              onSuccess();
            } else if (updatedPI && (updatedPI.status === 'canceled' || updatedPI.status === 'requires_payment_method')) {
              setErrorMessage("Payment failed. Please try again.");
              setIsLoading(false);
              onError("Payment failed");
            } else {
              // Still processing or other status, give it more time
              setErrorMessage("Payment is still processing. Please wait...");
            }
          } catch (retrieveError) {
            console.error('Error retrieving payment intent:', retrieveError);
            setErrorMessage("Unable to verify payment status. Please check your payment method.");
            setIsLoading(false);
            onError("Payment verification failed");
          }
        }, 2000);
      } else if (paymentIntent.status === 'requires_action') {
        setErrorMessage("Payment requires additional authentication. Please try again.");
        setIsLoading(false);
        onError("Payment requires action");
      } else {
        setErrorMessage(`Payment ${paymentIntent.status}. Please try again.`);
        setIsLoading(false);
        onError(`Payment ${paymentIntent.status}`);
      }
    } else {
      // No error and no payment intent - something went wrong
      setErrorMessage("Payment confirmation failed. Please try again.");
      setIsLoading(false);
      onError("Payment confirmation failed");
    }
  };

  const formatAmount = (amount: number) => {
    return (amount / 100).toFixed(2);
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-${isMobile ? '3' : '6'}`}>
      <div className={`space-y-${isMobile ? '1' : '2'}`}>
        <h3 className={`${isMobile ? 'text-sm' : 'text-lg'} font-semibold text-foreground`}>
          Complete Your Purchase
        </h3>
        <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
          {experienceTitle}
        </p>
        <p className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold text-foreground`}>
          ${formatAmount(amount)} USD
        </p>
      </div>

      <div className={`space-y-${isMobile ? '2' : '4'}`}>
        <PaymentElement
          options={{
            layout: isMobile ? "accordion" : "tabs",
            paymentMethodOrder: isMobile ? ['card'] : undefined,
            fields: {
              billingDetails: isMobile ? 'never' : 'auto',
            },
            ...(isMobile && {
              disableLink: true,
              terms: {
                card: 'never',
              },
            }),
          }}
        />
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription className={isMobile ? 'text-xs' : 'text-sm'}>
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={!stripe || !elements || isLoading}
        className={`w-full ${isMobile ? 'h-10 text-sm' : 'h-10'} ${isKeyboardVisible ? 'sticky bottom-4' : ''}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          `Pay $${formatAmount(amount)}`
        )}
      </Button>
    </form>
  );
};