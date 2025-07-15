import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Volume2, CreditCard } from 'lucide-react';
import { Experience } from '@/hooks/useExperiences';
import { useTTSContext } from '@/contexts/TTSContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { setPostAuthAction, setPostAuthLandmark } from '@/utils/authActions';
import { PaymentDialog } from '@/components/payment/PaymentDialog';

interface ExperienceCardProps {
  experience: Experience;
  onSelect?: (experience: Experience) => void;
  onIntelligentTourOpen?: () => void;
  onAuthDialogOpen?: () => void;
}

// Helper function to generate overview prompt from system_prompt
const generateOverviewPrompt = (destination: string, systemPrompt: string): string => {
  return `Based on the following detailed tour guide instructions for ${destination}, provide a friendly, engaging 30-second overview that would entice someone to take this experience. Focus on the key highlights, unique features, and what makes this tour special. Make it sound exciting and inviting:

${systemPrompt}

Please create a compelling overview that captures the essence of this experience.`;
};

const ExperienceCard: React.FC<ExperienceCardProps> = ({
  experience,
  onSelect,
  onIntelligentTourOpen,
  onAuthDialogOpen
}) => {
  const { speak, stop, isPlaying, currentPlayingId } = useTTSContext();
  const { user: authUser } = useAuth();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  
  const isCurrentlyPlaying = isPlaying && currentPlayingId === experience.id;
  
  const getPhotoUrl = (photo: any): string | null => {
    if (!photo) return null;
    if (typeof photo === 'string') return photo;
    if (Array.isArray(photo) && photo.length > 0) return photo[0];
    if (typeof photo === 'object' && photo.url) return photo.url;
    return null;
  };
  
  const photoUrl = getPhotoUrl(experience.photo);

  const handleExperienceTTS = async () => {
    if (isCurrentlyPlaying) {
      stop();
      return;
    }

    if (!experience.system_prompt) {
      console.warn('No system_prompt available for experience:', experience.destination);
      return;
    }

    const overviewPrompt = generateOverviewPrompt(experience.destination, experience.system_prompt);
    await speak(overviewPrompt, false, experience.id);
  };

  const convertExperienceToLandmark = (experience: Experience) => {
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

  const handlePurchaseExperience = async () => {
    try {
      // Check authentication first
      if (!authUser) {
        console.log('🚨 User not authenticated, setting up post-auth flow for experience');
        
        const landmark = convertExperienceToLandmark(experience);
        
        // Persist the experience and set post-auth action
        setPostAuthLandmark(landmark);
        setPostAuthAction('smart-tour');
        
        // Open auth dialog
        if (onAuthDialogOpen) {
          onAuthDialogOpen();
        }
        return;
      }

      // User is authenticated, create payment intent
      const { data, error } = await supabase.functions.invoke('create-experience-payment', {
        body: { 
          experienceId: experience.id,
          price: 4999 // $49.99 in cents
        }
      });

      if (error) throw error;

      if (data?.client_secret) {
        // Store client secret and open payment dialog
        setClientSecret(data.client_secret);
        setIsPaymentDialogOpen(true);
      } else {
        toast.error('Failed to create payment session');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to create payment session');
    }
  };

  const handlePaymentSuccess = () => {
    // Proceed with tour generation after successful payment
    if (!onIntelligentTourOpen) {
      console.warn('onIntelligentTourOpen not provided to ExperienceCard');
      toast.error('Unable to start tour generation');
      return;
    }

    const landmark = convertExperienceToLandmark(experience);
    if (!landmark) {
      console.error('Failed to convert experience to landmark');
      toast.error('Unable to process experience');
      return;
    }

    // Store landmark as pending destination for IntelligentTourDialog
    (window as any).pendingLandmarkDestination = landmark;

    // Open intelligent tour dialog
    onIntelligentTourOpen();
    
    toast.success('Payment successful! Starting your tour...');
  };

  return (
    <>
      <Card className="w-[280px] h-[380px] flex-shrink-0 overflow-hidden flex flex-col">
        {photoUrl && (
          <div className="h-[160px] w-full overflow-hidden flex-shrink-0">
            <img 
              src={photoUrl} 
              alt={experience.destination} 
              className="w-full h-full object-cover" 
              onError={e => {
                e.currentTarget.style.display = 'none';
              }} 
            />
          </div>
        )}
        
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-lg line-clamp-2 flex items-center gap-2 h-[56px]">
            <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="line-clamp-2">{experience.destination}</span>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-6 pt-0">
          <div className="flex-1 mb-4">
            <CardDescription className="text-sm h-[72px] overflow-y-auto">
              {experience.description || 'Discover amazing places and experiences in this curated tour.'}
            </CardDescription>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {experience.system_prompt && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExperienceTTS}
                className="bg-gradient-to-r from-blue-400/80 to-cyan-400/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-center border-blue-300 hover:from-blue-300/80 hover:to-cyan-300/80 lg:h-10 lg:text-sm lg:py-2 flex-shrink-0"
                disabled={isPlaying && !isCurrentlyPlaying}
              >
                <Volume2 className={`h-3 w-3 lg:h-4 lg:w-4 ${isCurrentlyPlaying ? 'animate-pulse' : ''}`} />
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePurchaseExperience}
              className="bg-gradient-to-r from-green-400/80 to-emerald-400/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-center flex-shrink-0 lg:h-10 lg:text-sm lg:py-2 border-green-300 hover:from-green-300/80 hover:to-emerald-300/80"
            >
              <CreditCard className="h-3 w-3 lg:h-4 lg:w-4" />
              <span className="ml-1 hidden sm:inline">$49.99</span>
            </Button>
            {onSelect && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onSelect(experience)} 
                className="bg-gradient-to-r from-purple-400/80 to-pink-400/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start flex-1 lg:h-10 lg:text-sm lg:py-2 border-purple-300 hover:from-purple-300/80 hover:to-pink-300/80"
              >
                Generate Experience
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <PaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        experience={experience}
        clientSecret={clientSecret}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </>
  );
};

export default ExperienceCard;