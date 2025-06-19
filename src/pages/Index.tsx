
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Map from '@/components/Map';
import SplashScreen from '@/components/SplashScreen';
import SimpleVoiceAssistant from '@/components/SimpleVoiceAssistant';
import { landmarks as staticLandmarks, Landmark } from '@/data/landmarks';
import { useTourPlanner } from '@/hooks/useTourPlanner';
import { useAuth } from '@/components/AuthProvider';
import TopControls from '@/components/TopControls';
import UserControls from '@/components/UserControls';
import DialogManager from '@/components/DialogManager';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

// IMPORTANT: Replace this with your own public Mapbox token!
// You can get one from your Mapbox account: https://www.mapbox.com/
const MAPBOX_TOKEN = 'pk.eyJ1IjoiZm9icmVnb25hIiwiYSI6ImNtMGlnYzFlYTBtYnUybG9tMGRuczNoMzkifQ.n_n-sCR4Zm-dCV5ijeXiDg';

const PENDING_DESTINATION_KEY = 'pendingTourDestination';

const Index: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [isTourPlannerOpen, setIsTourPlannerOpen] = useState(false);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const [isVoiceSearchOpen, setIsVoiceSearchOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isSimpleVoiceOpen, setIsSimpleVoiceOpen] = useState(false);
  const [currentDestination, setCurrentDestination] = useState<string>('');
  const [pendingDestination, setPendingDestination] = useState<string>('');
  const [additionalLandmarks, setAdditionalLandmarks] = useState<Landmark[]>([]);
  const { plannedLandmarks, isLoading: isTourLoading, generateTour } = useTourPlanner();
  const { user, signOut } = useAuth();
  
  const allLandmarks = useMemo(() => {
    return [...staticLandmarks, ...plannedLandmarks, ...additionalLandmarks];
  }, [plannedLandmarks, additionalLandmarks]);

  // Handle post-authentication tour generation
  useEffect(() => {
    if (user && !isTourLoading) {
      // Check both state and localStorage for pending destination
      const storedDestination = localStorage.getItem(PENDING_DESTINATION_KEY);
      const destinationToUse = pendingDestination || storedDestination;
      
      if (destinationToUse) {
        console.log('User signed in with pending destination:', destinationToUse);
        // Clear from localStorage
        localStorage.removeItem(PENDING_DESTINATION_KEY);
        // Automatically generate tour and open tour planner
        setIsTourPlannerOpen(true);
        handleGenerateTour(destinationToUse);
        setPendingDestination('');
      }
    }
  }, [user, pendingDestination, isTourLoading]);

  const handleSelectLandmark = useCallback((landmark: Landmark) => {
    setSelectedLandmark(landmark);
  }, []);

  const handleGenerateTour = async (destination: string) => {
    setCurrentDestination(destination);
    await generateTour(destination);
    
    // Close tour planner and show voice assistant after tour is generated
    setTimeout(() => {
      setIsTourPlannerOpen(false);
      setIsVoiceAssistantOpen(true);
    }, 1000);
  };

  const handleTourAuthRequired = (destination: string) => {
    console.log('Auth required for destination:', destination);
    // Store in both state and localStorage for OAuth persistence
    setPendingDestination(destination);
    localStorage.setItem(PENDING_DESTINATION_KEY, destination);
    setIsAuthDialogOpen(true);
  };

  const handleAuthDialogClose = (open: boolean) => {
    setIsAuthDialogOpen(open);
    
    // Note: The useEffect above will handle the tour generation when user signs in
    // No need to check for pendingDestination here as OAuth redirects might not preserve state
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

  const handleSplashDismiss = () => {
    setShowSplash(false);
  };

  const handleLogoClick = () => {
    setShowSplash(true);
  };

  const handleAddLandmarks = useCallback((newLandmarks: Landmark[]) => {
    setAdditionalLandmarks(prev => [...prev, ...newLandmarks]);
  }, []);

  if (showSplash) {
    return <SplashScreen onDismiss={handleSplashDismiss} />;
  }

  return (
    <div className="w-screen h-screen relative">
      <TopControls
        allLandmarks={allLandmarks}
        onSelectLandmark={handleSelectLandmark}
        onTourPlannerOpen={() => setIsTourPlannerOpen(true)}
        onFavoritesOpen={handleFavoritesOpen}
        onVoiceSearchOpen={handleVoiceSearchOpen}
        onVoiceAssistantOpen={handleVoiceAssistantOpen}
        onLogoClick={handleLogoClick}
        user={user}
        plannedLandmarks={plannedLandmarks}
      />

      <UserControls
        user={user}
        onSignOut={signOut}
        onAuthDialogOpen={() => setIsAuthDialogOpen(true)}
      />

      {/* Rome Expert Button */}
      <div className="fixed bottom-8 right-8 z-10">
        <Button
          onClick={() => setIsSimpleVoiceOpen(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
          size="lg"
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          Rome Expert
        </Button>
      </div>

      <Map 
        mapboxToken={MAPBOX_TOKEN}
        landmarks={allLandmarks}
        onSelectLandmark={handleSelectLandmark}
        selectedLandmark={selectedLandmark}
        plannedLandmarks={[...plannedLandmarks, ...additionalLandmarks]}
      />

      <DialogManager
        isTourPlannerOpen={isTourPlannerOpen}
        onTourPlannerOpenChange={setIsTourPlannerOpen}
        onGenerateTour={handleGenerateTour}
        onTourAuthRequired={handleTourAuthRequired}
        isTourLoading={isTourLoading}
        isVoiceAssistantOpen={isVoiceAssistantOpen}
        onVoiceAssistantOpenChange={setIsVoiceAssistantOpen}
        currentDestination={currentDestination}
        plannedLandmarks={plannedLandmarks}
        isVoiceSearchOpen={isVoiceSearchOpen}
        onVoiceSearchOpenChange={setIsVoiceSearchOpen}
        isFavoritesOpen={isFavoritesOpen}
        onFavoritesOpenChange={setIsFavoritesOpen}
        isAuthDialogOpen={isAuthDialogOpen}
        onAuthDialogOpenChange={handleAuthDialogClose}
        onAddLandmarks={handleAddLandmarks}
      />

      <SimpleVoiceAssistant
        open={isSimpleVoiceOpen}
        onOpenChange={setIsSimpleVoiceOpen}
      />
    </div>
  );
};

export default Index;
