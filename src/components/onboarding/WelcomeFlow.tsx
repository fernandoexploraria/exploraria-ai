import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Search, Heart, Mic } from 'lucide-react';
import { Button } from '../ui/button';
import { useOnboarding } from '../../contexts/OnboardingContext';

interface WelcomeFlowProps {
  onComplete: () => void;
}

const welcomeSteps = [
  {
    id: 'welcome',
    title: 'Welcome to Exploraria!',
    description: 'Discover authentic travel experiences through the eyes of local experts.',
    icon: MapPin,
    visual: (
      <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center">
        <MapPin className="h-16 w-16 text-primary" />
      </div>
    )
  },
  {
    id: 'search',
    title: 'Find Your Perfect Destination',
    description: 'Search for any city or let us show you tours near your current location.',
    icon: Search,
    visual: (
      <div className="w-full max-w-sm mx-auto p-4 bg-muted/20 rounded-lg">
        <div className="flex items-center gap-3 p-3 bg-background rounded-md border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Try: Rome food tours</span>
        </div>
      </div>
    )
  },
  {
    id: 'explore',
    title: 'Explore Rich Experiences',
    description: 'Every tour features stunning photos, virtual previews, and detailed insights from local guides.',
    icon: Heart,
    visual: (
      <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
        <div className="aspect-square bg-gradient-to-br from-blue-200 to-blue-300 rounded-lg"></div>
        <div className="aspect-square bg-gradient-to-br from-green-200 to-green-300 rounded-lg"></div>
        <div className="aspect-square bg-gradient-to-br from-orange-200 to-orange-300 rounded-lg"></div>
        <div className="aspect-square bg-gradient-to-br from-purple-200 to-purple-300 rounded-lg"></div>
      </div>
    )
  },
  {
    id: 'ai',
    title: 'Meet Your AI Guide',
    description: 'Ask questions, get personalized recommendations, and let our AI enhance your journey.',
    icon: Mic,
    visual: (
      <div className="flex items-center justify-center space-x-2">
        <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
        <div className="w-3 h-3 bg-primary/70 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-3 h-3 bg-primary/40 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
      </div>
    )
  }
];

export const WelcomeFlow: React.FC<WelcomeFlowProps> = ({ onComplete }) => {
  const { shouldShowFeature, dismissHint, completeFeature } = useOnboarding();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const shouldShow = shouldShowFeature('welcome_flow');

  useEffect(() => {
    if (shouldShow) {
      // Small delay for smooth appearance
      const timer = setTimeout(() => setIsVisible(true), 300);
      return () => clearTimeout(timer);
    }
  }, [shouldShow]);

  const handleNext = () => {
    if (currentStep < welcomeSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    dismissHint('welcome_flow');
    setIsVisible(false);
    onComplete();
  };

  const handleComplete = () => {
    completeFeature('welcome_flow');
    setIsVisible(false);
    onComplete();
  };

  if (!shouldShow || !isVisible) {
    return null;
  }

  const currentStepData = welcomeSteps[currentStep];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in" />
      
      {/* Welcome Flow Modal */}
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full z-50">
        <div className="bg-background rounded-xl shadow-2xl p-6 animate-scale-in">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex space-x-2">
              {welcomeSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-8 rounded-full transition-colors ${
                    index === currentStep
                      ? 'bg-primary'
                      : index < currentStep
                      ? 'bg-primary/50'
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={handleSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip
            </button>
          </div>

          {/* Content */}
          <div className="text-center mb-8">
            {/* Visual */}
            <div className="mb-6">
              {currentStepData.visual}
            </div>
            
            {/* Text */}
            <h2 className="text-2xl font-bold text-foreground mb-3">
              {currentStepData.title}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {currentStepData.description}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <span className="text-sm text-muted-foreground">
              {currentStep + 1} of {welcomeSteps.length}
            </span>

            <Button
              onClick={handleNext}
              size="sm"
              className="flex items-center gap-2"
            >
              {currentStep === welcomeSteps.length - 1 ? 'Get Started' : 'Next'}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};