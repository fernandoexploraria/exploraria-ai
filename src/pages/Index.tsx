import React, { useState, useMemo, useCallback } from 'react';
import SplashScreen from '@/components/SplashScreen';
import MainLayout from '@/components/MainLayout';
import { landmarks as staticLandmarks, Landmark } from '@/data/landmarks';
import { useTourPlanner } from '@/hooks/useTourPlanner';
import { useAuth } from '@/components/AuthProvider';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { usePendingDestination } from '@/hooks/usePendingDestination';
import { useDialogStates } from '@/hooks/useDialogStates';
import { useProximityNotifications } from '@/hooks/useProximityNotifications';

const Index: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [additionalLandmarks, setAdditionalLandmarks] = useState<Landmark[]>([]);
  
  const { tourPlan, plannedLandmarks, isLoading: isTourLoading, generateTour } = useTourPlanner();
  const { user, signOut } = useAuth();
  const mapboxToken = useMapboxToken();
  
  // Use the new proximity notifications hook with testing mode enabled (1200km max range)
  const {
    activeNotification,
    showFloatingCard,
    hideFloatingCard,
    showRouteVisualization,
    showSearchNearby,
    hideSearchNearby,
    isSearchNearbyOpen,
    searchNearbyLandmark,
    searchNearbyCoordinates,
    userLocation
  } = useProximityNotifications(true); // true = testing mode with large thresholds
  
  const {
    selectedLandmark,
    setSelectedLandmark,
    isTourPlannerOpen,
    setIsTourPlannerOpen,
    isInteractionHistoryOpen,
    setIsInteractionHistoryOpen,
    isAuthDialogOpen,
    setIsAuthDialogOpen,
    isNewTourAssistantOpen,
    setIsNewTourAssistantOpen,
  } = useDialogStates();
  
  // Updated to include callback for opening NewTourAssistant
  const { handleTourAuthRequired: storePendingDestination } = usePendingDestination(
    user, 
    isTourLoading, 
    generateTour,
    () => setIsNewTourAssistantOpen(true) // Callback to open NewTourAssistant
  );
  
  const allLandmarks = useMemo(() => {
    return [...staticLandmarks, ...plannedLandmarks, ...additionalLandmarks];
  }, [plannedLandmarks, additionalLandmarks]);

  const handleSelectLandmark = useCallback((landmark: Landmark) => {
    setSelectedLandmark(landmark);
  }, [setSelectedLandmark]);

  const handleGenerateTour = async (destination: string) => {
    await generateTour(destination);
    
    // Close tour planner and show new tour assistant after tour is generated
    setTimeout(() => {
      setIsTourPlannerOpen(false);
      setIsNewTourAssistantOpen(true);
    }, 1000);
  };

  const handleAuthDialogClose = (open: boolean) => {
    setIsAuthDialogOpen(open);
  };

  const handleVoiceAssistantOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsInteractionHistoryOpen(true);
  };

  const handleInteractionHistoryOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsInteractionHistoryOpen(true);
  };

  const handleSplashDismiss = () => {
    setShowSplash(false);
  };

  const handleLogoClick = () => {
    setShowSplash(true);
  };

  const handleNewTourAssistantOpen = () => {
    if (!user) {
      setIsAuthDialogOpen(true);
      return;
    }
    setIsNewTourAssistantOpen(true);
  };

  const handleTourAuthRequired = (destination: string) => {
    // Store the destination for post-auth generation
    storePendingDestination(destination);
    // Open the auth dialog
    setIsAuthDialogOpen(true);
  };

  if (showSplash) {
    return <SplashScreen onDismiss={handleSplashDismiss} />;
  }

  // Don't render the map until we have a token
  if (!mapboxToken) {
    return <div className="w-screen h-screen flex items-center justify-center">Loading map...</div>;
  }

  return (
    <>
      <MainLayout
        mapboxToken={mapboxToken}
        allLandmarks={allLandmarks}
        selectedLandmark={selectedLandmark}
        plannedLandmarks={plannedLandmarks}
        user={user}
        onSelectLandmark={handleSelectLandmark}
        onTourPlannerOpen={() => setIsTourPlannerOpen(true)}
        onVoiceSearchOpen={handleInteractionHistoryOpen}
        onVoiceAssistantOpen={handleNewTourAssistantOpen}
        onLogoClick={handleLogoClick}
        onSignOut={signOut}
        onAuthDialogOpen={() => setIsAuthDialogOpen(true)}
        isTourPlannerOpen={isTourPlannerOpen}
        onTourPlannerOpenChange={setIsTourPlannerOpen}
        onGenerateTour={handleGenerateTour}
        onTourAuthRequired={handleTourAuthRequired}
        isTourLoading={isTourLoading}
        isVoiceSearchOpen={isInteractionHistoryOpen}
        onVoiceSearchOpenChange={setIsInteractionHistoryOpen}
        isAuthDialogOpen={isAuthDialogOpen}
        onAuthDialogOpenChange={handleAuthDialogClose}
        isNewTourAssistantOpen={isNewTourAssistantOpen}
        onNewTourAssistantOpenChange={setIsNewTourAssistantOpen}
        tourPlan={tourPlan}
        // Pass proximity notification handlers (now managed internally)
        proximityEventHandlers={{
          onFloatingCardTrigger: showFloatingCard,
          onRouteVisualizationTrigger: showRouteVisualization
        }}
        // Pass active notification state
        activeProximityNotification={activeNotification}
        onHideFloatingCard={hideFloatingCard}
        onShowSearchNearby={showSearchNearby}
        // Search nearby state
        isSearchNearbyOpen={isSearchNearbyOpen}
        searchNearbyLandmark={searchNearbyLandmark}
        searchNearbyCoordinates={searchNearbyCoordinates}
        onHideSearchNearby={hideSearchNearby}
        userLocation={userLocation ? [userLocation.longitude, userLocation.latitude] : null}
      />
    </>
  );
};

export default Index;
