import React, { useState } from "react";
import {
  useStripe,
  useElements,
  PaymentElement,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard } from "lucide-react";

interface SubscriptionPaymentFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
  subscriptionId: string;
  isMobile?: boolean;
}

export const SubscriptionPaymentForm: React.FC<SubscriptionPaymentFormProps> = ({
  onSuccess,
  onError,
  subscriptionId,
  isMobile = false,
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

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/subscription-success`,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message || "An unexpected error occurred.");
      setIsLoading(false);
      onError(error.message || "Payment failed");
    } else {
      // Payment succeeded
      setIsLoading(false);
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-${isMobile ? '4' : '6'}`}>
      <div className={`space-y-${isMobile ? '1' : '2'}`}>
        <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-foreground`}>
          Start Your Premium Subscription
        </h3>
        <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
          Get unlimited Smart Tours and advanced features for just $9.99/month
        </p>
        <div className={`bg-muted/50 ${isMobile ? 'p-2' : 'p-3'} rounded-lg`}>
          <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-foreground mb-1`}>
            What's included:
          </p>
          <ul className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground space-y-1`}>
            <li>• Unlimited Smart Tours</li>
            <li>• Premium destinations</li>
            <li>• Advanced tour customization</li>
            <li>• Priority support</li>
          </ul>
        </div>
        <p className={`${isMobile ? 'text-base' : 'text-lg'} font-bold text-foreground`}>
          $9.99/month
        </p>
      </div>

      <div className={`space-y-${isMobile ? '3' : '4'}`}>
        <PaymentElement
          options={{
            layout: isMobile ? "accordion" : "tabs",
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
        className={`w-full ${isMobile ? 'h-12 text-sm' : 'h-10'}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            {isMobile ? 'Start Subscription' : 'Start Subscription - $9.99/month'}
          </>
        )}
      </Button>
      
      <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground text-center`}>
        You can cancel anytime from your account settings
      </p>
    </form>
  );
};