
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface SplashScreenProps {
  onDismiss: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // Get the public URL for the splash background image
    const { data } = supabase.storage
      .from('static-assets')
      .getPublicUrl('splash-bg.jpg');
    
    if (data?.publicUrl) {
      setImageUrl(data.publicUrl);
      
      // Preload the background image
      const img = new Image();
      img.onload = () => {
        setImageLoaded(true);
        setImageError(false);
        console.log('Splash background image loaded successfully from Supabase Storage');
      };
      img.onerror = () => {
        console.warn('Failed to load splash background image from Supabase Storage, using gradient fallback');
        setImageLoaded(false);
        setImageError(true);
      };
      img.src = data.publicUrl;
    } else {
      console.warn('Could not get public URL for splash background image');
      setImageError(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss();
    }, 300); // Wait for fade out animation
  };

  // Build the complete background style - always include gradient, optionally layer image on top
  const getBackgroundStyle = () => {
    const baseStyle = {
      background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #3730a3 100%)'
    };

    if (imageLoaded && imageUrl && !imageError) {
      return {
        ...baseStyle,
        backgroundImage: `url("${imageUrl}"), linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #3730a3 100%)`,
        backgroundSize: 'cover, cover',
        backgroundPosition: 'center, center',
        backgroundRepeat: 'no-repeat, no-repeat'
      };
    }

    return baseStyle;
  };

  if (!isVisible) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center animate-fade-out pointer-events-none"
        style={getBackgroundStyle()}
      >
        <div className="relative text-center animate-scale-out z-10">
          <img 
            src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" 
            alt="Exploraria Logo" 
            className="h-24 w-auto mx-auto mb-6 bg-yellow-400 rounded-2xl p-2"
          />
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Explore the world like never before
          </h1>
          <div className="w-16 h-1 bg-yellow-400 mx-auto rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={getBackgroundStyle()}
    >
      <div className="relative text-center animate-scale-in z-10">
        <img 
          src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" 
          alt="Exploraria Logo" 
          className="h-24 w-auto mx-auto mb-6 bg-yellow-400 rounded-2xl p-2"
        />
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
          Explore the world like never before
        </h1>
        <div className="w-16 h-1 bg-yellow-400 mx-auto rounded-full mb-8"></div>
        <Button 
          onClick={handleDismiss}
          className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold px-8 py-3 text-lg"
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

export default SplashScreen;
