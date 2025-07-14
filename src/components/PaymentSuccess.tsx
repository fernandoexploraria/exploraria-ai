import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [paymentDetails, setPaymentDetails] = useState<{
    experienceId?: string;
    paymentIntentId?: string;
  }>({});

  useEffect(() => {
    const experienceId = searchParams.get("experience") || searchParams.get("experience_id");
    const paymentIntentId = searchParams.get("payment_intent");
    
    setPaymentDetails({
      experienceId: experienceId || undefined,
      paymentIntentId: paymentIntentId || undefined,
    });

    // Show success toast and inform user about tour generation
    toast.success('Payment successful! Your tour will be generated automatically when you return to the main page.');
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl font-bold">Payment Successful!</CardTitle>
          <CardDescription>
            Your experience has been booked successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentDetails.experienceId && (
            <div className="text-sm text-muted-foreground">
              <p>Experience ID: {paymentDetails.experienceId}</p>
            </div>
          )}
          {paymentDetails.paymentIntentId && (
            <div className="text-sm text-muted-foreground">
              <p>Payment ID: {paymentDetails.paymentIntentId}</p>
            </div>
          )}
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-700">
              You will receive a confirmation email shortly with your booking details.
              The tour guide has been notified of your booking.
            </p>
          </div>
          <Button 
            onClick={() => navigate("/")} 
            className="w-full"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Experiences
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};