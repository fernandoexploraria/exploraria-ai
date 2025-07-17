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
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
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
    const initialHeight = window.innerHeight;
    
    const handleResize = () => {
      const currentHeight = window.innerHeight;
      setViewportHeight(currentHeight);
      
      // Detect keyboard on mobile - if height reduces significantly, keyboard is likely visible
      const heightDifference = initialHeight - currentHeight;
      const isKeyboard = heightDifference > 150; // Threshold for keyboard detection
      setIsKeyboardVisible(isKeyboard);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate dynamic height based on viewport and keyboard state
  const dynamicHeight = isMobile 
    ? (isKeyboardVisible 
        ? Math.min(viewportHeight * 0.7, 500) // More aggressive height reduction when keyboard is visible
        : Math.min(viewportHeight * 0.9, 700)
      )
    : 600;

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
          <DialogTitle className="text-lg sm:text-xl">Purchase Experience</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className={`space-y-${isMobile ? '3' : '4'} pb-20`}>
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
                  amount={999} // $9.99 in cents
                  experienceTitle={experience.destination}
                  isMobile={isMobile}
                  isKeyboardVisible={isKeyboardVisible}
                />
              </Elements>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};