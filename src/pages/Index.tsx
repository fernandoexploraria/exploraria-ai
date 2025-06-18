
import React, { useState, useMemo, useCallback } from 'react';
import Map from '@/components/Map';
import InfoPanel from '@/components/InfoPanel';
import { landmarks as staticLandmarks, Landmark } from '@/data/landmarks';
import SearchControl from '@/components/SearchControl';
import { useTourPlanner } from '@/hooks/useTourPlanner';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import TourPlannerDialog from '@/components/TourPlannerDialog';
import VoiceAssistant from '@/components/VoiceAssistant';

// IMPORTANT: Replace this with your own public Mapbox token!
// You can get one from your Mapbox account: https://www.mapbox.com/
const MAPBOX_TOKEN = 'pk.eyJ1IjoiZm9icmVnb25hIiwiYSI6ImNtMGlnYzFlYTBtYnUybG9tMGRuczNoMzkifQ.n_n-sCR4Zm-dCV5ijeXiDg';

// I will replace this with your key once you provide it.
const ELEVENLABS_API_KEY = 'sk_eb59e166d9d2e3b2f5744a71424e493d53f472efff8191a9';

// Your Perplexity API key.
const PERPLEXITY_API_KEY = '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';

const Index: React.FC = () => {
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [isTourPlannerOpen, setIsTourPlannerOpen] = useState(false);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const [currentDestination, setCurrentDestination] = useState<string>('');
  const { plannedLandmarks, isLoading: isTourLoading, generateTour } = useTourPlanner();
  
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
    if (!PERPLEXITY_API_KEY || PERPLEXITY_API_KEY.includes('YOUR_')) {
        alert("Please provide a valid Perplexity API key in src/pages/Index.tsx");
        return;
    }
    
    setCurrentDestination(destination);
    await generateTour(destination, PERPLEXITY_API_KEY);
    
    // Show voice assistant after tour is generated
    setTimeout(() => {
      setIsVoiceAssistantOpen(true);
    }, 1000);
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
        {plannedLandmarks.length > 0 && (
          <Button
            variant="outline"
            className="bg-background/80 backdrop-blur-sm shadow-lg"
            onClick={() => setIsVoiceAssistantOpen(true)}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Voice Guide
          </Button>
        )}
      </div>
      <Map 
        mapboxToken={MAPBOX_TOKEN}
        landmarks={allLandmarks}
        onSelectLandmark={handleSelectLandmark}
        selectedLandmark={selectedLandmark}
        plannedLandmarks={plannedLandmarks}
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
      />
      <VoiceAssistant
        open={isVoiceAssistantOpen}
        onOpenChange={setIsVoiceAssistantOpen}
        destination={currentDestination}
        landmarks={plannedLandmarks}
        perplexityApiKey={PERPLEXITY_API_KEY}
        elevenLabsApiKey={ELEVENLABS_API_KEY}
      />
    </div>
  );
};

export default Index;
