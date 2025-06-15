
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Map from '@/components/Map';
import InfoPanel from '@/components/InfoPanel';
import { landmarks as staticLandmarks, Landmark } from '@/data/landmarks';
import SearchControl from '@/components/SearchControl';
import { useTourPlanner } from '@/hooks/useTourPlanner';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import TourPlannerDialog from '@/components/TourPlannerDialog';

// IMPORTANT: Replace this with your own public Mapbox token!
// You can get one from your Mapbox account: https://www.mapbox.com/
const MAPBOX_TOKEN = 'pk.eyJ1IjoiZm9icmVnb25hIiwiYSI6ImNtMGlnYzFlYTBtYnUybG9tMGRuczNoMzkifQ.n_n-sCR4Zm-dCV5ijeXiDg';

// I will replace this with your key once you provide it.
const ELEVENLABS_API_KEY = 'sk_eb59e166d9d2e3b2f5744a71424e493d53f472efff8191a9';

const Index: React.FC = () => {
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [isTourPlannerOpen, setIsTourPlannerOpen] = useState(false);
  const { plannedLandmarks, isLoading: isTourLoading, generateTour } = useTourPlanner();
  
  const [perplexityApiKey, setPerplexityApiKey] = useState<string>(() => localStorage.getItem('perplexityApiKey') || '');

  useEffect(() => {
    localStorage.setItem('perplexityApiKey', perplexityApiKey);
  }, [perplexityApiKey]);

  const allLandmarks = useMemo(() => {
    return [...staticLandmarks, ...plannedLandmarks];
  }, [plannedLandmarks]);

  const handleSelectLandmark = useCallback((landmark: Landmark) => {
    setSelectedLandmark(landmark);
  }, []);

  const handleClosePanel = () => {
    setSelectedLandmark(null);
  };

  const handleGenerateTour = async (destination: string) => {
    await generateTour(destination, perplexityApiKey);
  };

  return (
    <div className="w-screen h-screen relative">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <SearchControl landmarks={allLandmarks} onSelectLandmark={handleSelectLandmark} />
        <Button
          variant="outline"
          className="bg-background/80 backdrop-blur-sm shadow-lg"
          onClick={() => setIsTourPlannerOpen(true)}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Plan a Tour
        </Button>
      </div>
      <Map 
        mapboxToken={MAPBOX_TOKEN}
        landmarks={allLandmarks}
        onSelectLandmark={handleSelectLandmark}
        selectedLandmark={selectedLandmark}
      />
      <InfoPanel 
        landmark={selectedLandmark}
        onClose={handleClosePanel}
        elevenLabsApiKey={ELEVENLABS_API_KEY}
      />
      <TourPlannerDialog
        open={isTourPlannerOpen}
        onOpenChange={setIsTourPlannerOpen}
        onGenerateTour={handleGenerateTour}
        isLoading={isTourLoading}
        perplexityApiKey={perplexityApiKey}
        onPerplexityApiKeyChange={setPerplexityApiKey}
      />
    </div>
  );
};

export default Index;
