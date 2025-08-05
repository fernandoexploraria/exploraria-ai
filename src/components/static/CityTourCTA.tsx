import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Sparkles } from 'lucide-react';
import { CityData } from '@/utils/cityExtraction';
import { useAuth } from '@/components/AuthProvider';
import { setPostAuthAction, setPostAuthLandmark } from '@/utils/authActions';

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

  // Transform city data to landmark-compatible structure
  const createLandmarkFromCity = (cityData: CityData) => {
    return {
      id: `city-${cityData.slug}`,
      name: cityData.name,
      coordinates: cityData.coordinates,
      place_id: `city-${cityData.slug}`,
      description: `Explore the vibrant city of ${cityData.name}`,
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
      }
    };
  };

  const handleNavigationButtonClick = useCallback(() => {
    const landmark = createLandmarkFromCity(cityData);
    console.log('🎯 Navigation button clicked for landmark:', landmark.name);
    
    if (user) {
      // User is authenticated - proceed with existing flow
      console.log('✅ User authenticated, opening intelligent tour directly');
      onIntelligentTourOpen?.(landmark);
    } else {
      // User not authenticated - persist landmark and trigger auth
      console.log('🚨 User not authenticated, persisting landmark and triggering auth');
      setPostAuthLandmark(landmark);
      setPostAuthAction('intelligent-tour');
      
      // Trigger auth dialog via parent component
      if (onAuthDialogOpen) {
        onAuthDialogOpen();
      } else {
        console.warn('⚠️ onAuthDialogOpen not provided to Map component');
      }
    }
  }, [user, onIntelligentTourOpen, onAuthDialogOpen, cityData]);

  const defaultButtonText = buttonText || `Generate Your ${cityData.name} Tour Now!`;

  return (
    <Button 
      onClick={handleNavigationButtonClick}
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