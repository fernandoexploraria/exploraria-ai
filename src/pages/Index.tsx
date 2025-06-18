import React, { useState, useMemo, useCallback } from 'react';
import Map from '@/components/Map';
import InfoPanel from '@/components/InfoPanel';
import { landmarks as staticLandmarks, Landmark } from '@/data/landmarks';
import SearchControl from '@/components/SearchControl';
import { useTourPlanner } from '@/hooks/useTourPlanner';
import { Button } from '@/components/ui/button';
import { Sparkles, Search, User, LogOut, Star } from 'lucide-react';
import TourPlannerDialog from '@/components/TourPlannerDialog';
import VoiceAssistant from '@/components/VoiceAssistant';
import VoiceSearchDialog from '@/components/VoiceSearchDialog';
import FavoritesDialog from '@/components/FavoritesDialog';
import AuthDialog from '@/components/AuthDialog';
import CameraCapture from '@/components/CameraCapture';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

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
  const [isVoiceSearchOpen, setIsVoiceSearchOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentDestination, setCurrentDestination] = useState<string>('');
  const { plannedLandmarks, isLoading: isTourLoading, generateTour } = useTourPlanner();
  const { user, signOut } = useAuth();
  
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

  const handleImageCapture = async (imageData: string) => {
    if (!selectedLandmark) return;
    
    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-landmark-image', {
        body: { imageData, landmarkName: selectedLandmark.name }
      });

      if (error) {
        throw error;
      }

      // You could display the analysis in a toast or update the InfoPanel
      console.log('AI Analysis:', data.analysis);
      alert(`AI Analysis: ${data.analysis}`);

    } catch (error) {
      console.error('Error analyzing image:', error);
      alert('Failed to analyze image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleVoiceAssistantOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsVoiceAssistantOpen(true);
  };

  const handleVoiceSearchOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsVoiceSearchOpen(true);
  };

  const handleFavoritesOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsFavoritesOpen(true);
  };

  return (
    <div className="w-screen h-screen relative">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <img 
          src="/lovable-uploads/ac9cbebd-b083-4d3d-a85e-782e03045422.png" 
          alt="Explorar-IA Logo" 
          className="h-10 w-auto bg-yellow-400 rounded-lg p-1"
        />
        <SearchControl landmarks={allLandmarks} onSelectLandmark={handleSelectLandmark} />
        <Button
          variant="outline"
          className="bg-background/80 backdrop-blur-sm shadow-lg"
          onClick={() => setIsTourPlannerOpen(true)}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Plan a Tour
        </Button>
        {user && (
          <>
            <Button
              variant="outline"
              className="bg-background/80 backdrop-blur-sm shadow-lg"
              onClick={handleFavoritesOpen}
            >
              <Star className="mr-2 h-4 w-4" />
              Favorites
            </Button>
            <Button
              variant="outline"
              className="bg-background/80 backdrop-blur-sm shadow-lg"
              onClick={handleVoiceSearchOpen}
            >
              <Search className="mr-2 h-4 w-4" />
              Search Conversations
            </Button>
          </>
        )}
        {plannedLandmarks.length > 0 && (
          <Button
            variant="outline"
            className="bg-background/80 backdrop-blur-sm shadow-lg"
            onClick={handleVoiceAssistantOpen}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Voice Guide
          </Button>
        )}
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {user ? (
          <>
            <span className="text-sm bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg">
              {user.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="bg-background/80 backdrop-blur-sm shadow-lg"
              onClick={signOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            className="bg-background/80 backdrop-blur-sm shadow-lg"
            onClick={() => setIsAuthDialogOpen(true)}
          >
            <User className="mr-2 h-4 w-4" />
            Sign In
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

      {/* Camera controls at bottom - only show when destination is selected and a landmark is selected */}
      {currentDestination && selectedLandmark && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-background/90 backdrop-blur-sm shadow-lg rounded-lg p-4">
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground text-center">
                Analyze {selectedLandmark.name} with your camera
              </p>
              <CameraCapture 
                onImageCapture={handleImageCapture}
                isLoading={isAnalyzing}
              />
            </div>
          </div>
        </div>
      )}

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
      <VoiceSearchDialog
        open={isVoiceSearchOpen}
        onOpenChange={setIsVoiceSearchOpen}
      />
      <FavoritesDialog
        open={isFavoritesOpen}
        onOpenChange={setIsFavoritesOpen}
      />
      <AuthDialog
        open={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
      />
    </div>
  );
};

export default Index;
