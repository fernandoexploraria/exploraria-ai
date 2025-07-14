import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";

export const PaymentFailure = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [paymentDetails, setPaymentDetails] = useState<{
    experienceId?: string;
    error?: string;
  }>({});

  useEffect(() => {
    const experienceId = searchParams.get("experience");
    const error = searchParams.get("error");
    
    setPaymentDetails({
      experienceId: experienceId || undefined,
      error: error || undefined,
    });
  }, [searchParams]);

  const handleRetry = () => {
    if (paymentDetails.experienceId) {
      navigate(`/?retry=${paymentDetails.experienceId}`);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <XCircle className="h-16 w-16 text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold">Payment Failed</CardTitle>
          <CardDescription>
            We couldn't process your payment for this experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentDetails.error && (
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-red-700">
                Error: {paymentDetails.error}
              </p>
            </div>
          )}
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-yellow-700">
              Please check your payment method and try again. If the issue persists, 
              contact your bank or try a different payment method.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleRetry}
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate("/")} 
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Experiences
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};