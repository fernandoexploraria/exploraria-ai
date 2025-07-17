import React, { useState, useEffect } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubscriptionPaymentForm } from "./SubscriptionPaymentForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string | null;
  subscriptionId: string | null;
  onSubscriptionSuccess: () => void;
}

export const SubscriptionDialog: React.FC<SubscriptionDialogProps> = ({
  open,
  onOpenChange,
  clientSecret,
  subscriptionId,
  onSubscriptionSuccess,
}) => {
  const [stripe, setStripe] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    const initializeStripe = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-stripe-config');
        
        if (error || !data?.publicKey) {
          console.error('Failed to get Stripe public key:', error);
          setStatusMessage("Failed to initialize payment system");
          setPaymentStatus('error');
          return;
        }
        
        const stripeInstance = await loadStripe(data.publicKey);
        setStripe(stripeInstance);
      } catch (error) {
        console.error('Failed to initialize Stripe:', error);
        setStatusMessage("Failed to initialize payment system");
        setPaymentStatus('error');
      }
    };

    if (open && clientSecret) {
      initializeStripe();
    }
  }, [open, clientSecret]);

  const handleSubscriptionSuccess = () => {
    setPaymentStatus('success');
    setStatusMessage("Subscription activated! You now have unlimited access to Smart Tours.");
    
    // Wait a moment to show success message, then trigger refresh
    setTimeout(() => {
      onSubscriptionSuccess();
      onOpenChange(false);
      // Reset status for next time
      setPaymentStatus('idle');
      setStatusMessage("");
    }, 2000);
  };

  const handlePaymentError = (error: string) => {
    setPaymentStatus('error');
    setStatusMessage(error);
  };

  if (!clientSecret || !subscriptionId || !stripe) {
    return null;
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe to Premium</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {paymentStatus === 'success' && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {statusMessage}
              </AlertDescription>
            </Alert>
          )}
          
          {paymentStatus === 'error' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {statusMessage}
              </AlertDescription>
            </Alert>
          )}
          
          {paymentStatus === 'idle' && (
            <Elements stripe={stripe} options={options}>
              <SubscriptionPaymentForm
                onSuccess={handleSubscriptionSuccess}
                onError={handlePaymentError}
                subscriptionId={subscriptionId}
              />
            </Elements>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};