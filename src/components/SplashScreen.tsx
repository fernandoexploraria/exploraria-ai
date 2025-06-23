
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SplashScreenProps {
  onDismiss: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');

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
        console.log('Splash background image loaded successfully');
      };
      img.onerror = () => {
        console.warn('Failed to load splash background image, using gradient fallback');
        setImageLoaded(false);
      };
      img.src = data.publicUrl;
    }

    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      handleDismiss();
    }, 5000);

    // Dismiss on any user interaction
    const handleUserInteraction = () => {
      handleDismiss();
    };

    // Add event listeners for user interactions
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss();
    }, 300); // Wait for fade out animation
  };

  if (!isVisible) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center animate-fade-out pointer-events-none bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900"
        style={{
          backgroundImage: imageLoaded && imageUrl ? `url("${imageUrl}")` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm"></div>
        <div className="relative text-center animate-scale-out z-10">
          <img 
            src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" 
            alt="Exploraria Logo" 
            className="h-24 w-auto mx-auto mb-6 bg-yellow-400 rounded-2xl p-2"
          />
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
            Explore the world like never before
          </h1>
          <div className="w-16 h-1 bg-yellow-400 mx-auto rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900"
      style={{
        backgroundImage: imageLoaded && imageUrl ? `url("${imageUrl}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm"></div>
      <div className="relative text-center animate-scale-in z-10">
        <img 
          src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" 
          alt="Exploraria Logo" 
          className="h-24 w-auto mx-auto mb-6 bg-yellow-400 rounded-2xl p-2"
        />
        <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
          Explore the world like never before
        </h1>
        <div className="w-16 h-1 bg-yellow-400 mx-auto rounded-full"></div>
        <p className="text-sm text-muted-foreground mt-6 opacity-60">
          Tap anywhere to continue
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
