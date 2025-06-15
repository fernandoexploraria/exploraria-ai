
import React, { useState } from 'react';
import Map from '@/components/Map';
import InfoPanel from '@/components/InfoPanel';
import { landmarks, Landmark } from '@/data/landmarks';
import SearchControl from '@/components/SearchControl';

// IMPORTANT: Replace this with your own public Mapbox token!
// You can get one from your Mapbox account: https://www.mapbox.com/
const MAPBOX_TOKEN = 'pk.eyJ1IjoiZm9icmVnb25hIiwiYSI6ImNtMGlnYzFlYTBtYnUybG9tMGRuczNoMzkifQ.n_n-sCR4Zm-dCV5ijeXiDg';

// I will replace this with your key once you provide it.
const ELEVENLABS_API_KEY = 'sk_eb59e166d9d2e3b2f5744a71424e493d53f472efff8191a9';

const Index: React.FC = () => {
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);

  const handleSelectLandmark = (landmark: Landmark) => {
    setSelectedLandmark(landmark);
  };

  const handleClosePanel = () => {
    setSelectedLandmark(null);
  };

  return (
    <div className="w-screen h-screen relative">
      <SearchControl landmarks={landmarks} onSelectLandmark={handleSelectLandmark} />
      <Map 
        mapboxToken={MAPBOX_TOKEN}
        landmarks={landmarks}
        onSelectLandmark={handleSelectLandmark}
        selectedLandmark={selectedLandmark}
      />
      <InfoPanel 
        landmark={selectedLandmark}
        onClose={handleClosePanel}
        elevenLabsApiKey={ELEVENLABS_API_KEY}
      />
    </div>
  );
};

export default Index;
