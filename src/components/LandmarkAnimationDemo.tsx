import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  MapPin, 
  Camera, 
  Clock, 
  Star,
  ArrowLeft,
  Loader2
} from 'lucide-react';

interface LandmarkAnimationDemoProps {
  onComplete: () => void;
}

const LandmarkAnimationDemo: React.FC<LandmarkAnimationDemoProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timeouts = [
      setTimeout(() => setStep(1), 1000),   // Click marker
      setTimeout(() => setStep(2), 2500),   // Loading landmark info
      setTimeout(() => setStep(3), 4000),   // Show landmark details
    ];

    return () => timeouts.forEach(timeout => clearTimeout(timeout));
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onComplete}
          className="text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h3 className="text-sm font-medium">100 Landmarks Demo</h3>
        <div className="w-16" />
      </div>

      {/* Animation Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
        {/* Step 1: Map with markers */}
        {step >= 0 && (
          <div className="relative w-full max-w-sm h-48 bg-muted rounded-lg flex items-center justify-center border border-border">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg opacity-50" />
            
            {/* Map markers */}
            <div className="relative w-full h-full">
              <MapPin 
                className={`absolute top-8 left-12 w-6 h-6 text-primary transition-all duration-500 ${
                  step >= 1 ? 'scale-125 text-red-500' : 'text-primary'
                } ${step >= 1 ? 'animate-pulse' : ''}`} 
              />
              <MapPin className="absolute top-16 right-16 w-5 h-5 text-muted-foreground" />
              <MapPin className="absolute bottom-12 left-20 w-5 h-5 text-muted-foreground" />
              <MapPin className="absolute bottom-8 right-12 w-5 h-5 text-muted-foreground" />
              
              {/* Click indicator */}
              {step >= 1 && (
                <div className="absolute top-6 left-10 w-8 h-8 border-2 border-red-500 rounded-full animate-ping" />
              )}
            </div>
            
            <div className="absolute bottom-2 left-2 text-xs text-muted-foreground">
              {step === 0 && "Tap any landmark marker"}
              {step >= 1 && "Loading landmark..."}
            </div>
          </div>
        )}

        {/* Step 2: Loading */}
        {step >= 2 && step < 3 && (
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Gathering landmark information...</p>
          </div>
        )}

        {/* Step 3: Landmark details */}
        {step >= 3 && (
          <Card className="w-full max-w-sm p-4 space-y-3 animate-fade-in">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground">Eiffel Tower</h4>
                <p className="text-xs text-muted-foreground">Paris, France</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <div className="aspect-square bg-muted rounded-md flex items-center justify-center">
                <Camera className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="aspect-square bg-muted rounded-md flex items-center justify-center">
                <Camera className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="aspect-square bg-muted rounded-md flex items-center justify-center">
                <Camera className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1">
                <Star className="w-3 h-3 text-yellow-500 fill-current" />
                <span className="text-muted-foreground">4.7 • Historic</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">2h visit</span>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Iconic iron lattice tower built in 1889, offering panoramic views of Paris from its observation decks.
            </p>
          </Card>
        )}

        {/* Progress text */}
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-foreground">
            {step === 0 && "Explore 100 Famous Landmarks"}
            {step === 1 && "Instant Access"}
            {step === 2 && "Rich Information"}
            {step >= 3 && "Complete Landmark Guide"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {step === 0 && "Tap any landmark to learn more"}
            {step === 1 && "Get detailed information instantly"}
            {step === 2 && "Photos, history, and visiting tips"}
            {step >= 3 && "Everything you need to plan your visit"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandmarkAnimationDemo;