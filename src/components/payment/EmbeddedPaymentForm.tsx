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
}

export const EmbeddedPaymentForm: React.FC<EmbeddedPaymentFormProps> = ({
  onSuccess,
  onError,
  amount,
  experienceTitle,
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
        return_url: `${window.location.origin}/payment-success`,
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

  const formatAmount = (amount: number) => {
    return (amount / 100).toFixed(2);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">
          Complete Your Purchase
        </h3>
        <p className="text-sm text-muted-foreground">
          {experienceTitle}
        </p>
        <p className="text-lg font-bold text-foreground">
          ${formatAmount(amount)} USD
        </p>
      </div>

      <div className="space-y-4">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={!stripe || !elements || isLoading}
        className="w-full"
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