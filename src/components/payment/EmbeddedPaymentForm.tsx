import React, { useState } from "react";
import {
  useStripe,
  useElements,
  PaymentElement,
  LinkAuthenticationElement,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Loader2, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EmbeddedPaymentFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
  amount: number;
  experienceTitle: string;
  isMobile?: boolean;
  onPromotionCodeApplied?: (promotionCodeId: string, newAmount: number) => void;
}

export const EmbeddedPaymentForm: React.FC<EmbeddedPaymentFormProps> = ({
  onSuccess,
  onError,
  amount,
  experienceTitle,
  isMobile = false,
  onPromotionCodeApplied,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [promoCode, setPromoCode] = useState<string>("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoApplied, setPromoApplied] = useState<{
    applied: boolean;
    message: string;
    promotionCodeId?: string;
    discountedAmount?: number;
  }>({ applied: false, message: "" });

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

  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) return;

    setPromoLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase.functions.invoke('validate-promo-code', {
        body: { couponCode: promoCode.trim() }
      });

      if (error) throw error;

      if (data.valid) {
        setPromoApplied({
          applied: true,
          message: data.message,
          promotionCodeId: data.promotionCodeId,
          discountedAmount: data.newAmount,
        });
        
        if (onPromotionCodeApplied) {
          onPromotionCodeApplied(data.promotionCodeId, data.newAmount);
        }
      } else {
        setErrorMessage(data.message || "Invalid promotion code");
      }
    } catch (error) {
      console.error('Error applying promo code:', error);
      setErrorMessage("Failed to apply promotion code. Please try again.");
    } finally {
      setPromoLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return (amount / 100).toFixed(2);
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${isMobile ? 'sm:space-y-6' : 'space-y-6'}`}>
      <div className="space-y-2">
        <h3 className={`font-semibold text-foreground ${isMobile ? 'text-base' : 'text-lg'}`}>
          Complete Your Purchase
        </h3>
        <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
          {experienceTitle}
        </p>
        <p className={`font-bold text-foreground ${isMobile ? 'text-base' : 'text-lg'}`}>
          {promoApplied.applied && promoApplied.discountedAmount !== undefined ? (
            <span>
              <span className="line-through text-muted-foreground text-sm">
                ${formatAmount(amount)}
              </span>{" "}
              ${formatAmount(promoApplied.discountedAmount)} USD
            </span>
          ) : (
            `$${formatAmount(amount)} USD`
          )}
        </p>
        
        {promoApplied.applied && (
          <div className="text-sm text-green-600 font-medium">
            ✓ {promoApplied.message}
          </div>
        )}
      </div>

      {/* Promotion Code Section */}
      {!promoApplied.applied && (
        <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <span className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
              Have a promotion code?
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className={isMobile ? 'text-sm' : ''}
              disabled={promoLoading}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleApplyPromoCode}
              disabled={!promoCode.trim() || promoLoading}
              className={isMobile ? 'text-xs px-3' : 'px-4'}
            >
              {promoLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "Apply"
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <LinkAuthenticationElement />
        
        <PaymentElement
          options={{
            layout: isMobile ? "accordion" : "tabs",
            paymentMethodOrder: isMobile ? ["card"] : undefined,
            fields: {
              billingDetails: 'auto',
            },
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
        className={`w-full ${isMobile ? 'h-10 text-sm' : 'h-11'}`}
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