import React from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Sparkles } from 'lucide-react';
import { CityData } from '@/utils/cityExtraction';
import { useAuth } from '@/components/AuthProvider';

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

  const handleNavigationButtonClick = () => {
    console.log('🎯 Navigation button clicked for city:', cityData.name);
    
    // Track static page conversion
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'static_page_tour_generation', {
        event_category: 'conversion',
        event_label: cityData.name,
        city: cityData.name,
        source: 'city_landing_page',
        cta_type: 'generate_tour_now'
      });
    }

    const cityAsLandmark = createLandmarkFromCity(cityData);

    if (user) {
      // User authenticated - direct call to prop (same as SVG navigation button)
      console.log('✅ User authenticated, opening intelligent tour directly');
      onIntelligentTourOpen?.(cityAsLandmark);
    } else {
      // User not authenticated - persist landmark and trigger auth (same as SVG navigation button)
      console.log('🚨 User not authenticated, persisting landmark and triggering auth');
      
      // Store the city as landmark data for post-auth processing
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('pendingTourLandmark', JSON.stringify(cityAsLandmark));
        window.sessionStorage.setItem('pendingTourSource', 'static_page');
      }
      
      // Direct call to auth dialog (same as SVG navigation button)
      onAuthDialogOpen?.();
    }
  };

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