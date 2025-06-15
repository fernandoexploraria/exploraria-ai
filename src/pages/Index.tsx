
import React, { useState, useEffect } from 'react';
import Map from '@/components/Map';
import InfoPanel from '@/components/InfoPanel';
import { landmarks, Landmark } from '@/data/landmarks';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";

const Index: React.FC = () => {
  const [mapboxToken, setMapboxToken] = useState<string>(localStorage.getItem('mapboxToken') || '');
  const [tempMapboxToken, setTempMapboxToken] = useState<string>('');
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>(localStorage.getItem('elevenLabsApiKey') || '');

  useEffect(() => {
    if (elevenLabsApiKey) {
      localStorage.setItem('elevenLabsApiKey', elevenLabsApiKey);
    }
  }, [elevenLabsApiKey]);

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempMapboxToken) {
      localStorage.setItem('mapboxToken', tempMapboxToken);
      setMapboxToken(tempMapboxToken);
      toast.success("Mapbox token saved!");
    } else {
      toast.error("Please enter a valid Mapbox token.");
    }
  };

  const handleSelectLandmark = (landmark: Landmark) => {
    setSelectedLandmark(landmark);
  };

  const handleClosePanel = () => {
    setSelectedLandmark(null);
  };

  if (!mapboxToken) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md w-full p-8 bg-card rounded-lg shadow-xl">
          <h1 className="text-2xl font-bold mb-4 text-primary">Welcome to the AI Tour Guide</h1>
          <p className="text-muted-foreground mb-6">To begin your journey, please enter your Mapbox Public Token. You can get one for free from your Mapbox account dashboard.</p>
          <form onSubmit={handleTokenSubmit} className="flex flex-col sm:flex-row gap-2">
            <Input
              type="text"
              placeholder="pk.ey..."
              value={tempMapboxToken}
              onChange={(e) => setTempMapboxToken(e.target.value)}
              className="flex-grow"
            />
            <Button type="submit">Start Exploring</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen relative">
      <Map 
        mapboxToken={mapboxToken}
        landmarks={landmarks}
        onSelectLandmark={handleSelectLandmark}
        selectedLandmark={selectedLandmark}
      />
      <InfoPanel 
        landmark={selectedLandmark}
        onClose={handleClosePanel}
        elevenLabsApiKey={elevenLabsApiKey}
        setElevenLabsApiKey={setElevenLabsApiKey}
      />
    </div>
  );
};

export default Index;
