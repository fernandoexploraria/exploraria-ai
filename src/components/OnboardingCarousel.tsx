import React, { useState, useEffect, useRef } from 'react';
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
  X,
  Search,
  User,
  Award
} from 'lucide-react';
import type { CarouselApi } from '@/components/ui/carousel';
import { PreRenderedVoiceDemo } from '@/components/PreRenderedVoiceDemo';
import SmartTourAnimationDemo from '@/components/SmartTourAnimationDemo';
import LandmarkAnimationDemo from '@/components/LandmarkAnimationDemo';
import LocalExperienceAnimationDemo from '@/components/LocalExperienceAnimationDemo';
import TravelMemoryAnimationDemo from '@/components/TravelMemoryAnimationDemo';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';

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
  const [showTravelMemoryDemo, setShowTravelMemoryDemo] = useState(false);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapboxToken = useMapboxToken();
  
  // Times Square coordinates from LandmarkAnimationDemo
  const timesSquareCoords: [number, number] = [-73.9855426, 40.7579747];

  // Initialize mini Mapbox map for landmarks preview
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: timesSquareCoords,
      zoom: 15,
      interactive: false
    });

    // Add marker for Times Square
    new mapboxgl.Marker({ color: '#ef4444' })
      .setLngLat(timesSquareCoords)
      .addTo(map.current);

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

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

  const handleTravelMemoryDemo = () => {
    setShowTravelMemoryDemo(true);
  };

  const handleTravelMemoryDemoComplete = () => {
    setShowTravelMemoryDemo(false);
  };

  return (
    <div className="flex items-center justify-center p-2 sm:p-4 min-h-screen">
      <Card className="w-full max-w-sm sm:max-w-md mx-auto bg-card/95 backdrop-blur-sm border-border max-h-[90vh] lg:max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header with title and skip button */}
        <div className="flex justify-between items-center p-3 sm:p-4 pb-2 flex-shrink-0">
          <h1 className="text-lg sm:text-xl font-bold text-foreground">Discover Exploraria</h1>
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

        <Carousel setApi={setApi} className="w-full flex-1 flex flex-col min-h-0">
          <CarouselContent className="flex-1 min-h-0">
            {/* Slide 1: AI Voice Hook */}
            <CarouselItem>
              {showVoiceDemo ? (
                <div className="p-2">
                  <PreRenderedVoiceDemo onComplete={handleDemoComplete} />
                </div>
               ) : (
                <div className="p-4 sm:p-6 text-center space-y-4 sm:space-y-6 overflow-y-auto">
                  <div className="relative">
                    <Volume2 className="w-16 h-16 mx-auto text-primary animate-pulse" />
                    <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full border-2 border-primary animate-ping" />
                  </div>
                   <div className="space-y-2 sm:space-y-3">
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                      Your Personal AI Tour Guide
                    </h2>
                    <p className="text-muted-foreground text-sm sm:text-base">
                      Get live commentary and insider tips as you explore - just like having a local expert with you
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      onClick={handleVoiceDemo}
                      className="flex items-center gap-2 w-full h-12 text-base"
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
                <div className="p-4 lg:p-6 text-center space-y-4 lg:space-y-6 overflow-y-auto">
                  <div className="space-y-3">
                    {/* Smart Tour - Featured on top */}
                    <div className="aspect-[2/1] bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg flex flex-col items-center justify-center relative overflow-hidden p-4">
                      <div className="relative mb-2">
                        <Search className="w-8 h-8 text-primary animate-pulse" />
                        <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-primary animate-ping" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">Choose Your Destination</h4>
                      <div className="bg-background/80 rounded-md px-2 py-1 mt-1 animate-scale-in">
                        <div className="flex items-center gap-1 text-xs">
                          <MapPin className="w-3 h-3 text-primary" />
                          <span className="text-foreground">Paris, France</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* 100 Landmarks & Experiences - Bottom row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                        <div ref={mapContainer} className="w-full h-full" />
                        <div className="absolute bottom-1 left-1 text-xs text-white bg-black/50 px-1 py-0.5 rounded text-center">
                          Tap any landmark
                        </div>
                      </div>
                      <div className="aspect-square bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg flex flex-col items-center justify-center relative overflow-hidden p-3">
                        {/* Expert Avatar */}
                        <div className="relative mb-2">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-primary" />
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                            <Award className="w-3 h-3 text-white" />
                          </div>
                        </div>
                        
                        {/* Expert Info */}
                        <div className="text-center">
                          <h4 className="text-xs font-semibold text-foreground">Travel Expert</h4>
                          <p className="text-xs text-muted-foreground">Mexico City Guide</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 lg:space-y-3">
                    <h2 className="text-xl lg:text-2xl font-bold text-foreground">
                      Three Ways to Explore
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      AI-powered tours, famous landmarks, or local experiences
                    </p>
                  </div>
                  
                  <div className="space-y-2 lg:space-y-3 min-h-[120px] lg:min-h-[140px] flex flex-col">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full h-10 lg:h-12"
                      onClick={handleSmartTourDemo}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Try Smart Tour (AI-Generated)
                    </Button>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 h-10 lg:h-12 text-xs lg:text-sm"
                        onClick={handleLandmarkDemo}
                      >
                        Top 100 Landmarks
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 h-10 lg:h-12 text-xs lg:text-sm"
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
                    Optimal routes, proximity alerts, contextual information, and image recognition - all powered by AI
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
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
                  <div className="text-center">
                    <Camera className="w-6 h-6 mx-auto text-primary mb-1" />
                    <div className="font-medium">Visual</div>
                  </div>
                </div>
              </div>
            </CarouselItem>

            {/* Slide 4: Travel Memory */}
            <CarouselItem>
              {showTravelMemoryDemo ? (
                <div className="p-2">
                  <TravelMemoryAnimationDemo onComplete={handleTravelMemoryDemoComplete} />
                </div>
              ) : (
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
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      onClick={handleTravelMemoryDemo}
                      className="flex items-center gap-2 w-full"
                    >
                      <Camera className="w-4 h-4" />
                      Try Travel Memory Demo
                    </Button>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-2 h-2 bg-primary rounded-full" />
                      Join 10,000+ travelers building their adventure stories
                    </div>
                  </div>
                </div>
              )}
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