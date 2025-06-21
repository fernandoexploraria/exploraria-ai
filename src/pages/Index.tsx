import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Map from '@/components/Map';
import SplashScreen from '@/components/SplashScreen';
import NewTourAssistant from '@/components/NewTourAssistant';
import { landmarks as staticLandmarks, Landmark } from '@/data/landmarks';
import { useTourPlanner } from '@/hooks/useTourPlanner';
import { useAuth } from '@/components/AuthProvider';
import TopControls from '@/components/TopControls';
import UserControls from '@/components/UserControls';
import DialogManager from '@/components/DialogManager';
import { supabase } from '@/integrations/supabase/client';

const PENDING_DESTINATION_KEY = 'pendingTourDestination';

const Index: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [isTourPlannerOpen, setIsTourPlannerOpen] = useState(false);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const [isInteractionHistoryOpen, setIsInteractionHistoryOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isNewTourAssistantOpen, setIsNewTourAssistantOpen] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<string>('');
  const [additionalLandmarks, setAdditionalLandmarks] = useState<Landmark[]>([]);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [selectedCoordinates, setSelectedCoordinates] = useState<[number, number] | null>(null);
  const [selectedInteractionData, setSelectedInteractionData] = useState<{
    user_input: string;
    landmark_image_url?: string;
    assistant_response?: string;
  } | null>(null);
  const { tourPlan, plannedLandmarks, isLoading: isTourLoading, generateTour } = useTourPlanner();
  const { user, signOut } = useAuth();
  
  const allLandmarks = useMemo(() => {
    return [...staticLandmarks, ...plannedLandmarks, ...additionalLandmarks];
  }, [plannedLandmarks, additionalLandmarks]);

  // Fetch Mapbox token from Supabase secrets
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) {
          console.error('Error fetching Mapbox token:', error);
          // Fallback to hardcoded token if secret fetch fails
          setMapboxToken('pk.eyJ1IjoiZm9icmVnb25hIiwiYSI6ImNtMGlnYzFlYTBtYnUybG9tMGRuczNoMzkifQ.n_n-sCR4Zm-dCV5ijeXiDg');
        } else {
          setMapboxToken(data.token);
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        // Fallback to hardcoded token
        setMapboxToken('pk.eyJ1IjoiZm9icmVnb25hIiwiYSI6ImNtMGlnYzFlYTBtYnUybG9tMGRuczNoMzkifQ.n_n-sCR4Zm-dCV5ijeXiDg');
      }
    };

    fetchMapboxToken();
  }, []);

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
    await generateTour(destination);
    
    // Close tour planner and show new tour assistant after tour is generated
    setTimeout(() => {
      setIsTourPlannerOpen(false);
      setIsNewTourAssistantOpen(true);
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
  };

  const handleVoiceAssistantOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsVoiceAssistantOpen(true);
  };

  const handleInteractionHistoryOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsInteractionHistoryOpen(true);
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

  const handleNewTourAssistantOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsNewTourAssistantOpen(true);
  };

  const handleLocationSelect = useCallback((coordinates: [number, number], interactionData?: any) => {
    console.log('Location selected from interaction history:', coordinates);
    setSelectedCoordinates(coordinates);
    
    // Set interaction data if provided
    if (interactionData) {
      setSelectedInteractionData({
        user_input: interactionData.user_input,
        landmark_image_url: interactionData.landmark_image_url,
        assistant_response: interactionData.assistant_response
      });
    }
    
    // Create a temporary landmark at the selected coordinates
    const tempLandmark: Landmark = {
      id: `temp-${Date.now()}`,
      name: interactionData?.user_input || 'Selected Location',
      description: interactionData?.assistant_response || 'Location from interaction history',
      coordinates
    };
    setSelectedLandmark(tempLandmark);
  }, []);

  if (showSplash) {
    return <SplashScreen onDismiss={handleSplashDismiss} />;
  }

  // Don't render the map until we have a token
  if (!mapboxToken) {
    return <div className="w-screen h-screen flex items-center justify-center">Loading map...</div>;
  }

  return (
    <div className="w-screen h-screen relative">
      <TopControls
        allLandmarks={allLandmarks}
        onSelectLandmark={handleSelectLandmark}
        onTourPlannerOpen={() => setIsTourPlannerOpen(true)}
        onFavoritesOpen={handleFavoritesOpen}
        onVoiceSearchOpen={handleInteractionHistoryOpen}
        onVoiceAssistantOpen={handleNewTourAssistantOpen}
        onLogoClick={handleLogoClick}
        user={user}
        plannedLandmarks={plannedLandmarks}
      />

      <UserControls
        user={user}
        onSignOut={signOut}
        onAuthDialogOpen={() => setIsAuthDialogOpen(true)}
      />

      <Map 
        mapboxToken={mapboxToken}
        landmarks={allLandmarks}
        onSelectLandmark={handleSelectLandmark}
        selectedLandmark={selectedLandmark}
        plannedLandmarks={[...plannedLandmarks, ...additionalLandmarks]}
        selectedCoordinates={selectedCoordinates}
        selectedInteractionData={selectedInteractionData}
      />

      <DialogManager
        isTourPlannerOpen={isTourPlannerOpen}
        onTourPlannerOpenChange={setIsTourPlannerOpen}
        onGenerateTour={handleGenerateTour}
        onTourAuthRequired={handleTourAuthRequired}
        isTourLoading={isTourLoading}
        isVoiceSearchOpen={isInteractionHistoryOpen}
        onVoiceSearchOpenChange={setIsInteractionHistoryOpen}
        isFavoritesOpen={isFavoritesOpen}
        onFavoritesOpenChange={setIsFavoritesOpen}
        isAuthDialogOpen={isAuthDialogOpen}
        onAuthDialogOpenChange={handleAuthDialogClose}
        onLocationSelect={handleLocationSelect}
      />

      <NewTourAssistant
        open={isNewTourAssistantOpen}
        onOpenChange={setIsNewTourAssistantOpen}
        destination={tourPlan?.destination || ''}
        landmarks={plannedLandmarks}
        systemPrompt={tourPlan?.systemPrompt}
      />
    </div>
  );
};

export default Index;
