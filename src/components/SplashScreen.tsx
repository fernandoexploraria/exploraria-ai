import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onDismiss: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Set flag that splash has been seen
    localStorage.setItem('splash-seen', 'true');

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
        className="fixed inset-0 z-50 flex items-center justify-center animate-fade-out pointer-events-none"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80")',
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
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{
        backgroundImage: 'url("https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80")',
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
