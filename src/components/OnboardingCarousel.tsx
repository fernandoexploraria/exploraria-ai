import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious 
} from '@/components/ui/carousel';
import { 
  Volume2, 
  MapPin, 
  Zap, 
  BookOpen, 
  ArrowRight,
  Play,
  Camera,
  Bell,
  Route,
  X
} from 'lucide-react';
import type { CarouselApi } from '@/components/ui/carousel';
import { PreRenderedVoiceDemo } from '@/components/PreRenderedVoiceDemo';
import SmartTourAnimationDemo from '@/components/SmartTourAnimationDemo';
import LandmarkAnimationDemo from '@/components/LandmarkAnimationDemo';
import LocalExperienceAnimationDemo from '@/components/LocalExperienceAnimationDemo';

interface OnboardingCarouselProps {
  onComplete: () => void;
  onSkip: () => void;
}

const OnboardingCarousel: React.FC<OnboardingCarouselProps> = ({ 
  onComplete, 
  onSkip 
}) => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const [showVoiceDemo, setShowVoiceDemo] = useState(false);
  const [showSmartTourDemo, setShowSmartTourDemo] = useState(false);
  const [showLandmarkDemo, setShowLandmarkDemo] = useState(false);
  const [showLocalExperienceDemo, setShowLocalExperienceDemo] = useState(false);

  React.useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  const handleNext = () => {
    if (current < count) {
      api?.scrollNext();
    } else {
      onComplete();
    }
  };

  const handleVoiceDemo = () => {
    setShowVoiceDemo(true);
  };

  const handleDemoComplete = () => {
    setShowVoiceDemo(false);
  };

  const handleSmartTourDemo = () => {
    setShowSmartTourDemo(true);
  };

  const handleSmartTourDemoComplete = () => {
    setShowSmartTourDemo(false);
  };

  const handleLandmarkDemo = () => {
    setShowLandmarkDemo(true);
  };

  const handleLandmarkDemoComplete = () => {
    setShowLandmarkDemo(false);
  };

  const handleLocalExperienceDemo = () => {
    setShowLocalExperienceDemo(true);
  };

  const handleLocalExperienceDemoComplete = () => {
    setShowLocalExperienceDemo(false);
  };

  return (
    <div className="w-screen h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto bg-card border-border">
        {/* Skip button */}
        <div className="flex justify-end p-4 pb-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Skip
          </Button>
        </div>

        <Carousel setApi={setApi} className="w-full">
          <CarouselContent>
            {/* Slide 1: AI Voice Hook */}
            <CarouselItem>
              {showVoiceDemo ? (
                <div className="p-2">
                  <PreRenderedVoiceDemo onComplete={handleDemoComplete} />
                </div>
              ) : (
                <div className="p-6 text-center space-y-6">
                  <div className="relative">
                    <Volume2 className="w-16 h-16 mx-auto text-primary animate-pulse" />
                    <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full border-2 border-primary animate-ping" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold text-foreground">
                      Your Personal AI Tour Guide
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      Get live commentary and insider tips as you explore - just like having a local expert with you
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      onClick={handleVoiceDemo}
                      className="flex items-center gap-2 w-full"
                    >
                      <Play className="w-4 h-4" />
                      Try Personal AI Tour Guide
                    </Button>
                  </div>
                </div>
              )}
            </CarouselItem>

            {/* Slide 2: Three Tour Types */}
            <CarouselItem>
              {showSmartTourDemo ? (
                <div className="p-2">
                  <SmartTourAnimationDemo onComplete={handleSmartTourDemoComplete} />
                </div>
              ) : showLandmarkDemo ? (
                <div className="p-2">
                  <LandmarkAnimationDemo onComplete={handleLandmarkDemoComplete} />
                </div>
              ) : showLocalExperienceDemo ? (
                <div className="p-2">
                  <LocalExperienceAnimationDemo onComplete={handleLocalExperienceDemoComplete} />
                </div>
              ) : (
                <div className="p-6 text-center space-y-6">
                  <div className="space-y-3">
                    {/* Smart Tour - Featured on top */}
                    <div className="aspect-[2/1] bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                      <img 
                        src="https://images.unsplash.com/photo-1469474968028-56623f02e42d?w=400&h=200&fit=crop&crop=center"
                        alt="Mountain landscape"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20" />
                      <Zap className="w-10 h-10 text-white relative z-10" />
                    </div>
                    
                    {/* 100 Landmarks & Experiences - Bottom row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                        <img 
                          src="https://images.unsplash.com/photo-1472396961693-142e6e269027?w=200&h=200&fit=crop&crop=center"
                          alt="Deer and mountains"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/20" />
                        <MapPin className="w-8 h-8 text-white relative z-10" />
                      </div>
                      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                        <img 
                          src="https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?w=200&h=200&fit=crop&crop=center"
                          alt="Woman with laptop"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/20" />
                        <Camera className="w-8 h-8 text-white relative z-10" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold text-foreground">
                      Three Ways to Explore
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      AI-powered tours, famous landmarks, or local experiences
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={handleSmartTourDemo}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Try Smart Tour (AI-Generated)
                    </Button>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={handleLandmarkDemo}
                      >
                        Top 100 Landmarks
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={handleLocalExperienceDemo}
                      >
                        Local Experiences
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CarouselItem>

            {/* Slide 3: Smart Features */}
            <CarouselItem>
              <div className="p-6 text-center space-y-6">
                <div className="relative">
                  <Zap className="w-16 h-16 mx-auto text-primary" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold text-foreground">
                    Effortless Exploration
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Optimal routes, proximity alerts, and contextual information - all powered by AI
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="text-center">
                    <Route className="w-6 h-6 mx-auto text-primary mb-1" />
                    <div className="font-medium">Efficient</div>
                  </div>
                  <div className="text-center">
                    <Bell className="w-6 h-6 mx-auto text-primary mb-1" />
                    <div className="font-medium">Timely</div>
                  </div>
                  <div className="text-center">
                    <Zap className="w-6 h-6 mx-auto text-primary mb-1" />
                    <div className="font-medium">Smart</div>
                  </div>
                </div>
              </div>
            </CarouselItem>

            {/* Slide 4: Travel Memory */}
            <CarouselItem>
              <div className="p-6 text-center space-y-6">
                <div className="relative">
                  <BookOpen className="w-16 h-16 mx-auto text-primary" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold text-foreground">
                    Remember Every Adventure
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Your Travel Log captures every interaction, photo, and discovery
                  </p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    Join 10,000+ travelers building their adventure stories
                  </div>
                </div>
              </div>
            </CarouselItem>

            {/* Slide 5: Get Started */}
            <CarouselItem>
              <div className="p-6 text-center space-y-6">
                <div className="relative">
                  <ArrowRight className="w-16 h-16 mx-auto text-primary" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold text-foreground">
                    Your Next Adventure Starts Now
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    No credit card required
                  </p>
                </div>
                <div className="space-y-3">
                  <Button 
                    onClick={onComplete}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Explore Free Tours
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={onComplete}
                    className="w-full"
                  >
                    Start with Top 100 Landmarks
                  </Button>
                </div>
              </div>
            </CarouselItem>
          </CarouselContent>
          
          {/* Only show navigation on non-final slides */}
          {current < count && (
            <>
              <CarouselPrevious className="left-4" />
              <CarouselNext className="right-4" />
            </>
          )}
        </Carousel>

        {/* Progress indicators and Next button */}
        <div className="p-4 pt-0">
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              {Array.from({ length: count }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i + 1 === current ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            {current < count && (
              <Button
                onClick={handleNext}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default OnboardingCarousel;