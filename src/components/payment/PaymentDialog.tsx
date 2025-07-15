import React, { useState, useEffect } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmbeddedPaymentForm } from "./EmbeddedPaymentForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Experience } from "@/hooks/useExperiences";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experience: Experience | null;
  clientSecret: string | null;
  onPaymentSuccess: () => void;
}

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onOpenChange,
  experience,
  clientSecret,
  onPaymentSuccess,
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

  const handlePaymentSuccess = () => {
    setPaymentStatus('success');
    setStatusMessage("Payment successful! Redirecting to your tour...");
    
    // Wait a moment to show success message, then trigger tour generation
    setTimeout(() => {
      onPaymentSuccess();
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

  if (!experience || !clientSecret || !stripe) {
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
          <DialogTitle>Purchase Experience</DialogTitle>
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
              <EmbeddedPaymentForm
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                amount={4999} // $49.99 in cents
                experienceTitle={experience.destination}
              />
            </Elements>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};