import React from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Sparkles } from 'lucide-react';
import { CityData } from '@/utils/cityExtraction';
import { useAuth } from '@/components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { setPostAuthAction, setPostAuthLandmark } from '@/utils/authActions';
import { toast } from '@/hooks/use-toast';

interface CityTourCTAProps {
  cityData: CityData;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  buttonText?: string;
  onIntelligentTourOpen?: (landmark: any) => void;
  onAuthDialogOpen?: () => void;
}

export const CityTourCTA: React.FC<CityTourCTAProps> = ({
  cityData,
  variant = 'default',
  size = 'default',
  className = '',
  buttonText,
  onIntelligentTourOpen,
  onAuthDialogOpen
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const defaultButtonText = buttonText || `Generate Your ${cityData.name} Tour Now!`;

  const createSyntheticLandmark = (cityData: CityData) => {
    return {
      id: `city-${cityData.slug}`,
      name: cityData.name,
      coordinates: cityData.coordinates,
      place_id: `city-${cityData.slug}`,
      description: `Explore the vibrant city of ${cityData.name}. Discover its iconic landmarks, rich culture, and unforgettable experiences.`,
      photos: [],
      rating: 4.5,
      user_ratings_total: 1000,
      types: ['locality', 'political'],
      vicinity: cityData.name,
      geometry: {
        location: {
          lat: cityData.coordinates[1],
          lng: cityData.coordinates[0]
        }
      },
      city_slug: cityData.slug,
      created_at: new Date().toISOString(),
      landmark_type: 'synthetic_city'
    };
  };

  const handleClick = () => {
    // TODO: Implement simple CTA logic
    console.log('CTA button clicked for', cityData.name);
  };

  return (
    <Button 
      onClick={handleClick}
      variant={variant}
      size={size}
      className={`gap-2 font-bold transition-all duration-300 hover:scale-110 hover:shadow-2xl active:scale-95 
        bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700
        text-white border-2 border-blue-500 hover:border-purple-500
        shadow-xl shadow-blue-500/25 hover:shadow-purple-500/50
        ring-2 ring-blue-400/30 hover:ring-purple-400/50
        transform-gpu backdrop-blur-sm ${className}`}
    >
      <Sparkles className="h-4 w-4" />
      {defaultButtonText}
      <MapPin className="h-4 w-4" />
    </Button>
  );
};