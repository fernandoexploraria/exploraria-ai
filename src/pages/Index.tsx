import React, { useState, useMemo, useCallback, useEffect } from 'react';
import SplashScreen from '@/components/SplashScreen';
import MainLayout from '@/components/MainLayout';
import DebugWindow from '@/components/DebugWindow';
import { landmarks as staticLandmarks, Landmark, EnhancedLandmark } from '@/data/landmarks';
import { useTourPlanner } from '@/hooks/useTourPlanner';
import { useAuth } from '@/components/AuthProvider';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { usePendingDestination } from '@/hooks/usePendingDestination';
import { useDialogStates } from '@/hooks/useDialogStates';
import { useProximityNotifications } from '@/hooks/useProximityNotifications';
import { useDebugWindow } from '@/hooks/useDebugWindow';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';

const Index: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [additionalLandmarks, setAdditionalLandmarks] = useState<Landmark[]>([]);
  
  const { tourPlan, plannedLandmarks, isLoading: isTourLoading, generateTour, progressState } = useTourPlanner();
  const { user, signOut } = useAuth();
  const mapboxToken = useMapboxToken();
  const { isVisible: isDebugVisible, toggle: toggleDebug } = useDebugWindow();
  
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

  // Initialize proximity notifications
  useProximityNotifications();
  
  // Initialize connection monitoring
  useConnectionMonitor();
  
  // Handle progress state changes - close dialog and open assistant when ready
  useEffect(() => {
    console.log('Progress state changed:', progressState?.phase);
    
    if (progressState?.phase === 'ready' && isTourPlannerOpen) {
      console.log('Tour is ready, closing planner and opening assistant');
      setIsTourPlannerOpen(false);
      setIsNewTourAssistantOpen(true);
    }
  }, [progressState?.phase, isTourPlannerOpen, setIsTourPlannerOpen, setIsNewTourAssistantOpen]);
  
  // Combine static landmarks with enhanced tour landmarks
  const allLandmarks: (Landmark | EnhancedLandmark)[] = useMemo(() => {
    const tourLandmarks = tourPlan?.landmarks || [];
    return [...staticLandmarks, ...tourLandmarks, ...additionalLandmarks];
  }, [tourPlan?.landmarks, additionalLandmarks]);

  // Also keep the basic plannedLandmarks for backward compatibility
  const basicPlannedLandmarks = useMemo(() => {
    return plannedLandmarks;
  }, [plannedLandmarks]);

  const handleSelectLandmark = useCallback((landmark: Landmark) => {
    setSelectedLandmark(landmark);
  }, [setSelectedLandmark]);

  const handleGenerateTour = async (destination: string) => {
    console.log('Starting tour generation for:', destination);
    await generateTour(destination);
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
        plannedLandmarks={basicPlannedLandmarks}
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
        tourProgressState={progressState}
        isVoiceSearchOpen={isInteractionHistoryOpen}
        onVoiceSearchOpenChange={setIsInteractionHistoryOpen}
        isAuthDialogOpen={isAuthDialogOpen}
        onAuthDialogOpenChange={handleAuthDialogClose}
        isNewTourAssistantOpen={isNewTourAssistantOpen}
        onNewTourAssistantOpenChange={setIsNewTourAssistantOpen}
        tourPlan={tourPlan}
      />
      <DebugWindow 
        isVisible={isDebugVisible}
        onClose={toggleDebug}
      />
    </>
  );
};

export default Index;
