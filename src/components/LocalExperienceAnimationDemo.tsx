import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  MapPin, 
  Camera, 
  Clock, 
  Star,
  ArrowLeft,
  Loader2,
  CheckCircle,
  ArrowRight,
  User,
  Award,
  BookOpen
} from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';

interface LocalExperienceAnimationDemoProps {
  onComplete: () => void;
}

const LocalExperienceAnimationDemo: React.FC<LocalExperienceAnimationDemoProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapboxToken = useMapboxToken();

  // Real Kahlo Museum data from database
  const fridaKahloCoords: [number, number] = [-99.1624636, 19.3551806];
  const fridaKahloPhotos = [
    "https://places.googleapis.com/v1/places/ChIJOz-6AMT_0YURofTM9_ekAWI/photos/ATKogpd5cSAgIcXVDI4c9e4nmmdz3HYr67Q6UOxfTwcqW0vfTL1a-m5ogNwByc6WEkYQKRryWPXDjHkVq9YK2h7N_C_gfXf6Wn5Gzf4-IpzSCqNCI50kGMnrXUWlEtL3CFaJaCuPlRK_O5ihALKVKb1_3ajUDAvqwihlN9cCJZAHqUX_lglt8XIo-ErJHE3A4QOFsMdqMqWOAHTlvepov9YQqexE0NR60e4_1uYdfEgpuqKxbdO-bb7Oaweaysi04ezAlVc-BHT-3EP5OteXW7ACHgmDo9MSlB7HdQm4wviCB9CTi9zSdNL6MmfKrJQFS5LxjxepJfNOZJjuJt5YoDy5-VQ5ZTBCD84xzvZ95tqLVlSS05bLDIJnZbTkkli2yIXUhjbb-fU7xBH3DlXFLI1eGfu0kfjiCO6XQ49j4jG9JyAsxA/media?maxWidthPx=400&key=AIzaSyDwlzmac-ghW1kTlfJiEEoApG3XhyI0rZg"
  ];

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || step < 1) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: fridaKahloCoords,
      zoom: 15,
      interactive: false
    });

    // Add marker for Frida Kahlo Museum
    new mapboxgl.Marker({ color: '#ef4444' })
      .setLngLat(fridaKahloCoords)
      .addTo(map.current);

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, step]);

  useEffect(() => {
    const timeouts = [
      setTimeout(() => setStep(1), 2500),   // Show expert curation, then map
      setTimeout(() => setStep(2), 4000),   // Click marker
      setTimeout(() => setStep(3), 5500),   // Loading landmark info
      setTimeout(() => setStep(4), 7000),   // Show landmark details
      setTimeout(() => setStep(5), 9500),   // Show completion screen
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
        <h3 className="text-sm font-medium">Local Experience Demo</h3>
        <div className="w-16" />
      </div>

      {/* Animation Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
        {/* Step 5: Completion Screen */}
        {step >= 5 ? (
          <div className="flex flex-col items-center justify-center space-y-6 text-center animate-fade-in">
            {/* Success Icon */}
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
              <ArrowRight className="w-8 h-8 text-white" />
            </div>
            
            {/* Success Message */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Local Experience Ready!</h2>
              <p className="text-muted-foreground max-w-xs">
                Your expert-curated experience with insider knowledge and hidden gems
              </p>
            </div>
            
            {/* Continue Button */}
            <Button 
              onClick={onComplete}
              className="w-full max-w-xs bg-background text-foreground border border-border hover:bg-muted"
              size="lg"
            >
              Continue Onboarding
            </Button>
          </div>
        ) : (
          <>
            {/* Step 0: Expert Curation */}
            {step === 0 && (
              <div className="flex flex-col items-center space-y-6 text-center animate-fade-in">
                {/* Expert Avatar */}
                <div className="relative">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-10 h-10 text-primary" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <Award className="w-4 h-4 text-white" />
                  </div>
                </div>
                
                {/* Expert Info */}
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">Travel Expert</h3>
                  <p className="text-sm text-muted-foreground">Mexico City Local Guide</p>
                  <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <BookOpen className="w-3 h-3" />
                      <span>12 Experiences</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-current" />
                      <span>4.9 Rating</span>
                    </div>
                  </div>
                </div>
                
                {/* Curation Process */}
                <Card className="w-full max-w-sm p-4 space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <h4 className="text-sm font-medium">Curating Experience</h4>
                      <p className="text-xs text-muted-foreground">Frida Kahlo Museum</p>
                    </div>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                </Card>
              </div>
            )}

            {/* Step 1: Real Mapbox map with Frida Kahlo Museum */}
            {step >= 1 && step < 5 && (
              <div className="relative w-full max-w-sm h-48 bg-muted rounded-lg border border-border overflow-hidden">
                <div ref={mapContainer} className="w-full h-full" />
                
                {/* Click indicator */}
                {step >= 2 && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 border-2 border-red-500 rounded-full animate-ping" />
                )}
                
                <div className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                  {step === 1 && "Tap any landmark marker"}
                  {step >= 2 && "Loading landmark..."}
                </div>
              </div>
            )}

            {/* Step 3: Loading */}
            {step >= 3 && step < 4 && (
              <div className="flex flex-col items-center space-y-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Gathering expert insights...</p>
              </div>
            )}

            {/* Step 4: Frida Kahlo Museum landmark details */}
            {step >= 4 && step < 5 && (
              <Card className="w-full max-w-sm p-4 space-y-3 animate-fade-in">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">Frida Kahlo Museum</h4>
                    <p className="text-xs text-muted-foreground">Coyoacán, Mexico City</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {fridaKahloPhotos.slice(0, 3).map((photo, index) => (
                    <div key={index} className="aspect-square bg-muted rounded-md overflow-hidden">
                      <img 
                        src={photo} 
                        alt={`Frida Kahlo Museum ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to camera icon if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement!.classList.add('flex', 'items-center', 'justify-center');
                          target.parentElement!.innerHTML = '<div class="w-4 h-4 text-muted-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 9 3 3 3-3"/><path d="M6 3h12l2 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7l2-4Z"/></svg></div>';
                        }}
                      />
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                    <span className="text-muted-foreground">4.5 • Museum</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">10 AM - 5:30 PM</span>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Historic blue house where renowned artist Frida Kahlo lived and worked. Expert insider tips included.
                </p>
              </Card>
            )}

            {/* Progress text */}
            {step < 5 && (
              <div className="text-center space-y-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {step === 0 && "Expert-Curated Experience"}
                  {step === 1 && "Local Hidden Gems"}
                  {step === 2 && "Instant Expert Access"}
                  {step === 3 && "Insider Knowledge"}
                  {step >= 4 && "Complete Local Guide"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {step === 0 && "Curated by local Mexico City experts"}
                  {step === 1 && "Discover places only locals know"}
                  {step === 2 && "Get expert insights instantly"}
                  {step === 3 && "Stories, tips, and hidden details"}
                  {step >= 4 && "Everything you need from a local expert"}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LocalExperienceAnimationDemo;