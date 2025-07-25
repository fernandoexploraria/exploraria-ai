import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, ArrowLeft, ArrowRight, Loader2, Heart, Share, Instagram, MapPin, Clock, Star, BookOpen, User } from 'lucide-react';
interface TravelMemoryAnimationDemoProps {
  onComplete: () => void;
}
type AnimationStep = 'photo' | 'analyzing' | 'travelLog' | 'favorite' | 'share' | 'instagram' | 'complete';
const TravelMemoryAnimationDemo: React.FC<TravelMemoryAnimationDemoProps> = ({
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState<AnimationStep>('photo');
  const [isFavorited, setIsFavorited] = useState(false);

  // Museum of Modern Art data
  const museumPhoto = "https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=400&h=300&fit=crop&crop=center";
  const museumData = {
    name: "Museum of Modern Art",
    location: "New York, NY",
    rating: 4.6,
    description: "World-renowned museum featuring contemporary and modern art masterpieces from Van Gogh to Picasso.",
    hours: "10:30 AM - 5:30 PM",
    category: "Art Museum"
  };
  useEffect(() => {
    const sequence = [{
      step: 'photo' as AnimationStep,
      duration: 2500
    }, {
      step: 'analyzing' as AnimationStep,
      duration: 3000
    }, {
      step: 'travelLog' as AnimationStep,
      duration: 2500
    }, {
      step: 'favorite' as AnimationStep,
      duration: 2000
    }, {
      step: 'share' as AnimationStep,
      duration: 2500
    }, {
      step: 'instagram' as AnimationStep,
      duration: 3500
    }, {
      step: 'complete' as AnimationStep,
      duration: 0
    }];
    let currentIndex = 0;
    const runSequence = () => {
      if (currentIndex < sequence.length) {
        const {
          step,
          duration
        } = sequence[currentIndex];
        setCurrentStep(step);
        if (step === 'favorite') {
          setTimeout(() => setIsFavorited(true), 500);
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
  const renderPhotoStep = () => <div className="text-center space-y-4 animate-fade-in">
      <div className="relative mx-auto w-48 h-36 bg-muted rounded-lg overflow-hidden">
        <img src={museumPhoto} alt="Museum of Modern Art" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center animate-pulse">
            <Camera className="w-6 h-6 text-primary" />
          </div>
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground">Capture & Recognize</h3>
      <p className="text-sm text-muted-foreground">Take a photo and let AI identify landmarks</p>
    </div>;
  const renderAnalyzingStep = () => <div className="text-center space-y-4 animate-fade-in">
      <div className="relative mx-auto w-48 h-36 bg-muted rounded-lg overflow-hidden">
        <img src={museumPhoto} alt="Museum of Modern Art" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground">AI Recognition</h3>
      <div className="space-y-2">
        <div className="bg-muted rounded-lg p-2 text-xs animate-scale-in">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span>Analyzing image features...</span>
          </div>
        </div>
        <div className="bg-muted rounded-lg p-2 text-xs animate-scale-in delay-300">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Identifying landmark...</span>
          </div>
        </div>
      </div>
    </div>;
  const renderTravelLogStep = () => <div className="space-y-4 animate-fade-in">
      <h3 className="text-lg font-semibold text-foreground text-center">Travel Log</h3>
      <Card className="p-4 space-y-3 animate-scale-in">
        <div className="flex items-start space-x-3">
          <img src={museumPhoto} alt="Museum of Modern Art" className="w-16 h-12 rounded-md object-cover" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">{museumData.name}</h4>
              <Heart className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span>{museumData.location}</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
              <Star className="w-3 h-3 text-yellow-500 fill-current" />
              <span>{museumData.rating}</span>
              <Clock className="w-3 h-3 ml-2" />
              <span>{museumData.hours}</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{museumData.description}</p>
      </Card>
    </div>;
  const renderFavoriteStep = () => <div className="space-y-4 animate-fade-in">
      <h3 className="text-lg font-semibold text-foreground text-center">Added to Favorites</h3>
      <Card className="p-4 space-y-3">
        <div className="flex items-start space-x-3">
          <img src={museumPhoto} alt="Museum of Modern Art" className="w-16 h-12 rounded-md object-cover" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">{museumData.name}</h4>
              <Heart className={`w-4 h-4 transition-colors ${isFavorited ? 'text-red-500 fill-current animate-pulse' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span>{museumData.location}</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
              <Star className="w-3 h-3 text-yellow-500 fill-current" />
              <span>{museumData.rating}</span>
              <Clock className="w-3 h-3 ml-2" />
              <span>{museumData.hours}</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{museumData.description}</p>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="text-xs">
            <Share className="w-3 h-3 mr-1" />
            Share
          </Button>
        </div>
      </Card>
    </div>;
  const renderShareStep = () => <div className="space-y-4 animate-fade-in">
      <h3 className="text-lg font-semibold text-foreground text-center">Share Experience</h3>
      <Card className="p-4 space-y-3">
        <div className="flex items-start space-x-3">
          <img src={museumPhoto} alt="Museum of Modern Art" className="w-16 h-12 rounded-md object-cover" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">{museumData.name}</h4>
              <Heart className="w-4 h-4 text-red-500 fill-current" />
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span>{museumData.location}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" className="text-xs animate-pulse">
            <Share className="w-3 h-3 mr-1" />
            Share
          </Button>
        </div>
      </Card>
      <div className="text-center">
        <div className="inline-flex items-center space-x-2 text-xs text-muted-foreground">
          <Instagram className="w-4 h-4" />
          <span>Sharing to Instagram...</span>
        </div>
      </div>
    </div>;
  const renderInstagramStep = () => <div className="space-y-4 animate-fade-in">
      <h3 className="text-lg font-semibold text-foreground text-center">Instagram Post</h3>
      <Card className="p-4 space-y-3 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-medium">your_username</div>
            <div className="text-xs text-muted-foreground">New York, NY</div>
          </div>
        </div>
        
        <img src={museumPhoto} alt="Museum of Modern Art" className="w-full h-32 rounded-md object-cover" />
        
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Heart className="w-5 h-5 text-red-500" />
            <Share className="w-5 h-5 text-muted-foreground" />
            <BookOpen className="w-5 h-5 text-muted-foreground" />
          </div>
          
          <div className="text-xs">
            <span className="font-medium">your_username</span> Look what I found using 
            <span className="text-blue-600 font-medium"> #Exploraria</span>! 🎨 
            <br />
            <br />
            Just discovered the incredible Museum of Modern Art in NYC. The AI guide provided amazing insights about contemporary masterpieces and hidden gems. This place is a true cultural treasure! 
            <span className="text-blue-600"> #MoMA #NYC #ArtLovers #TravelMemories</span>
          </div>
        </div>
      </Card>
    </div>;
  const renderCompleteStep = () => <div className="flex flex-col items-center justify-center space-y-6 text-center animate-fade-in">
      <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
        <ArrowRight className="w-8 h-8 text-white" />
      </div>
      
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Travel Log Updated!</h2>
        <p className="text-muted-foreground max-w-xs">
          Your experience is saved, favorited, and shared with your travel community
        </p>
      </div>
      
      <Button onClick={onComplete} className="w-full max-w-xs bg-background text-foreground border border-border hover:bg-muted" size="lg">
        Continue Onboarding
      </Button>
    </div>;
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'photo':
        return renderPhotoStep();
      case 'analyzing':
        return renderAnalyzingStep();
      case 'travelLog':
        return renderTravelLogStep();
      case 'favorite':
        return renderFavoriteStep();
      case 'share':
        return renderShareStep();
      case 'instagram':
        return renderInstagramStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return renderPhotoStep();
    }
  };
  return <div className="w-full h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Button variant="ghost" size="sm" onClick={onComplete} className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h3 className="text-sm font-medium">Travel Log Demo</h3>
        <div className="w-16" />
      </div>

      {/* Animation Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {renderCurrentStep()}
      </div>
    </div>;
};
export default TravelMemoryAnimationDemo;