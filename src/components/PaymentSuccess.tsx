import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

export const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [paymentDetails, setPaymentDetails] = useState<{
    experienceId?: string;
    paymentIntentId?: string;
  }>({});
  const [isGeneratingTour, setIsGeneratingTour] = useState(false);
  const [tourGenerated, setTourGenerated] = useState(false);
  const [experienceData, setExperienceData] = useState<any>(null);

  useEffect(() => {
    const experienceId = searchParams.get("experience");
    const paymentIntentId = searchParams.get("payment_intent");
    
    setPaymentDetails({
      experienceId: experienceId || undefined,
      paymentIntentId: paymentIntentId || undefined,
    });

    // Generate tour after successful payment
    if (experienceId && user && !tourGenerated) {
      generateTour(experienceId);
    }
  }, [searchParams, user, tourGenerated]);

  const convertExperienceToLandmark = (experience: any) => {
    const details = experience.destination_details;
    if (!details) {
      console.error('Experience missing destination_details:', experience);
      return {
        id: experience.id,
        name: experience.destination,
        description: experience.description,
        coordinates: [0, 0], // Will be updated later
        experience: true
      };
    }
    return {
      id: experience.id,
      name: details.name || experience.destination,
      description: details.editorialSummary || experience.description,
      coordinates: [details.location.longitude, details.location.latitude],
      placeId: details.placeId,
      formattedAddress: details.address,
      types: details.types || details.destination_types || ['tourist_attraction'],
      rating: details.rating,
      tourId: experience.id,
      experience: true
    };
  };

  const generateTour = async (experienceId: string) => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    setIsGeneratingTour(true);
    
    try {
      // Fetch experience data
      const { data: experience, error: fetchError } = await supabase
        .from('generated_tours')
        .select('*')
        .eq('id', experienceId)
        .single();

      if (fetchError) {
        console.error('Error fetching experience:', fetchError);
        toast.error('Failed to load experience details');
        return;
      }

      setExperienceData(experience);

      // Convert experience to landmark format
      const landmark = convertExperienceToLandmark(experience);
      
      // Store landmark for the dialog
      (window as any).pendingLandmarkDestination = landmark;
      
      // Open intelligent tour dialog
      setTimeout(() => {
        // Trigger intelligent tour dialog
        const event = new CustomEvent('openIntelligentTour');
        window.dispatchEvent(event);
        setTourGenerated(true);
        setIsGeneratingTour(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error generating tour:', error);
      toast.error('Failed to generate tour');
      setIsGeneratingTour(false);
    }
  };

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
          {experienceData && (
            <div className="text-sm text-muted-foreground">
              <p>Experience: {experienceData.destination}</p>
            </div>
          )}
          {paymentDetails.paymentIntentId && (
            <div className="text-sm text-muted-foreground">
              <p>Payment ID: {paymentDetails.paymentIntentId}</p>
            </div>
          )}
          
          {isGeneratingTour && (
            <div className="bg-blue-50 p-4 rounded-lg flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <p className="text-sm text-blue-700">
                Generating your personalized tour...
              </p>
            </div>
          )}
          
          {tourGenerated && (
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-700">
                Your tour has been generated! Check your tour dialog for the personalized experience.
              </p>
            </div>
          )}
          
          {!isGeneratingTour && !tourGenerated && (
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-700">
                You will receive a confirmation email shortly with your booking details.
                The tour guide has been notified of your booking.
              </p>
            </div>
          )}
          
          <Button 
            onClick={() => navigate("/")} 
            className="w-full"
            disabled={isGeneratingTour}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Experiences
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};