import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Volume2, CreditCard, Loader2 } from 'lucide-react';
import { Experience } from '@/hooks/useExperiences';
import { useTTSContext } from '@/contexts/TTSContext';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
interface ExperienceCardProps {
  experience: Experience;
  onSelect?: (experience: Experience) => void;
}

// Helper function to generate overview prompt from system_prompt
const generateOverviewPrompt = (destination: string, systemPrompt: string): string => {
  return `Based on the following detailed tour guide instructions for ${destination}, provide a friendly, engaging 30-second overview that would entice someone to take this experience. Focus on the key highlights, unique features, and what makes this tour special. Make it sound exciting and inviting:

${systemPrompt}

Please create a compelling overview that captures the essence of this experience.`;
};
const ExperienceCard: React.FC<ExperienceCardProps> = ({
  experience,
  onSelect
}) => {
  const { speak, stop, isPlaying, currentPlayingId } = useTTSContext();
  const { user } = useAuth();
  const isCurrentlyPlaying = isPlaying && currentPlayingId === experience.id;
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
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

  const handleGenerateExperience = async () => {
    if (!user) {
      toast.error('Please log in to generate an experience');
      return;
    }

    setIsCreatingPayment(true);

    try {
      // Step 1: Create payment intent
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('create-payment-request', {
        body: {
          tourId: experience.id,
          touristId: user.id
        }
      });

      if (paymentError) {
        throw new Error(paymentError.message || 'Failed to create payment');
      }

      console.log('Payment intent created:', paymentData);
      toast.success('Payment record created successfully');

      // Step 2: Trigger existing tour generation after payment is persisted
      if (onSelect) {
        onSelect(experience);
      }

    } catch (error) {
      console.error('Payment creation error:', error);
      toast.error(error.message || 'Failed to create payment');
    } finally {
      setIsCreatingPayment(false);
    }
  };
  return <Card className="w-[280px] h-[380px] flex-shrink-0 overflow-hidden flex flex-col">
      {photoUrl && <div className="h-[160px] w-full overflow-hidden flex-shrink-0">
          <img src={photoUrl} alt={experience.destination} className="w-full h-full object-cover" onError={e => {
        e.currentTarget.style.display = 'none';
      }} />
        </div>}
      
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
          {experience.price && (
            <div className="mt-2 text-sm font-medium text-primary">
              ${experience.price.toFixed(2)} {experience.currency?.toUpperCase()}
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
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
          {onSelect && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleGenerateExperience}
              disabled={isCreatingPayment}
              className="bg-gradient-to-r from-purple-400/80 to-pink-400/80 backdrop-blur-sm shadow-lg text-xs px-2 py-1 h-8 justify-start flex-1 lg:h-10 lg:text-sm lg:py-2 border-purple-300 hover:from-purple-300/80 hover:to-pink-300/80"
            >
              {isCreatingPayment ? (
                <>
                  <Loader2 className="h-3 w-3 lg:h-4 lg:w-4 animate-spin mr-1" />
                  Creating...
                </>
              ) : (
                <>
                  <CreditCard className="h-3 w-3 lg:h-4 lg:w-4 mr-1" />
                  Generate Experience
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>;
};
export default ExperienceCard;