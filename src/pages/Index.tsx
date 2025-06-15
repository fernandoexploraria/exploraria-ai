
import React, { useState, useEffect } from 'react';
import Map from '@/components/Map';
import InfoPanel from '@/components/InfoPanel';
import { landmarks, Landmark } from '@/data/landmarks';

// IMPORTANT: Replace this with your own public Mapbox token!
// You can get one from your Mapbox account: https://www.mapbox.com/
const MAPBOX_TOKEN = 'pk.eyJ1IjoiZm9icmVnb25hIiwiYSI6ImNtMGlnYzFlYTBtYnUybG9tMGRuczNoMzkifQ.n_n-sCR4Zm-dCV5ijeXiDg';

const Index: React.FC = () => {
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>(localStorage.getItem('elevenLabsApiKey') || '');

  useEffect(() => {
    if (elevenLabsApiKey) {
      localStorage.setItem('elevenLabsApiKey', elevenLabsApiKey);
    } else {
      localStorage.removeItem('elevenLabsApiKey');
    }
  }, [elevenLabsApiKey]);

  const handleSelectLandmark = (landmark: Landmark) => {
    setSelectedLandmark(landmark);
  };

  const handleClosePanel = () => {
    setSelectedLandmark(null);
  };

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'pk.eyJ1IjoiZ3B0ZW5naW5lZXIiLCJhIjoiY2x0d2F3NW9kMWh2eDJrbzJwcjEwZ3lqZCJ9.7J_S_42K2Wm3l9Q4f2bXjA') {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md w-full p-8 bg-card rounded-lg shadow-xl">
          <h1 className="text-2xl font-bold mb-4 text-primary">Welcome to the AI Tour Guide</h1>
          <p className="text-muted-foreground mb-6">
            To begin your journey, please add your Mapbox Public Token in the code at <code className="bg-muted text-muted-foreground font-mono p-1 rounded-sm">src/pages/Index.tsx</code>. You can get one for free from your Mapbox account dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen relative">
      <Map 
        mapboxToken={MAPBOX_TOKEN}
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
