import React, { useState, useEffect, useRef } from 'react';
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
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from '@/hooks/useMapboxToken';

interface LandmarkAnimationDemoProps {
  onComplete: () => void;
}

const LandmarkAnimationDemo: React.FC<LandmarkAnimationDemoProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapboxToken = useMapboxToken();

  // Times Square data from database
  const timesSquareCoords: [number, number] = [-73.9855426, 40.7579747];
  const timesSquarePhotos = [
    "https://places.googleapis.com/v1/places/ChIJmQJIxlVYwokRLgeuocVOGVU/photos/ATKogpfY-nbUQpuEeHdJDqrXuf-NHF2Z0w_Vyo94EwDa68D7QZ8HOG3HIL3BJ-CaR1OmiBQGCXcYdWq5IgPJSHiMnh7lp3a3sKBiQlzFGBH0hirxoaSVLWaQ6JsSr2xY627L5RD2f4YU5xQi9epWp-ssqUCLX7MYG_9UUdiDPcIU0gEsB0qnd6qCDe-iv6D9F-uycnmurwBzm_36VrVVXd386fiwP2IaG51jY_4_PActKuly0WFJGxech_RYom1-wmT1RyGqJXWDtQBAlCsM6pkq0hhjJyPvX71M1pW_yNn00mqy31LoXAzUQ6KjWy_JEI-_GkdB8IZRrwxRLnR9M-2q6k4BOdW1eURF_SUd_H8YwlMpCFRSWRuHLOWycVwFFzgr4oCYfMjwpfSAtsMGm4XQQzr-QptUcxnYIke6bj94H-qK3A/media?maxWidthPx=400&key=AIzaSyDwlzmac-ghW1kTlfJiEEoApG3XhyI0rZg",
    "https://places.googleapis.com/v1/places/ChIJmQJIxlVYwokRLgeuocVOGVU/photos/ATKogpeR056eEDIy85joIIkj8VNDd-maDCOXAfppmRemubzqjNTz1AllkwP-m6LkEJsV__XuNI5gFpxOGeYkagjZsr2Qz1oAetiuNrFRp0Q6XIG7-hFvgWEDLJNBvvM_GiUNasm17D63SIC1a6GlFbwmIWRG78y4keKzAhzUD_ukM-l1f6iKmcBUFLsvxYDpGXFjh2qql5mXo_pNbFzqh1KXA41Fggj41D84JohU-GXbZweYIDZ4c6KGifJjyTbhyaoqq9i0XFQXX5a7HhoDZDcgzrR81GbPWP7okAVDdyw2cJXxy3n1T4BuvwUR8712lVAqk3n75lLkr9vQZyOc0klFWepETfFu7QJWljF9fCWjAcOfUf8tJcfMkFD3U6P-ubx8o1YO8gDHXVaLK03M9kTUu4OkiJnCrlRo79L36KEawHI/media?maxWidthPx=400&key=AIzaSyDwlzmac-ghW1kTlfJiEEoApG3XhyI0rZg",
    "https://places.googleapis.com/v1/places/ChIJmQJIxlVYwokRLgeuocVOGVU/photos/ATKogpe3D7gLQzvHgrCpR0QePku7rFpaCEi96Wld3MHReWmUpGQCvwU70pNSYg5wpIH--_6dW9wwa8id68e4ucvT41G9nuC_ChdPH5nBI_dU27wnMy7GzeW9D-eu15JAWXn_oO4X4D2SXK3Jo3paVBu_dV2EDlVp9OvLF_HP_CMNfTrFLDZhV3iMkSR-BKNss3OuG-YRAmlb_y-ifh6JKAwZ37yjwWhk2VlDs3yeZ-vbwiBx_-Y8G_jnWA771I-w7zcVX3wsCXPUsHD-lIB8lvg8BeS5RMDdsvAjXv4du4lCr9__psKQ_ZqpUydclUb-Jof7IbZW1avS-yxbrRQLYt3u8mcXiwpsHuvCQXsWlR2K_QFcyufNjmBK4jQNzguMzyOn9R3eXdIbEEofw9fbpHiEaE6yU2_NTJxPm1xY87sW8m70CgRl/media?maxWidthPx=400&key=AIzaSyDwlzmac-ghW1kTlfJiEEoApG3XhyI0rZg"
  ];

  // Initialize Mapbox map
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
        {/* Step 1: Real Mapbox map with Times Square */}
        {step >= 0 && (
          <div className="relative w-full max-w-sm h-48 bg-muted rounded-lg border border-border overflow-hidden">
            <div ref={mapContainer} className="w-full h-full" />
            
            {/* Click indicator */}
            {step >= 1 && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 border-2 border-red-500 rounded-full animate-ping" />
            )}
            
            <div className="absolute bottom-2 left-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
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

        {/* Step 3: Times Square landmark details */}
        {step >= 3 && (
          <Card className="w-full max-w-sm p-4 space-y-3 animate-fade-in">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground">Times Square</h4>
                <p className="text-xs text-muted-foreground">Manhattan, NY 10036, USA</p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {timesSquarePhotos.slice(0, 3).map((photo, index) => (
                <div key={index} className="aspect-square bg-muted rounded-md overflow-hidden">
                  <img 
                    src={photo} 
                    alt={`Times Square ${index + 1}`}
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
                <span className="text-muted-foreground">4.7 • Plaza</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">24/7 open</span>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Bustling destination in the heart of the Theater District known for bright lights, shopping & shows.
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