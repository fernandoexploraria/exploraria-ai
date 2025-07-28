import React, { useState, useEffect } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmbeddedPaymentForm } from "./EmbeddedPaymentForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Experience } from "@/hooks/useExperiences";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const [resetKey, setResetKey] = useState<number>(0);
  const isMobile = useIsMobile();
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

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

  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset payment state when dialog opens
  useEffect(() => {
    if (open) {
      setPaymentStatus('idle');
      setStatusMessage('');
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    // If closing the dialog with an error, increment resetKey to force remount
    if (!newOpen && paymentStatus === 'error') {
      setResetKey(prev => prev + 1);
    }
    onOpenChange(newOpen);
  };

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
    features: {
      linkAuthentication: {
        allowLoggedOutEmail: true,
        allowRedisplay: 'auto',
      },
    },
  };

  const dynamicMaxHeight = isMobile ? 
    Math.min(viewportHeight * 0.85, 600) : 
    Math.min(viewportHeight * 0.9, 700);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className={`
          max-w-md sm:max-w-lg p-4 sm:p-6 flex flex-col
          ${isMobile 
            ? 'fixed top-4 left-4 right-4 bottom-4 w-auto h-auto translate-x-0 translate-y-0' 
            : 'relative'
          }
        `}
        style={isMobile ? { maxHeight: `${dynamicMaxHeight}px` } : {}}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base sm:text-lg">Purchase Experience</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="space-y-3 sm:space-y-4 py-1">
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
              <Elements key={resetKey} stripe={stripe} options={options}>
                <EmbeddedPaymentForm
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  amount={999} // $9.99 in cents
                  experienceTitle={experience.destination}
                  isMobile={isMobile}
                />
              </Elements>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};