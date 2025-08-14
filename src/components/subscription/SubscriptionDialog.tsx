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
import { SubscriptionPaymentForm } from "./SubscriptionPaymentForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const [resetKey, setResetKey] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const isMobile = useIsMobile();

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

  // Handle viewport changes for mobile keyboard
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

  // Calculate dynamic height based on viewport
  const dynamicHeight = isMobile ? Math.min(viewportHeight * 0.9, 700) : 600;

  const handleOpenChange = (newOpen: boolean) => {
    // If closing the dialog with an error, increment resetKey to force remount
    if (!newOpen && paymentStatus === 'error') {
      setResetKey(prev => prev + 1);
    }
    onOpenChange(newOpen);
  };

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className={`
          max-w-md sm:max-w-lg 
          ${isMobile ? 'fixed top-4 left-4 right-4 bottom-4 translate-x-0 translate-y-0 max-h-none' : 'max-h-[85vh] sm:max-h-[80vh]'}
          overflow-hidden
          p-4 sm:p-6
          data-[state=open]:animate-in
          data-[state=closed]:animate-out
          data-[state=closed]:fade-out-0
          data-[state=open]:fade-in-0
          ${isMobile ? 'data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%]' : 'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]'}
        `}
        style={isMobile ? { height: `${dynamicHeight}px` } : undefined}
        data-vaul-no-drag="true"
      >
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg sm:text-xl">Subscribe to Premium</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="space-y-4 pb-4">
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
                <SubscriptionPaymentForm
                  onSuccess={handleSubscriptionSuccess}
                  onError={handlePaymentError}
                  subscriptionId={subscriptionId}
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