import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  MapPin, 
  Zap, 
  Bot, 
  ArrowRight, 
  Search,
  Sparkles,
  Navigation,
  X
} from 'lucide-react';

interface SmartTourAnimationDemoProps {
  onComplete: () => void;
}

type AnimationStep = 'destination' | 'generating' | 'agent' | 'map' | 'complete';

const SmartTourAnimationDemo: React.FC<SmartTourAnimationDemoProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState<AnimationStep>('destination');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const sequence = [
      { step: 'destination' as AnimationStep, duration: 2000 },
      { step: 'generating' as AnimationStep, duration: 3000 },
      { step: 'agent' as AnimationStep, duration: 2500 },
      { step: 'map' as AnimationStep, duration: 3000 },
      { step: 'complete' as AnimationStep, duration: 0 }
    ];

    let currentIndex = 0;
    
    const runSequence = () => {
      if (currentIndex < sequence.length) {
        const { step, duration } = sequence[currentIndex];
        setCurrentStep(step);
        
        if (step === 'generating') {
          setIsGenerating(true);
        }
        
        if (duration > 0) {
          setTimeout(() => {
            currentIndex++;
            runSequence();
          }, duration);
        }
      }
    };

    runSequence();
  }, []);

  const renderDestinationStep = () => (
    <div className="relative text-center space-y-4 animate-fade-in">
      {/* Background Image */}
      <div className="absolute inset-0 rounded-lg overflow-hidden opacity-20">
        <img 
          src="https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800&auto=format&fit=crop&q=60"
          alt="Travel background"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="relative z-10">
        <div className="relative">
          <Search className="w-16 h-16 mx-auto text-primary animate-pulse" />
          <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full border-2 border-primary animate-ping" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Choose Your Destination</h3>
        <div className="bg-muted rounded-lg p-3 animate-scale-in">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-foreground">Paris, France</span>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">Tell us where you want to explore...</p>
      </div>
    </div>
  );

  const renderGeneratingStep = () => (
    <div className="text-center space-y-4 animate-fade-in">
      <div className="relative">
        <Zap className="w-16 h-16 mx-auto text-primary animate-pulse" />
        <div className="absolute inset-0 w-16 h-16 mx-auto">
          <Sparkles className="w-6 h-6 text-yellow-400 absolute top-2 right-2 animate-ping" />
          <Sparkles className="w-4 h-4 text-blue-400 absolute bottom-3 left-3 animate-ping delay-300" />
          <Sparkles className="w-5 h-5 text-purple-400 absolute top-3 left-2 animate-ping delay-600" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-foreground">AI Generating Your Tour</h3>
      <div className="space-y-2">
        <div className="bg-muted rounded-lg p-2 animate-scale-in">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Analyzing your destination...</span>
          </div>
        </div>
        <div className="bg-muted rounded-lg p-2 animate-scale-in delay-300">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span>Finding best landmarks...</span>
          </div>
        </div>
        <div className="bg-muted rounded-lg p-2 animate-scale-in delay-500">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            <span>Creating optimal route...</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAgentStep = () => (
    <div className="text-center space-y-4 animate-fade-in">
      <div className="relative">
        <Bot className="w-16 h-16 mx-auto text-primary animate-pulse" />
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full animate-ping" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-foreground">Your AI Guide is Ready</h3>
      <div className="bg-muted rounded-lg p-3 animate-scale-in">
        <div className="text-sm text-foreground">
          "Hi! I'm your personal tour guide for Paris. I've prepared an amazing route with 8 landmarks just for you!"
        </div>
      </div>
      <p className="text-muted-foreground text-sm">Ready to provide live commentary and tips</p>
    </div>
  );

  const renderMapStep = () => (
    <div className="text-center space-y-4 animate-fade-in">
      <div className="relative">
        <Navigation className="w-16 h-16 mx-auto text-primary animate-pulse" />
      </div>
      <h3 className="text-xl font-bold text-foreground">Flying to Your Tour</h3>
      <div className="grid grid-cols-2 gap-2">
        {['Eiffel Tower', 'Louvre Museum', 'Notre Dame', 'Arc de Triomphe'].map((landmark, index) => (
          <div 
            key={landmark} 
            className={`bg-muted rounded-lg p-2 text-xs animate-scale-in`}
            style={{ animationDelay: `${index * 200}ms` }}
          >
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-primary" />
              <span>{landmark}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-sm">Your personalized tour is ready!</p>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="text-center space-y-4 animate-fade-in">
      <div className="relative">
        <div className="w-16 h-16 mx-auto bg-green-500 rounded-full flex items-center justify-center">
          <ArrowRight className="w-8 h-8 text-white" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-foreground">Smart Tour Created!</h3>
      <p className="text-muted-foreground text-sm">
        Your AI-powered tour is ready with personalized routes, live commentary, and insider tips
      </p>
      <Button 
        onClick={onComplete}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        Continue Onboarding
      </Button>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'destination':
        return renderDestinationStep();
      case 'generating':
        return renderGeneratingStep();
      case 'agent':
        return renderAgentStep();
      case 'map':
        return renderMapStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return renderDestinationStep();
    }
  };

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex justify-end mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onComplete}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="min-h-[300px] flex flex-col justify-center">
        {renderCurrentStep()}
      </div>
      
      {/* Progress indicator */}
      <div className="flex justify-center space-x-2 mt-6">
        {['destination', 'generating', 'agent', 'map'].map((step, index) => (
          <div
            key={step}
            className={`w-2 h-2 rounded-full transition-colors ${
              currentStep === step ? 'bg-primary' : 
              ['destination', 'generating', 'agent', 'map'].indexOf(currentStep) > index ? 'bg-primary/50' : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </Card>
  );
};

export default SmartTourAnimationDemo;