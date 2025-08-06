import React from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Sparkles } from 'lucide-react';
import { CityData, formatCityForTourGeneration } from '@/utils/cityExtraction';
import { toast } from 'sonner';

interface CityTourCTAProps {
  cityData: CityData;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  buttonText?: string;
}

export const CityTourCTA: React.FC<CityTourCTAProps> = ({
  cityData,
  variant = 'default',
  size = 'default',
  className = '',
  buttonText
}) => {
  const handleGenerateTour = async () => {
    try {
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

      // Format city data for existing tour generation system
      const tourDestination = formatCityForTourGeneration(cityData);
      
      // Use the existing tour generation mechanism
      // This will trigger the same flow as the landmark preview button
      const event = new CustomEvent('generateTour', {
        detail: {
          destination: tourDestination.name,
          coordinates: tourDestination.coordinates,
          place_id: tourDestination.place_id,
          source: 'static_page'
        }
      });
      
      window.dispatchEvent(event);
      
      // Show user feedback
      toast.success(`Starting your ${cityData.name} tour generation!`, {
        description: "You'll be guided through our AI tour creation process."
      });

    } catch (error) {
      console.error('Error triggering tour generation:', error);
      toast.error("Something went wrong. Please try again.");
    }
  };

  const defaultButtonText = buttonText || `Generate Your ${cityData.name} Tour Now!`;

  return (
    <Button 
      onClick={handleGenerateTour}
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